import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";

const app = new Hono();

// 작업 목록
app.get("/", async (c) => {
  const status = c.req.query("status");
  const allJobs = await db
    .select()
    .from(schema.jobs)
    .orderBy(desc(schema.jobs.createdAt));

  const filtered = status
    ? allJobs.filter((j) => j.status === status)
    : allJobs;

  return c.json(
    filtered.map((j) => ({
      ...j,
      result: j.result ? JSON.parse(j.result) : null,
    })),
  );
});

// 작업 상세
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, id));

  if (!job) return c.json({ error: "작업을 찾을 수 없습니다." }, 404);

  return c.json({
    ...job,
    result: job.result ? JSON.parse(job.result) : null,
  });
});

export default app;
