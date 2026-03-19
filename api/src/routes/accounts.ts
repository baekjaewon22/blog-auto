import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(__dirname, "../../../worker");
const PYTHON = process.env.PYTHON_PATH || "python3";

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
    const proc = spawn(PYTHON, [script, ...args], { cwd: WORKER_DIR });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

// 계정 목록
app.get("/", async (c) => {
  const allAccounts = await db.select().from(schema.accounts);
  return c.json(allAccounts);
});

// 계정 등록
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const id = nanoid();
  await db.insert(schema.accounts).values({
    id,
    blogId: parsed.data.blogId,
    displayName: parsed.data.displayName,
    sessionValid: false,
  });

  return c.json({ id }, 201);
});

// 로그인 실행 (Python 스크립트로 브라우저 띄우기)
app.post("/:id/login", async (c) => {
  const id = c.req.param("id");
  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, id));

  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  const result = await runPythonScript("login.py", [
    "--account-id",
    id,
  ]);

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return c.json(
      { error: "로그인 스크립트 실행 실패", detail: result.stderr },
      500,
    );
  }

  if (parsed.success) {
    await db
      .update(schema.accounts)
      .set({ sessionValid: true, updatedAt: new Date().toISOString() })
      .where(eq(schema.accounts.id, id));
  }

  return c.json(parsed);
});

// 세션 상태 확인
app.get("/:id/status", async (c) => {
  const id = c.req.param("id");
  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, id));

  if (!account) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);

  const result = await runPythonScript("login.py", [
    "--account-id",
    id,
    "--check",
  ]);

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return c.json(
      { error: "세션 확인 실패", detail: result.stderr },
      500,
    );
  }

  await db
    .update(schema.accounts)
    .set({
      sessionValid: parsed.valid,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.accounts.id, id));

  return c.json(parsed);
});

export default app;
