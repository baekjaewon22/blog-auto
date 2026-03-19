import { useEffect, useState } from "react";
import { templatesApi, type Template, type CreateTemplate } from "../api/client";
import RichEditor from "../components/RichEditor";
import TagInput from "../components/TagInput";

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [form, setForm] = useState<CreateTemplate>({
    name: "",
    title: "",
    content: "",
    category: "",
    tags: [],
  });

  useEffect(() => {
    reload();
  }, []);

  function reload() {
    templatesApi.list().then(setTemplates).catch(console.error);
  }

  function startNew() {
    setEditing("new");
    setForm({ name: "", title: "", content: "", category: "", tags: [] });
  }

  function startEdit(tmpl: Template) {
    setEditing(tmpl.id);
    setForm({
      name: tmpl.name,
      title: tmpl.title,
      content: tmpl.content,
      category: tmpl.category || "",
      tags: tmpl.tags || [],
    });
  }

  async function handleSave() {
    if (editing === "new") {
      await templatesApi.create(form);
    } else if (editing) {
      await templatesApi.update(editing, form);
    }
    setEditing(null);
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;
    await templatesApi.delete(id);
    reload();
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold dark:text-white">
          {editing === "new" ? "템플릿 생성" : "템플릿 수정"}
        </h1>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">
              템플릿 이름
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">
              기본 제목
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">
              카테고리
            </label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">
              본문
            </label>
            <RichEditor
              content={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">
              태그
            </label>
            <TagInput
              tags={form.tags || []}
              onChange={(t) => setForm({ ...form, tags: t })}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!form.name || !form.content}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              저장
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-white"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">템플릿 관리</h1>
        <button
          onClick={startNew}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          새 템플릿
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <h3 className="mb-1 font-medium dark:text-white">{tmpl.name}</h3>
            {tmpl.title && (
              <p className="mb-2 text-sm text-gray-500">{tmpl.title}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(tmpl)}
                className="text-sm text-blue-600 hover:underline"
              >
                수정
              </button>
              <button
                onClick={() => handleDelete(tmpl.id)}
                className="text-sm text-red-600 hover:underline"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-gray-500">템플릿이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
