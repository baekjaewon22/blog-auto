const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "초안", className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  queued: { label: "대기중", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  scheduled: { label: "예약", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  publishing: { label: "발행중", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
  published: { label: "발행완료", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  failed: { label: "실패", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  // Job statuses
  waiting: { label: "대기", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  active: { label: "진행중", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
  completed: { label: "완료", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || {
    label: status,
    className: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
