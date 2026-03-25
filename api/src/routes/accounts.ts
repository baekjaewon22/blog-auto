import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(__dirname, "../../../worker");
const PYTHON = process.env.PYTHON_PATH || "python";

const app = new Hono();

const createAccountSchema = z.object({
  blogId: z.string().min(1),
  displayName: z.string().min(1),
});

function runPythonScript(
  script: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON, [script, ...args], {
      cwd: WORKER_DIR,
      shell: true,
      windowsHide: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

// 계정 목록
app.get("/", async (c) => {
  return c.json(db.getAccounts());
});

// 계정 등록
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = nanoid();
  db.insertAccount({
    id,
    blogId: parsed.data.blogId,
    displayName: parsed.data.displayName,
    sessionValid: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return c.json({ id }, 201);
});

// 계정 삭제
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  db.deleteAccount(id);
  return c.json({ success: true });
});

// 로그인 실행
app.post("/:id/login", async (c) => {
  const id = c.req.param("id");
  const account = db.getAccount(id);
  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  const result = await runPythonScript("login.py", ["--account-id", id]);
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return c.json({ error: "로그인 스크립트 실행 실패", detail: result.stderr }, 500);
  }

  if (parsed.success) {
    db.updateAccount(id, { sessionValid: true, updatedAt: new Date().toISOString() });
  }
  return c.json(parsed);
});

// 세션 상태 확인
app.get("/:id/status", async (c) => {
  const id = c.req.param("id");
  const account = db.getAccount(id);
  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  const result = await runPythonScript("login.py", ["--account-id", id, "--check"]);
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return c.json({ error: "세션 확인 실패", detail: result.stderr }, 500);
  }

  db.updateAccount(id, { sessionValid: parsed.valid, updatedAt: new Date().toISOString() });
  return c.json(parsed);
});

export default app;
