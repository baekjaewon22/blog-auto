import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";

const app = new Hono();

const templateSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional().default(""),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// 템플릿 목록
app.get("/", async (c) => {
  const all = await db
    .select()
    .from(schema.templates)
    .orderBy(desc(schema.templates.createdAt));
  return c.json(
    all.map((t) => ({
      ...t,
      tags: t.tags ? JSON.parse(t.tags) : [],
    })),
  );
});

// 템플릿 상세
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [tmpl] = await db
    .select()
    .from(schema.templates)
    .where(eq(schema.templates.id, id));
  if (!tmpl) return c.json({ error: "템플릿을 찾을 수 없습니다." }, 404);
  return c.json({ ...tmpl, tags: tmpl.tags ? JSON.parse(tmpl.tags) : [] });
});

// 템플릿 생성
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = nanoid();
  await db.insert(schema.templates).values({
    id,
    name: parsed.data.name,
    title: parsed.data.title,
    content: parsed.data.content,
    category: parsed.data.category || null,
    tags: parsed.data.tags ? JSON.stringify(parsed.data.tags) : null,
  });

  return c.json({ id }, 201);
});

// 템플릿 수정
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = templateSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const data = parsed.data;
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);

  await db
    .update(schema.templates)
    .set(updateData)
    .where(eq(schema.templates.id, id));

  return c.json({ id });
});

// 템플릿 삭제
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(schema.templates).where(eq(schema.templates.id, id));
  return c.json({ success: true });
});

export default app;
