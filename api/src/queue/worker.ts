import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import type { PublishJobData } from "./publisher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(__dirname, "../../../worker");
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const PYTHON = process.env.PYTHON_PATH || "python3";

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

/** Python 발행 스크립트를 실행하고 결과를 반환한다. */
function runPythonPublish(data: PublishJobData): Promise<{
  success: boolean;
  url?: string;
  error?: string;
  screenshot?: string;
}> {
  return new Promise((resolve, reject) => {
    const configJson = JSON.stringify(data);
    const proc = spawn(PYTHON, ["publish.py", "--config", configJson], {
      cwd: WORKER_DIR,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch {
        if (code === 0) {
          resolve({ success: true });
        } else {
          reject(new Error(stderr || `Python process exited with code ${code}`));
        }
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

async function processJob(job: Job<PublishJobData>) {
  const { postId, accountId } = job.data;

  // 작업 시작 기록
  await db
    .update(schema.jobs)
    .set({ status: "active", startedAt: new Date().toISOString() })
    .where(eq(schema.jobs.id, job.id!));

  await db
    .update(schema.posts)
    .set({ status: "publishing" })
    .where(eq(schema.posts.id, postId));

  const result = await runPythonPublish(job.data);

  if (result.success) {
    // 성공
    await db
      .update(schema.jobs)
      .set({
        status: "completed",
        result: JSON.stringify(result),
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.jobs.id, job.id!));

    await db
      .update(schema.posts)
      .set({
        status: "published",
        publishedAt: new Date().toISOString(),
        publishedUrl: result.url || null,
      })
      .where(eq(schema.posts.id, postId));
  } else {
    throw new Error(result.error || "발행 실패");
  }

  return result;
}

export function startWorker() {
  const worker = new Worker<PublishJobData>("publish", processJob, {
    connection,
    concurrency: 1, // 전체 동시 실행 1개
    limiter: {
      max: 1,
      duration: 5 * 60 * 1000, // 5분당 1개 (봇 탐지 방지)
    },
  });

  worker.on("completed", async (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    console.error(`[Worker] Job ${job.id} failed: ${err.message}`);

    await db
      .update(schema.jobs)
      .set({
        status: "failed",
        error: err.message,
        attempts: (job.attemptsMade || 0),
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.jobs.id, job.id!));

    await db
      .update(schema.posts)
      .set({ status: "failed" })
      .where(eq(schema.posts.id, job.data.postId));
  });

  console.log("[Worker] Publish worker started");
  return worker;
}
