import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { postsApi, type Post } from "../api/client";
import StatusBadge from "../components/StatusBadge";

export default function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const statusFilter = searchParams.get("status") || "";

  useEffect(() => {
    postsApi
      .list(statusFilter || undefined)
      .then(setPosts)
      .catch(console.error);
  }, [statusFilter]);

  const filtered = search
    ? posts.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()),
      )
    : posts;

  async function handleDelete(id: string) {
    if (!confirm("이 글을 삭제하시겠습니까?")) return;
    await postsApi.delete(id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function handlePublish(id: string) {
    if (!confirm("이 글을 즉시 발행하시겠습니까?")) return;
    await postsApi.publish(id);
    const updated = await postsApi.list(statusFilter || undefined);
    setPosts(updated);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">글 관리</h1>
        <Link
          to="/posts/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          새 글 작성
        </Link>
      </div>

      {/* 필터 & 검색 */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            if (e.target.value) {
              setSearchParams({ status: e.target.value });
            } else {
              setSearchParams({});
            }
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">전체 상태</option>
          <option value="draft">초안</option>
          <option value="scheduled">예약</option>
          <option value="published">발행완료</option>
          <option value="failed">실패</option>
        </select>
        <input
          type="text"
          placeholder="제목 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 font-medium dark:text-gray-300">제목</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">카테고리</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">상태</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">예약시각</th>
              <th className="px-4 py-3 font-medium dark:text-gray-300">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {filtered.map((post) => (
              <tr key={post.id} className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 dark:text-white">{post.title}</td>
                <td className="px-4 py-3 text-gray-500">{post.category || "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={post.status} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {post.scheduledAt
                    ? new Date(post.scheduledAt).toLocaleString("ko-KR")
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      to={`/posts/${post.id}/edit`}
                      className="text-blue-600 hover:underline"
                    >
                      수정
                    </Link>
                    {post.status === "draft" && (
                      <button
                        onClick={() => handlePublish(post.id)}
                        className="text-green-600 hover:underline"
                      >
                        발행
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-red-600 hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  글이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
