/**
 * 자동 포스팅 실행/스케줄 관리.
 *
 * - POST /api/runner/start       → 즉시 실행
 * - POST /api/runner/stop        → 실행/스케줄 모두 중지
 * - GET  /api/runner/status      → 현재 상태
 * - POST /api/runner/schedule    → 스케줄 설정 (시각 기반)
 * - DELETE /api/runner/schedule  → 스케줄 해제
 */
import { Hono } from "hono";
import { db } from "../db/index.js";
import {
  enqueuePublish,
  type PublishJobData,
} from "../queue/publisher.js";

const app = new Hono();

interface ScheduleEntry {
  hour: number;   // 0-23
  minute: number; // 0-59
}

interface RunnerState {
  running: boolean;
  schedule: {
    enabled: boolean;
    times: ScheduleEntry[];   // e.g. [{hour:9,minute:0},{hour:15,minute:30}]
    nextRunAt: string | null;
  };
  lastRunAt: string | null;
  publishedCount: number;
}

let state: RunnerState = {
  running: false,
  schedule: { enabled: false, times: [], nextRunAt: null },
  lastRunAt: null,
  publishedCount: 0,
};

let scheduleHandle: ReturnType<typeof setInterval> | null = null;

/** 대기중인 글(draft)을 순차적으로 큐에 넣는다. */
async function runPublishCycle() {
  const posts = db.getPosts().filter((p) => p.status === "draft");
  if (posts.length === 0) return 0;

  let queued = 0;
  for (const post of posts) {
    const account = db.getAccount(post.accountId);
    if (!account) continue;

    const jobData: PublishJobData = {
      postId: post.id,
      accountId: post.accountId,
      blogId: account.blogId,
      title: post.title,
      content: post.content,
      category: post.category || undefined,
      tags: post.tags || undefined,
      visibility: post.visibility || "public",
    };

    const job = await enqueuePublish(jobData);

    db.insertJob({
      id: job.id!,
      postId: post.id,
      accountId: post.accountId,
      type: "publish",
      status: "waiting",
      result: null,
      error: null,
      screenshotPath: null,
      attempts: 0,
      scheduledAt: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    });

    db.updatePost(post.id, { status: "queued" });
    queued++;
  }

  state.lastRunAt = new Date().toISOString();
  state.publishedCount += queued;
  return queued;
}

/** 다음 실행 시각을 계산한다. */
function calcNextRun(times: ScheduleEntry[]): Date | null {
  if (times.length === 0) return null;

  const now = new Date();
  const today = new Date(now);
  const candidates: Date[] = [];

  for (const t of times) {
    // 오늘 해당 시각
    const todayRun = new Date(today);
    todayRun.setHours(t.hour, t.minute, 0, 0);

    if (todayRun.getTime() > now.getTime()) {
      candidates.push(todayRun);
    }

    // 내일 해당 시각
    const tomorrowRun = new Date(today);
    tomorrowRun.setDate(tomorrowRun.getDate() + 1);
    tomorrowRun.setHours(t.hour, t.minute, 0, 0);
    candidates.push(tomorrowRun);
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] || null;
}

/** 스케줄 체커: 1분마다 현재 시각이 예약 시각과 일치하는지 확인 */
function startScheduleChecker() {
  stopScheduleChecker();

  scheduleHandle = setInterval(async () => {
    if (!state.schedule.enabled || state.running) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const matched = state.schedule.times.some(
      (t) => t.hour === currentHour && t.minute === currentMinute,
    );

    if (matched) {
      console.log(`[Runner] 스케줄 실행: ${currentHour}:${String(currentMinute).padStart(2, "0")}`);
      state.running = true;
      await runPublishCycle();
      state.running = false;
      updateNextRun();
    }
  }, 60 * 1000); // 1분마다 체크
}

function stopScheduleChecker() {
  if (scheduleHandle) {
    clearInterval(scheduleHandle);
    scheduleHandle = null;
  }
}

function updateNextRun() {
  const next = calcNextRun(state.schedule.times);
  state.schedule.nextRunAt = next ? next.toISOString() : null;
}

// 상태 조회
app.get("/status", (c) => {
  const drafts = db.getPosts().filter((p) => p.status === "draft").length;
  const failed = db.getPosts().filter((p) => p.status === "failed" || p.status === "publishing").length;
  return c.json({ ...state, draftCount: drafts, failedCount: failed });
});

// 실패/멈춘 글을 모두 draft로 리셋
app.post("/reset-failed", (c) => {
  const posts = db.getPosts().filter(
    (p) => p.status === "failed" || p.status === "publishing" || p.status === "queued",
  );
  for (const p of posts) {
    db.updatePost(p.id, { status: "draft" });
  }
  return c.json({ success: true, reset: posts.length, message: `${posts.length}개 글이 초안으로 복원되었습니다.` });
});

// 즉시 실행
app.post("/start", async (c) => {
  if (state.running) {
    return c.json({ error: "이미 실행 중입니다." }, 400);
  }

  state.running = true;
  const queued = await runPublishCycle();
  state.running = false;

  return c.json({
    success: true,
    queued,
    message: `${queued}개 글이 발행 큐에 추가되었습니다.`,
  });
});

// 중지 (즉시 실행 + 스케줄 모두)
app.post("/stop", (c) => {
  state.running = false;
  stopScheduleChecker();
  state.schedule.enabled = false;
  state.schedule.nextRunAt = null;
  return c.json({ success: true, message: "실행이 중지되었습니다." });
});

// 스케줄 설정 — 시각 기반 (예: [{hour:9,minute:0},{hour:15,minute:30}])
app.post("/schedule", async (c) => {
  const { times } = await c.req.json<{ times: ScheduleEntry[] }>();

  if (!times || times.length === 0) {
    return c.json({ error: "최소 1개 이상의 시각을 설정하세요." }, 400);
  }

  // 유효성 검사
  for (const t of times) {
    if (t.hour < 0 || t.hour > 23 || t.minute < 0 || t.minute > 59) {
      return c.json({ error: `잘못된 시각: ${t.hour}:${t.minute}` }, 400);
    }
  }

  state.schedule.enabled = true;
  state.schedule.times = times;
  updateNextRun();
  startScheduleChecker();

  const timeStr = times
    .map((t) => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`)
    .join(", ");

  return c.json({
    success: true,
    message: `스케줄 설정됨: 매일 ${timeStr} 실행`,
    nextRunAt: state.schedule.nextRunAt,
  });
});

// 스케줄 해제
app.delete("/schedule", (c) => {
  stopScheduleChecker();
  state.schedule.enabled = false;
  state.schedule.times = [];
  state.schedule.nextRunAt = null;
  return c.json({ success: true, message: "스케줄이 해제되었습니다." });
});

export default app;
