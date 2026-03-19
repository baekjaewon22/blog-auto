import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";

import postsRoutes from "./routes/posts.js";
import accountsRoutes from "./routes/accounts.js";
import jobsRoutes from "./routes/jobs.js";
import categoriesRoutes from "./routes/categories.js";
import templatesRoutes from "./routes/templates.js";
import { startWorker } from "./queue/worker.js";

const app = new Hono();

// 미들웨어
app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
  }),
);

// API 라우트
app.route("/api/posts", postsRoutes);
app.route("/api/accounts", accountsRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/categories", categoriesRoutes);
app.route("/api/templates", templatesRoutes);

// 정적 파일 서빙 (프론트엔드 빌드)
app.use("/*", serveStatic({ root: "../frontend/dist" }));

// 헬스 체크
app.get("/api/health", (c) => c.json({ status: "ok" }));

// BullMQ 워커 시작
startWorker();

const PORT = parseInt(process.env.PORT || "8080", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`);
});
