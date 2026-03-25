import { useEffect, useState, useCallback, useRef } from "react";
import {
  postsApi,
  accountsApi,
  jobsApi,
  runnerApi,
  type Post,
  type Account,
  type Job,
  type RunnerStatus,
  type ScheduleEntry,
} from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [runner, setRunner] = useState<RunnerStatus>({
    running: false,
    schedule: { enabled: false, times: [], nextRunAt: null },
    lastRunAt: null,
    publishedCount: 0,
  });
  const [scheduleInputs, setScheduleInputs] = useState<ScheduleEntry[]>([
    { hour: 9, minute: 0 },
  ]);
  const [actionLoading, setActionLoading] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: string; type: "success" | "error"; message: string }[]
  >([]);
  const prevJobsRef = useRef<Job[]>([]);

  function addNotification(type: "success" | "error", message: string) {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }

  const reload = useCallback(() => {
    postsApi.list().then(setPosts).catch(console.error);
    accountsApi.list().then(setAccounts).catch(console.error);
    jobsApi
      .list()
      .then((j) => setRecentJobs(j.slice(0, 10)))
      .catch(console.error);
    runnerApi.status().then(setRunner).catch(console.error);
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(() => {
      runnerApi.status().then(setRunner).catch(console.error);
      jobsApi
        .list()
        .then((jobs) => {
          const prev = prevJobsRef.current;
          // 새로 완료/실패된 작업 감지
          for (const job of jobs.slice(0, 20)) {
            const old = prev.find((p) => p.id === job.id);
            if (old && old.status !== job.status) {
              if (job.status === "completed") {
                addNotification("success", `발행 완료: ${job.postId.slice(0, 8)}...`);
              } else if (job.status === "failed") {
                addNotification("error", `발행 실패: ${job.error || "알 수 없는 오류"}`);
              }
            }
          }
          prevJobsRef.current = jobs;
          setRecentJobs(jobs.slice(0, 10));
        })
        .catch(console.error);
      postsApi.list().then(setPosts).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [reload]);

  async function handleResetFailed() {
    setActionLoading(true);
    try {
      const res = await runnerApi.resetFailed();
      addNotification("success", res.message);
      reload();
    } catch (e: any) {
      addNotification("error", `복원 실패: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStart() {
    setActionLoading(true);
    try {
      const res = await runnerApi.start();
      alert(res.message);
      reload();
    } catch (e: any) {
      alert(`실행 실패: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    setActionLoading(true);
    try {
      const res = await runnerApi.stop();
      alert(res.message);
      reload();
    } catch (e: any) {
      alert(`중지 실패: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSetSchedule() {
    if (scheduleInputs.length === 0) return;
    setActionLoading(true);
    try {
      const res = await runnerApi.setSchedule(scheduleInputs);
      alert(res.message);
      reload();
    } catch (e: any) {
      alert(`스케줄 설정 실패: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClearSchedule() {
    setActionLoading(true);
    try {
      const res = await runnerApi.clearSchedule();
      alert(res.message);
      reload();
    } catch (e: any) {
      alert(`스케줄 해제 실패: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  }

  function addScheduleTime() {
    setScheduleInputs([...scheduleInputs, { hour: 12, minute: 0 }]);
  }

  function removeScheduleTime(idx: number) {
    setScheduleInputs(scheduleInputs.filter((_, i) => i !== idx));
  }

  function updateScheduleTime(
    idx: number,
    field: "hour" | "minute",
    value: number,
  ) {
    const updated = [...scheduleInputs];
    updated[idx] = { ...updated[idx], [field]: value };
    setScheduleInputs(updated);
  }

  const draftCount = posts.filter((p) => p.status === "draft").length;
  const publishedCount = posts.filter((p) => p.status === "published").length;
  const failedCount = posts.filter((p) => p.status === "failed").length;
  const today = new Date().toISOString().slice(0, 10);
  const scheduledToday = posts.filter(
    (p) => p.status === "scheduled" && p.scheduledAt?.startsWith(today),
  );

  return (
    <div>
      {/* 알림 토스트 */}
      {notifications.length > 0 && (
        <div className="fixed right-4 top-4 z-50 space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`animate-slide-in rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
                n.type === "success"
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {n.type === "success" ? "V " : "X "}
              {n.message}
            </div>
          ))}
        </div>
      )}

      <h1 className="mb-6 text-2xl font-bold dark:text-white">대시보드</h1>

      {/* ─── 실행 패널 ─── */}
      <div className="mb-8 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:border-blue-800 dark:from-blue-900/30 dark:to-indigo-900/30">
        {/* 상단: 상태 + 즉시실행 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold dark:text-white">자동 포스팅</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              대기 중인 초안{" "}
              <strong className="text-blue-600">{draftCount}개</strong>
              {runner.running && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    실행 중
                  </span>
                </span>
              )}
            </p>
            {runner.lastRunAt && (
              <p className="mt-0.5 text-xs text-gray-500">
                마지막 실행:{" "}
                {new Date(runner.lastRunAt).toLocaleString("ko-KR")} | 총 발행:{" "}
                {runner.publishedCount}건
              </p>
            )}
          </div>

          <div className="flex gap-3">
            {(runner.failedCount || 0) > 0 && (
              <button
                onClick={handleResetFailed}
                disabled={actionLoading}
                className="rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow hover:bg-amber-600 disabled:opacity-50"
              >
                실패 글 복원 ({runner.failedCount})
              </button>
            )}
            {!runner.running ? (
              <button
                onClick={handleStart}
                disabled={actionLoading || draftCount === 0}
                className="rounded-lg bg-green-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-green-700 disabled:opacity-50"
              >
                즉시 실행
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={actionLoading}
                className="rounded-lg bg-red-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-red-700 disabled:opacity-50"
              >
                중지
              </button>
            )}
          </div>
        </div>

        {/* 하단: 스케줄 설정 */}
        <div className="mt-5 border-t border-blue-200 pt-5 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold dark:text-white">
              예약 스케줄
            </h3>
            {runner.schedule.enabled && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                활성
              </span>
            )}
          </div>

          {/* 현재 스케줄 상태 */}
          {runner.schedule.enabled && (
            <div className="mt-2 rounded-lg bg-white/70 p-3 dark:bg-gray-800/50">
              <p className="text-sm dark:text-gray-300">
                매일{" "}
                <strong>
                  {runner.schedule.times
                    .map(
                      (t) =>
                        `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
                    )
                    .join(", ")}
                </strong>{" "}
                에 자동 실행
              </p>
              {runner.schedule.nextRunAt && (
                <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
                  다음 실행:{" "}
                  {new Date(runner.schedule.nextRunAt).toLocaleString("ko-KR")}
                </p>
              )}
            </div>
          )}

          {/* 시각 입력 */}
          <div className="mt-3 space-y-2">
            {scheduleInputs.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={entry.hour}
                  onChange={(e) =>
                    updateScheduleTime(idx, "hour", parseInt(e.target.value))
                  }
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}시
                    </option>
                  ))}
                </select>
                <span className="dark:text-gray-400">:</span>
                <select
                  value={entry.minute}
                  onChange={(e) =>
                    updateScheduleTime(idx, "minute", parseInt(e.target.value))
                  }
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {[0, 10, 15, 20, 30, 40, 45, 50].map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}분
                    </option>
                  ))}
                </select>
                {scheduleInputs.length > 1 && (
                  <button
                    onClick={() => removeScheduleTime(idx)}
                    className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={addScheduleTime}
                className="rounded border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                + 시각 추가
              </button>

              {!runner.schedule.enabled ? (
                <button
                  onClick={handleSetSchedule}
                  disabled={actionLoading || scheduleInputs.length === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  스케줄 시작
                </button>
              ) : (
                <button
                  onClick={handleClearSchedule}
                  disabled={actionLoading}
                  className="rounded-lg bg-gray-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-600"
                >
                  스케줄 해제
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="전체 글" value={posts.length} color="blue" />
        <Card title="발행 완료" value={publishedCount} color="green" />
        <Card title="실패" value={failedCount} color="red" />
        <Card title="오늘 예약" value={scheduledToday.length} color="indigo" />
      </div>

      {/* 계정 상태 */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold dark:text-white">
          계정 상태
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div>
                <p className="font-medium dark:text-white">
                  {acc.displayName}
                </p>
                <p className="text-sm text-gray-500">{acc.blogId}</p>
              </div>
              <span
                className={`h-3 w-3 rounded-full ${
                  acc.sessionValid ? "bg-green-500" : "bg-red-500"
                }`}
              />
            </div>
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-gray-500">
              등록된 계정이 없습니다.{" "}
              <Link to="/accounts" className="text-blue-600 underline">
                계정 추가
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* 최근 작업 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold dark:text-white">
          최근 작업
        </h2>
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium dark:text-gray-300">
                  작업 ID
                </th>
                <th className="px-4 py-3 font-medium dark:text-gray-300">
                  타입
                </th>
                <th className="px-4 py-3 font-medium dark:text-gray-300">
                  상태
                </th>
                <th className="px-4 py-3 font-medium dark:text-gray-300">
                  생성일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {recentJobs.map((job) => (
                <tr key={job.id} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3 dark:text-gray-300">
                    {job.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 dark:text-gray-300">{job.type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 dark:text-gray-300">
                    {new Date(job.createdAt).toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))}
              {recentJobs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    작업 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30",
    green:
      "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/30",
    red: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30",
    indigo:
      "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/30",
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-3xl font-bold dark:text-white">{value}</p>
    </div>
  );
}
