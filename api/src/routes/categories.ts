import { Hono } from "hono";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(__dirname, "../../../worker");
const PYTHON = process.env.PYTHON_PATH || "python3";

const app = new Hono();

// 계정의 블로그 카테고리 목록 조회
app.get("/:accountId", async (c) => {
  const accountId = c.req.param("accountId");

  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, accountId));

  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  return new Promise<Response>((resolve) => {
    const proc = spawn(
      PYTHON,
      ["category_fetcher.py", "--account-id", accountId, "--blog-id", account.blogId],
      { cwd: WORKER_DIR },
    );

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", () => {
      try {
        const result = JSON.parse(stdout);
        resolve(c.json(result));
      } catch {
        resolve(c.json({ error: "카테고리 조회 실패", detail: stderr }, 500));
      }
    });
  });
});

export default app;
