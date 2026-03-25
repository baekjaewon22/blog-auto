import { Hono } from "hono";
import { db } from "../db/index.js";

const app = new Hono();

// 작업 목록
app.get("/", async (c) => {
  const status = c.req.query("status");
  let jobs = db.getJobs();
  if (status) jobs = jobs.filter((j) => j.status === status);
  return c.json(jobs);
});

// 작업 상세
app.get("/:id", async (c) => {
  const job = db.getJob(c.req.param("id"));
  if (!job) return c.json({ error: "작업을 찾을 수 없습니다." }, 404);
  return c.json(job);
});

export default app;
