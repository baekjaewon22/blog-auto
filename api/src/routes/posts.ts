import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
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
  let posts = db.getPosts();
  if (status) posts = posts.filter((p) => p.status === status);
  return c.json(posts);
});

// 글 상세 조회
app.get("/:id", async (c) => {
  const post = db.getPost(c.req.param("id"));
  if (!post) return c.json({ error: "글을 찾을 수 없습니다." }, 404);
  return c.json(post);
});

// 새 글 등록
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = nanoid();
  const data = parsed.data;
  db.insertPost({
    id,
    accountId: data.accountId,
    title: data.title,
    content: data.content,
    category: data.category || null,
    tags: data.tags || [],
    visibility: data.visibility,
    status: "draft",
    scheduledAt: null,
    publishedAt: null,
    publishedUrl: null,
    templateId: data.templateId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return c.json({ id }, 201);
});

// 글 수정
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  db.updatePost(id, { ...parsed.data, updatedAt: new Date().toISOString() });
  return c.json({ id });
});

// 글 삭제
app.delete("/:id", async (c) => {
  db.deletePost(c.req.param("id"));
  return c.json({ success: true });
});

// 즉시 발행
app.post("/:id/publish", async (c) => {
  const id = c.req.param("id");
  const post = db.getPost(id);
  if (!post) return c.json({ error: "글을 찾을 수 없습니다." }, 404);

  const account = db.getAccount(post.accountId);
  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  const job = await enqueuePublish({
    postId: post.id,
    accountId: post.accountId,
    blogId: account.blogId,
    title: post.title,
    content: post.content,
    category: post.category || undefined,
    tags: post.tags || undefined,
    visibility: post.visibility || "public",
  });

  db.insertJob({
    id: job.id!,
    postId: post.id,
    accountId: post.accountId,
    type: "publish",
    status: "waiting",
    result: null,
    error: null,
    screenshotPath: null,
    attempts: 0,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  });

  db.updatePost(id, { status: "queued" });
  return c.json({ jobId: job.id });
});

// 예약 발행
app.post("/:id/schedule", async (c) => {
  const id = c.req.param("id");
  const { scheduledAt } = await c.req.json<{ scheduledAt: string }>();
  if (!scheduledAt) return c.json({ error: "scheduledAt이 필요합니다." }, 400);

  const post = db.getPost(id);
  if (!post) return c.json({ error: "글을 찾을 수 없습니다." }, 404);

  const account = db.getAccount(post.accountId);
  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  const job = await enqueueScheduledPublish(
    {
      postId: post.id,
      accountId: post.accountId,
      blogId: account.blogId,
      title: post.title,
      content: post.content,
      category: post.category || undefined,
      tags: post.tags || undefined,
      visibility: post.visibility || "public",
    },
    new Date(scheduledAt),
  );

  db.insertJob({
    id: job.id!,
    postId: post.id,
    accountId: post.accountId,
    type: "scheduled_publish",
    status: "waiting",
    result: null,
    error: null,
    screenshotPath: null,
    attempts: 0,
    scheduledAt,
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  });

  db.updatePost(id, { status: "scheduled", scheduledAt });
  return c.json({ jobId: job.id });
});

// 예약 취소
app.delete("/:id/schedule", async (c) => {
  const id = c.req.param("id");
  const jobs = db.getJobs().filter((j) => j.postId === id && j.status === "waiting");
  for (const job of jobs) {
    await cancelScheduledJob(job.id);
    db.updateJob(job.id, { status: "cancelled" });
  }
  db.updatePost(id, { status: "draft", scheduledAt: null });
  return c.json({ success: true });
});

export default app;
