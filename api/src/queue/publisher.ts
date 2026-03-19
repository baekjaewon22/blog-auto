import { Queue } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const publishQueue = new Queue("publish", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 5 * 60 * 1000 }, // 5분 간격 재시도
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export interface PublishJobData {
  postId: string;
  accountId: string;
  blogId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  images?: string[];
  visibility?: string;
}

/** 즉시 발행 작업을 큐에 추가한다. */
export async function enqueuePublish(data: PublishJobData) {
  const job = await publishQueue.add("publish", data, {
    // 계정당 동시 1개만 실행되도록 그룹 키 설정
    group: { id: data.accountId },
  });
  return job;
}

/** 예약 발행 작업을 큐에 추가한다. */
export async function enqueueScheduledPublish(
  data: PublishJobData,
  scheduledAt: Date,
) {
  const delay = scheduledAt.getTime() - Date.now();
  if (delay < 0) {
    throw new Error("예약 시간이 현재 시간보다 과거입니다.");
  }

  const job = await publishQueue.add("scheduled_publish", data, {
    delay,
    group: { id: data.accountId },
  });
  return job;
}

/** 예약 작업을 취소한다. */
export async function cancelScheduledJob(jobId: string) {
  const job = await publishQueue.getJob(jobId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
}
