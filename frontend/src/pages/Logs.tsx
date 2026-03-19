import { useEffect, useState } from "react";
import { jobsApi, type Job } from "../api/client";
import StatusBadge from "../components/StatusBadge";

export default function Logs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Job | null>(null);

  useEffect(() => {
    jobsApi
      .list(statusFilter || undefined)
      .then(setJobs)
      .catch(console.error);
  }, [statusFilter]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold dark:text-white">작업 로그</h1>

      {/* 필터 */}
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">전체 상태</option>
          <option value="waiting">대기중</option>
          <option value="active">진행중</option>
          <option value="completed">완료</option>
          <option value="failed">실패</option>
        </select>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold dark:text-white">작업 상세</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p className="dark:text-gray-300">
                <strong>ID:</strong> {selected.id}
              </p>
              <p className="dark:text-gray-300">
                <strong>타입:</strong> {selected.type}
              </p>
              <p className="dark:text-gray-300">
                <strong>상태:</strong>{" "}
                <StatusBadge status={selected.status} />
              </p>
              <p className="dark:text-gray-300">
                <strong>시도 횟수:</strong> {selected.attempts}
              </p>
              {selected.error && (
                <div className="rounded bg-red-50 p-3 dark:bg-red-900/30">
                  <p className="font-medium text-red-700 dark:text-red-300">
                    에러:
                  </p>
                  <p className="text-red-600 dark:text-red-400">
                    {selected.error}
                  </p>
                </div>
              )}
              {selected.screenshotPath && (
                <p className="dark:text-gray-300">
                  <strong>스크린샷:</strong> {selected.screenshotPath}
                </p>
              )}
              {selected.result && (
                <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs dark:bg-gray-900 dark:text-gray-300">
                  {JSON.stringify(selected.result, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 font-medium dark:text-gray-300">ID</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">타입</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">상태</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">시도</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">생성일</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">에러</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {jobs.map((job) => (
              <tr
                key={job.id}
                className="cursor-pointer bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
                onClick={() => setSelected(job)}
              >
                <td className="px-4 py-3 font-mono text-xs dark:text-gray-300">
                  {job.id.slice(0, 8)}...
                </td>
                <td className="px-4 py-3 dark:text-gray-300">{job.type}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 dark:text-gray-300">{job.attempts}</td>
                <td className="px-4 py-3 dark:text-gray-300">
                  {new Date(job.createdAt).toLocaleString("ko-KR")}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-red-500">
                  {job.error || "-"}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  작업 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
