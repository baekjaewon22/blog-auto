import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";

const app = new Hono();

const templateSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional().default(""),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// 템플릿 목록
app.get("/", async (c) => c.json(db.getTemplates()));

// 템플릿 상세
app.get("/:id", async (c) => {
  const tmpl = db.getTemplate(c.req.param("id"));
  if (!tmpl) return c.json({ error: "템플릿을 찾을 수 없습니다." }, 404);
  return c.json(tmpl);
});

// 템플릿 생성
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = nanoid();
  db.insertTemplate({
    id,
    ...parsed.data,
    tags: parsed.data.tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return c.json({ id }, 201);
});

// 템플릿 수정
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = templateSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  db.updateTemplate(id, { ...parsed.data, updatedAt: new Date().toISOString() });
  return c.json({ id });
});

// 템플릿 삭제
app.delete("/:id", async (c) => {
  db.deleteTemplate(c.req.param("id"));
  return c.json({ success: true });
});

export default app;
