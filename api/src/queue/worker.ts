import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { db } from "../db/index.js";
import { secretsDb } from "../db/secrets.js";
import type { PublishJobData } from "./publisher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(__dirname, "../../../worker");
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const PYTHON = process.env.PYTHON_PATH || "python";
const SETTINGS_PATH =
  process.env.SETTINGS_PATH ||
  path.resolve(__dirname, "../../../data/settings.json");

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

function loadSettings(): Record<string, any> {
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function loadApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  try {
    // 등록된 모든 서비스의 키를 복호화하여 전달
    for (const service of ["openai", "claude", "gemini", "custom"]) {
      const entry = secretsDb.getKeyByService(service);
      if (entry) {
        keys[service] = entry.apiKey;
        if (entry.baseUrl) keys[`${service}_base_url`] = entry.baseUrl;
      }
    }
  } catch {
    // 키가 없으면 빈 객체
  }
  return keys;
}

function runPythonPublish(data: Record<string, any>): Promise<{
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

    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    proc.on("close", (code) => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        if (code === 0) resolve({ success: true });
        else reject(new Error(stderr || `Python exited with code ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

async function processJob(job: Job<PublishJobData>) {
  const { postId } = job.data;

  db.updateJob(job.id!, { status: "active", startedAt: new Date().toISOString() });
  db.updatePost(postId, { status: "publishing" });

  // 설정 + API 키를 로드하여 Python에 함께 전달
  const settings = loadSettings();
  const apiKeys = loadApiKeys();

  const publishConfig = {
    ...job.data,
    settings,
    apiKeys,
  };

  const result = await runPythonPublish(publishConfig);

  if (result.success) {
    db.updateJob(job.id!, {
      status: "completed",
      result: JSON.stringify(result),
      completedAt: new Date().toISOString(),
    });
    db.updatePost(postId, {
      status: "published",
      publishedAt: new Date().toISOString(),
      publishedUrl: result.url || null,
    });
  } else {
    throw new Error(result.error || "발행 실패");
  }
  return result;
}

export function startWorker() {
  const worker = new Worker<PublishJobData>("publish", processJob, {
    connection,
    concurrency: 1,
    limiter: { max: 1, duration: 5 * 60 * 1000 },
  });

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    console.error(`[Worker] Job ${job.id} failed: ${err.message}`);
    db.updateJob(job.id!, {
      status: "failed",
      error: err.message,
      attempts: job.attemptsMade || 0,
      completedAt: new Date().toISOString(),
    });
    db.updatePost(job.data.postId, { status: "failed" });
  });

  console.log("[Worker] Publish worker started");
  return worker;
}
