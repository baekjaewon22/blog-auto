import { useEffect, useState } from "react";
import { apikeysApi, type ApiKey, type CreateApiKey } from "../api/client";

const SERVICE_OPTIONS = [
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "claude", label: "Claude (Anthropic)" },
  { value: "dalle", label: "DALL-E" },
  { value: "gemini", label: "Gemini (Google)" },
  { value: "custom", label: "기타" },
];

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateApiKey>({
    name: "",
    service: "openai",
    apiKey: "",
    baseUrl: "",
  });

  useEffect(() => {
    reload();
  }, []);

  function reload() {
    apikeysApi.list().then(setKeys).catch(console.error);
  }

  function resetForm() {
    setForm({ name: "", service: "openai", apiKey: "", baseUrl: "" });
    setShowAdd(false);
    setEditId(null);
  }

  async function handleSave() {
    if (!form.name || !form.apiKey) return;
    if (editId) {
      await apikeysApi.update(editId, form);
    } else {
      await apikeysApi.create(form);
    }
    resetForm();
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 API 키를 삭제하시겠습니까?")) return;
    await apikeysApi.delete(id);
    reload();
  }

  function startEdit(key: ApiKey) {
    setEditId(key.id);
    setShowAdd(true);
    setForm({
      name: key.name,
      service: key.service,
      apiKey: "", // 보안상 비워둠
      baseUrl: key.baseUrl || "",
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">API 키 관리</h1>
        <button
          onClick={() => {
            resetForm();
            setShowAdd(!showAdd);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          API 키 추가
        </button>
      </div>

      {/* 안내 */}
      <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/30">
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          API 키는 암호화된 별도 파일에 저장됩니다. 목록에서는 마스킹된 키만 표시됩니다.
        </p>
      </div>

      {/* 추가/수정 폼 */}
      {showAdd && (
        <div className="mb-6 rounded-lg border bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold dark:text-white">
            {editId ? "API 키 수정" : "API 키 추가"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                이름
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 블로그 콘텐츠 생성용 GPT"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                서비스
              </label>
              <select
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {SERVICE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                API 키
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={editId ? "변경할 키를 입력 (비워두면 유지)" : "sk-..."}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            {form.service === "custom" && (
              <div>
                <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                  Base URL (선택)
                </label>
                <input
                  type="text"
                  value={form.baseUrl}
                  onChange={(e) =>
                    setForm({ ...form, baseUrl: e.target.value })
                  }
                  placeholder="https://api.example.com/v1"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={!form.name || (!editId && !form.apiKey)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editId ? "수정" : "등록"}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-white"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 키 목록 */}
      <div className="space-y-3">
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <div>
              <p className="font-medium dark:text-white">{key.name}</p>
              <p className="text-sm text-gray-500">
                {SERVICE_OPTIONS.find((o) => o.value === key.service)?.label ||
                  key.service}
              </p>
              <p className="font-mono text-xs text-gray-400">{key.apiKey}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(key)}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
              >
                수정
              </button>
              <button
                onClick={() => handleDelete(key.id)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
        {keys.length === 0 && (
          <p className="text-gray-500">
            등록된 API 키가 없습니다. "API 키 추가" 버튼을 클릭하세요.
          </p>
        )}
      </div>
    </div>
  );
}
