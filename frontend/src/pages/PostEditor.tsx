import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  postsApi,
  accountsApi,
  templatesApi,
  generateApi,
  type Account,
  type Template,
} from "../api/client";
import RichEditor from "../components/RichEditor";
import TagInput from "../components/TagInput";
import CategorySelect from "../components/CategorySelect";
import SchedulePicker from "../components/SchedulePicker";

export default function PostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [accountId, setAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState("public");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  // AI 생성
  const [topic, setTopic] = useState("");
  const [aiStyle, setAiStyle] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    accountsApi.list().then(setAccounts).catch(console.error);
    templatesApi.list().then(setTemplates).catch(console.error);

    if (isEdit) {
      postsApi.get(id).then((post) => {
        setAccountId(post.accountId);
        setTitle(post.title);
        setContent(post.content);
        setCategory(post.category || "");
        setTags(post.tags || []);
        setVisibility(post.visibility || "public");
        if (post.scheduledAt) {
          setScheduleMode(true);
          setScheduledAt(post.scheduledAt.slice(0, 16));
        }
      });
    }
  }, [id, isEdit]);

  function loadTemplate(templateId: string) {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    setTitle(tmpl.title || "");
    setContent(tmpl.content);
    setCategory(tmpl.category || "");
    setTags(tmpl.tags || []);
  }

  async function handleGenerate() {
    if (!topic) return;
    setGenerating(true);
    try {
      const res = await generateApi.generate(topic, aiStyle);
      setContent(res.content);
      if (!title) setTitle(topic); // 제목이 비어있으면 주제로 채움
    } catch (err: any) {
      alert(`AI 생성 실패: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = { accountId, title, content, category, tags, visibility };
      if (isEdit) {
        await postsApi.update(id, data);
      } else {
        await postsApi.create(data);
      }
      navigate("/posts");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    try {
      let postId = id;
      const data = { accountId, title, content, category, tags, visibility };
      if (isEdit) {
        await postsApi.update(id, data);
      } else {
        const res = await postsApi.create(data);
        postId = res.id;
      }
      await postsApi.publish(postId!);
      navigate("/posts");
    } finally {
      setSaving(false);
    }
  }

  async function handleSchedule() {
    if (!scheduledAt) {
      alert("예약 시간을 선택하세요.");
      return;
    }
    setSaving(true);
    try {
      let postId = id;
      const data = { accountId, title, content, category, tags, visibility };
      if (isEdit) {
        await postsApi.update(id, data);
      } else {
        const res = await postsApi.create(data);
        postId = res.id;
      }
      await postsApi.schedule(postId!, new Date(scheduledAt).toISOString());
      navigate("/posts");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold dark:text-white">
        {isEdit ? "글 수정" : "새 글 작성"}
      </h1>

      <div className="space-y-5">
        {/* ─── AI 글 생성 ─── */}
        <div className="rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
          <h2 className="mb-3 text-sm font-bold text-indigo-700 dark:text-indigo-300">
            AI 글 생성
          </h2>
          <div className="space-y-3">
            <div>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="주제 또는 키워드를 입력하세요 (예: 제주도 3박4일 여행 후기)"
                className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm dark:border-indigo-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <input
                type="text"
                value={aiStyle}
                onChange={(e) => setAiStyle(e.target.value)}
                placeholder="스타일 지시 (선택, 예: 20대 여성 블로거 느낌으로)"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !topic}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? "AI 글 생성 중..." : "AI로 글 생성"}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              설정에서 등록한 API 키와 AI 프롬프트가 적용됩니다.
            </p>
          </div>
        </div>

        {/* 템플릿 선택 */}
        {!isEdit && templates.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">
              템플릿에서 불러오기
            </label>
            <select
              onChange={(e) => loadTemplate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">선택 안 함</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 발행 계정 */}
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">
            발행 계정
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">계정 선택</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.displayName} ({acc.blogId})
              </option>
            ))}
          </select>
        </div>

        {/* 제목 */}
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="글 제목을 입력하세요"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* 카테고리 */}
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">
            카테고리
          </label>
          <CategorySelect
            accountId={accountId}
            value={category}
            onChange={setCategory}
          />
        </div>

        {/* 본문 에디터 */}
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">
            본문
          </label>
          <RichEditor content={content} onChange={setContent} />
        </div>

        {/* 태그 */}
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">
            태그
          </label>
          <TagInput tags={tags} onChange={setTags} />
        </div>

        {/* 공개 설정 */}
        <div>
          <label className="mb-1 block text-sm font-medium dark:text-gray-300">
            공개 설정
          </label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="public">전체공개</option>
            <option value="neighbor">이웃공개</option>
            <option value="private">비공개</option>
          </select>
        </div>

        {/* 예약 발행 */}
        {scheduleMode && (
          <div>
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">
              예약 시간
            </label>
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex flex-wrap gap-3 border-t pt-5 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving || !accountId || !title}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
          >
            임시저장
          </button>
          <button
            onClick={handlePublish}
            disabled={saving || !accountId || !title}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            즉시 발행
          </button>
          {!scheduleMode ? (
            <button
              onClick={() => setScheduleMode(true)}
              disabled={saving || !accountId || !title}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              예약 발행
            </button>
          ) : (
            <>
              <button
                onClick={handleSchedule}
                disabled={saving || !accountId || !title || !scheduledAt}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                예약 확정
              </button>
              <button
                onClick={() => {
                  setScheduleMode(false);
                  setScheduledAt("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400"
              >
                예약 취소
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
