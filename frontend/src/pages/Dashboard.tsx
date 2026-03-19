import { useEffect, useState } from "react";
import { postsApi, accountsApi, jobsApi } from "../api/client";
import type { Post, Account, Job } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);

  useEffect(() => {
    postsApi.list().then(setPosts).catch(console.error);
    accountsApi.list().then(setAccounts).catch(console.error);
    jobsApi.list().then((j) => setRecentJobs(j.slice(0, 10))).catch(console.error);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const scheduledToday = posts.filter(
    (p) => p.status === "scheduled" && p.scheduledAt?.startsWith(today),
  );

  const publishedCount = posts.filter((p) => p.status === "published").length;
  const failedCount = posts.filter((p) => p.status === "failed").length;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold dark:text-white">대시보드</h1>

      {/* 요약 카드 */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="전체 글" value={posts.length} color="blue" />
        <Card title="발행 완료" value={publishedCount} color="green" />
        <Card title="실패" value={failedCount} color="red" />
        <Card title="오늘 예약" value={scheduledToday.length} color="indigo" />
      </div>

      {/* 계정 상태 */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold dark:text-white">계정 상태</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div>
                <p className="font-medium dark:text-white">{acc.displayName}</p>
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

      {/* 오늘 예약 글 */}
      {scheduledToday.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold dark:text-white">
            오늘 발행 예정
          </h2>
          <div className="space-y-2">
            {scheduledToday.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
              >
                <span className="dark:text-white">{p.title}</span>
                <span className="text-sm text-gray-500">
                  {p.scheduledAt?.slice(11, 16)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 최근 작업 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold dark:text-white">최근 작업</h2>
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium dark:text-gray-300">작업 ID</th>
                <th className="px-4 py-3 font-medium dark:text-gray-300">타입</th>
                <th className="px-4 py-3 font-medium dark:text-gray-300">상태</th>
                <th className="px-4 py-3 font-medium dark:text-gray-300">생성일</th>
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
    green: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/30",
    red: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30",
    indigo: "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/30",
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-3xl font-bold dark:text-white">{value}</p>
    </div>
  );
}
