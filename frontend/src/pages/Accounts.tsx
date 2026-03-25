import { useEffect, useState } from "react";
import { accountsApi, type Account } from "../api/client";

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [blogId, setBlogId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    reload();
  }, []);

  function reload() {
    accountsApi.list().then(setAccounts).catch(console.error);
  }

  async function handleAdd() {
    if (!blogId || !displayName) return;
    await accountsApi.create({ blogId, displayName });
    setBlogId("");
    setDisplayName("");
    setShowAdd(false);
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 계정을 삭제하시겠습니까?")) return;
    await accountsApi.delete(id);
    reload();
  }

  async function handleLogin(id: string) {
    setActionLoading(id);
    try {
      const res = await accountsApi.login(id);
      alert(res.message);
      reload();
    } catch (err) {
      alert(`로그인 실패: ${err}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCheck(id: string) {
    setActionLoading(id);
    try {
      const res = await accountsApi.checkStatus(id);
      alert(res.message);
      reload();
    } catch (err) {
      alert(`확인 실패: ${err}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">계정 관리</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          계정 추가
        </button>
      </div>

      {/* 계정 추가 폼 */}
      {showAdd && (
        <div className="mb-6 rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="블로그 ID"
              value={blogId}
              onChange={(e) => setBlogId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="표시 이름"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={handleAdd}
              disabled={!blogId || !displayName}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              등록
            </button>
          </div>
        </div>
      )}

      {/* 계정 목록 */}
      <div className="space-y-3">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex items-center justify-between rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  acc.sessionValid ? "bg-green-500" : "bg-red-500"
                }`}
                title={acc.sessionValid ? "세션 활성" : "세션 만료"}
              />
              <div>
                <p className="font-medium dark:text-white">{acc.displayName}</p>
                <p className="text-sm text-gray-500">
                  블로그 ID: {acc.blogId}
                </p>
                <p className="text-xs text-gray-400">
                  {acc.sessionValid ? "세션 활성" : "세션 만료 — 로그인 필요"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleLogin(acc.id)}
                disabled={actionLoading === acc.id}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-400"
              >
                {actionLoading === acc.id ? "..." : "로그인"}
              </button>
              <button
                onClick={() => handleCheck(acc.id)}
                disabled={actionLoading === acc.id}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400"
              >
                세션 확인
              </button>
              <button
                onClick={() => handleDelete(acc.id)}
                disabled={actionLoading === acc.id}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="text-gray-500">
            등록된 계정이 없습니다. "계정 추가" 버튼을 클릭하세요.
          </p>
        )}
      </div>
    </div>
  );
}
