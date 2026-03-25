import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { secretsDb } from "../db/secrets.js";

const app = new Hono();

const createApiKeySchema = z.object({
  name: z.string().min(1),
  service: z.enum(["openai", "claude", "dalle", "gemini", "custom"]),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
});

// API 키 목록 (마스킹된 키)
app.get("/", async (c) => {
  return c.json(secretsDb.getApiKeys());
});

// API 키 등록
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = nanoid();
  secretsDb.addApiKey({
    id,
    name: parsed.data.name,
    service: parsed.data.service,
    apiKey: parsed.data.apiKey,
    baseUrl: parsed.data.baseUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return c.json({ id }, 201);
});

// API 키 수정
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = createApiKeySchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  secretsDb.updateApiKey(id, {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  });

  return c.json({ id });
});

// API 키 삭제
app.delete("/:id", async (c) => {
  secretsDb.deleteApiKey(c.req.param("id"));
  return c.json({ success: true });
});

export default app;
