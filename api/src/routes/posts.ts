import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { enqueuePublish, enqueueScheduledPublish, cancelScheduledJob } from "../queue/publisher.js";

const app = new Hono();

const createPostSchema = z.object({
  accountId: z.string(),
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(["public", "neighbor", "private"]).default("public"),
  templateId: z.string().optional(),
});

const updatePostSchema = createPostSchema.partial();

// 글 목록 조회
app.get("/", async (c) => {
  const status = c.req.query("status");
  const allPosts = await db.select().from(schema.posts).orderBy(desc(schema.posts.createdAt));

  const filtered = status
    ? allPosts.filter((p) => p.status === status)
    : allPosts;

  return c.json(
    filtered.map((p) => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
    })),
  );
});

// 글 상세 조회
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [post] = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.id, id));

  if (!post) return c.json({ error: "글을 찾을 수 없습니다." }, 404);

  return c.json({
    ...post,
    tags: post.tags ? JSON.parse(post.tags) : [],
  });
});

// 새 글 등록
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const id = nanoid();
  const data = parsed.data;

  await db.insert(schema.posts).values({
    id,
    accountId: data.accountId,
    title: data.title,
    content: data.content,
    category: data.category || null,
    tags: data.tags ? JSON.stringify(data.tags) : null,
    visibility: data.visibility,
    status: "draft",
    templateId: data.templateId || null,
  });

  return c.json({ id }, 201);
});

// 글 수정
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
  if (data.visibility !== undefined) updateData.visibility = data.visibility;
  if (data.accountId !== undefined) updateData.accountId = data.accountId;

  await db.update(schema.posts).set(updateData).where(eq(schema.posts.id, id));

  return c.json({ id });
});

// 글 삭제
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(schema.posts).where(eq(schema.posts.id, id));
  return c.json({ success: true });
});

// 즉시 발행
app.post("/:id/publish", async (c) => {
  const id = c.req.param("id");
  const [post] = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.id, id));

  if (!post) return c.json({ error: "글을 찾을 수 없습니다." }, 404);

  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, post.accountId));

  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  const job = await enqueuePublish({
    postId: post.id,
    accountId: post.accountId,
    blogId: account.blogId,
    title: post.title,
    content: post.content,
    category: post.category || undefined,
    tags: post.tags ? JSON.parse(post.tags) : undefined,
    visibility: post.visibility || "public",
  });

  // 작업 기록
  await db.insert(schema.jobs).values({
    id: job.id!,
    postId: post.id,
    accountId: post.accountId,
    type: "publish",
    status: "waiting",
  });

  await db
    .update(schema.posts)
    .set({ status: "queued" })
    .where(eq(schema.posts.id, id));

  return c.json({ jobId: job.id });
});

// 예약 발행
app.post("/:id/schedule", async (c) => {
  const id = c.req.param("id");
  const { scheduledAt } = await c.req.json<{ scheduledAt: string }>();

  if (!scheduledAt) {
    return c.json({ error: "scheduledAt이 필요합니다." }, 400);
  }

  const [post] = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.id, id));

  if (!post) return c.json({ error: "글을 찾을 수 없습니다." }, 404);

  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, post.accountId));

  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  const job = await enqueueScheduledPublish(
    {
      postId: post.id,
      accountId: post.accountId,
      blogId: account.blogId,
      title: post.title,
      content: post.content,
      category: post.category || undefined,
      tags: post.tags ? JSON.parse(post.tags) : undefined,
      visibility: post.visibility || "public",
    },
    new Date(scheduledAt),
  );

  await db.insert(schema.jobs).values({
    id: job.id!,
    postId: post.id,
    accountId: post.accountId,
    type: "scheduled_publish",
    status: "waiting",
    scheduledAt,
  });

  await db
    .update(schema.posts)
    .set({ status: "scheduled", scheduledAt })
    .where(eq(schema.posts.id, id));

  return c.json({ jobId: job.id });
});

// 예약 취소
app.delete("/:id/schedule", async (c) => {
  const id = c.req.param("id");

  // 해당 포스트의 대기 중인 작업 찾기
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.postId, id));

  if (job && job.status === "waiting") {
    await cancelScheduledJob(job.id);
    await db
      .update(schema.jobs)
      .set({ status: "cancelled" })
      .where(eq(schema.jobs.id, job.id));
  }

  await db
    .update(schema.posts)
    .set({ status: "draft", scheduledAt: null })
    .where(eq(schema.posts.id, id));

  return c.json({ success: true });
});

export default app;
