import { Hono } from "hono";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_BASE = path.resolve(__dirname, "../../../data/images");

// 시작/마무리 이미지 폴더
const FOLDERS: Record<string, string> = {
  start: path.join(UPLOAD_BASE, "start"),
  end: path.join(UPLOAD_BASE, "end"),
};

// 폴더 초기화
for (const dir of Object.values(FOLDERS)) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = new Hono();

// 이미지 목록 조회
app.get("/:type", async (c) => {
  const type = c.req.param("type"); // "start" or "end"
  const dir = FOLDERS[type];
  if (!dir) return c.json({ error: "잘못된 폴더 타입" }, 400);

  const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir)
        .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
        .map((f) => ({
          name: f,
          size: fs.statSync(path.join(dir, f)).size,
          url: `/api/folders/${type}/file/${encodeURIComponent(f)}`,
        }))
    : [];

  return c.json({ images: files, count: files.length });
});

// 이미지 파일 서빙 (미리보기용)
app.get("/:type/file/:name", async (c) => {
  const type = c.req.param("type");
  const name = decodeURIComponent(c.req.param("name"));
  const dir = FOLDERS[type];
  if (!dir) return c.json({ error: "잘못된 폴더 타입" }, 400);

  const filePath = path.join(dir, name);
  if (!fs.existsSync(filePath)) return c.json({ error: "파일 없음" }, 404);

  const ext = path.extname(name).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };

  const buffer = fs.readFileSync(filePath);
  return new Response(buffer, {
    headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
  });
});

// 이미지 업로드 (multipart/form-data)
app.post("/:type/upload", async (c) => {
  const type = c.req.param("type");
  const dir = FOLDERS[type];
  if (!dir) return c.json({ error: "잘못된 폴더 타입" }, 400);

  const body = await c.req.parseBody({ all: true });
  const files = Array.isArray(body["files"]) ? body["files"] : body["files"] ? [body["files"]] : [];

  const uploaded: string[] = [];
  for (const file of files) {
    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, "_");
      const filePath = path.join(dir, safeName);
      fs.writeFileSync(filePath, buffer);
      uploaded.push(safeName);
    }
  }

  return c.json({ uploaded, count: uploaded.length });
});

// 이미지 삭제
app.delete("/:type/:name", async (c) => {
  const type = c.req.param("type");
  const name = decodeURIComponent(c.req.param("name"));
  const dir = FOLDERS[type];
  if (!dir) return c.json({ error: "잘못된 폴더 타입" }, 400);

  const filePath = path.join(dir, name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return c.json({ success: true });
});

export default app;
export { FOLDERS };
