import { useEffect, useState } from "react";
import { useCallback, useRef } from "react";
import {
  settingsApi,
  apikeysApi,
  foldersApi,
  type AppSettings,
  type ApiKey,
  type CreateApiKey,
  type FolderImage,
} from "../api/client";

const TABS = [
  { id: "ai", label: "AI 설정" },
  { id: "image", label: "이미지 폴더" },
  { id: "posting", label: "포스팅 설정" },
];

const AI_SERVICES = [
  { value: "openai", label: "OpenAI (GPT)", models: ["gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] },
  { value: "claude", label: "Claude (Anthropic)", models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-opus-4-20250514"] },
  { value: "gemini", label: "Gemini (Google)", models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"] },
  { value: "custom", label: "기타 (직접입력)", models: [] },
];

const AI_POSITIONS = ["본문1", "본문2", "서론", "결론", "전체"];

const SEPARATOR_STYLES = [
  { value: "random", label: "랜덤" },
  { value: "quote", label: "따옴표" },
  { value: "vertical", label: "버티컬 라인" },
  { value: "bubble", label: "말풍선" },
  { value: "line_quote", label: "라인&따옴표" },
];

const defaultSettings: AppSettings = {
  openai: { enabled: false, model: "gpt-4" },
  aiPosting1: { enabled: false, position: "본문1", prompt: "" },
  aiPosting2: { enabled: false, prompt: "" },
  imageFolders: { startFolder: "", endFolder: "" },
  posting: {
    separatorStyle: "quote",
    publishInterval: 300,
    maxDailyPosts: 5,
    autoImageInsert: false,
  },
};

export default function Settings() {
  const [tab, setTab] = useState("ai");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 새 키 입력용
  const [addingService, setAddingService] = useState<string | null>(null);
  const [keyForm, setKeyForm] = useState<CreateApiKey>({
    name: "",
    service: "openai",
    apiKey: "",
    baseUrl: "",
  });

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(console.error);
    apikeysApi.list().then(setKeys).catch(console.error);
  }, []);

  // 등록된 키에 맞는 모델이 아니면 자동 변경
  useEffect(() => {
    if (keys.length === 0) return;
    const availableModels = AI_SERVICES.flatMap((svc) =>
      keys.some((k) => k.service === svc.value) ? svc.models : [],
    );
    if (availableModels.length > 0 && !availableModels.includes(settings.openai.model)) {
      update("openai", "model", availableModels[0]);
    }
  }, [keys, settings.openai.model]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await settingsApi.save(settings);
      setSettings(res);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveKey() {
    if (!keyForm.apiKey) return;
    if (addingService === "edit") {
      // 수정 모드 — 기존 키 삭제 후 재등록
    }
    await apikeysApi.create(keyForm);
    setAddingService(null);
    setKeyForm({ name: "", service: "openai", apiKey: "", baseUrl: "" });
    apikeysApi.list().then(setKeys);
  }

  async function handleDeleteKey(id: string) {
    if (!confirm("이 API 키를 삭제하시겠습니까?")) return;
    await apikeysApi.delete(id);
    apikeysApi.list().then(setKeys);
  }

  function startAddKey(service: string) {
    const svc = AI_SERVICES.find((s) => s.value === service);
    setAddingService(service);
    setKeyForm({
      name: svc?.label || service,
      service,
      apiKey: "",
      baseUrl: "",
    });
  }

  function update<K extends keyof AppSettings>(
    section: K,
    field: string,
    value: unknown,
  ) {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  }

  // 현재 선택된 서비스의 모델 목록
  const selectedService = AI_SERVICES.find(
    (s) => keys.some((k) => k.service === s.value),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">설정</h1>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">
              저장되었습니다
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="mb-6 flex gap-1 rounded-lg border bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-white text-blue-700 shadow dark:bg-gray-700 dark:text-blue-300"
                : "text-gray-600 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── AI 설정 탭 ─── */}
      {tab === "ai" && (
        <div className="space-y-6">
          {/* API 키 관리 */}
          <Section title="API 키 관리">
            <div className="space-y-3">
              {AI_SERVICES.map((svc) => {
                const existing = keys.find((k) => k.service === svc.value);
                return (
                  <div
                    key={svc.value}
                    className="flex items-center justify-between rounded-lg border bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          existing ? "bg-green-500" : "bg-gray-300 dark:bg-gray-500"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium dark:text-white">
                          {svc.label}
                        </p>
                        {existing && (
                          <p className="font-mono text-xs text-gray-400">
                            {existing.apiKey}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {existing ? (
                        <>
                          <button
                            onClick={() => startAddKey(svc.value)}
                            className="rounded px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                          >
                            변경
                          </button>
                          <button
                            onClick={() => handleDeleteKey(existing.id)}
                            className="rounded px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            삭제
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startAddKey(svc.value)}
                          className="rounded bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"
                        >
                          키 등록
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* 키 입력 폼 */}
              {addingService && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="mb-3 text-sm font-medium dark:text-white">
                    {AI_SERVICES.find((s) => s.value === addingService)?.label}{" "}
                    API 키 입력
                  </p>
                  <div className="space-y-3">
                    <input
                      type="password"
                      value={keyForm.apiKey}
                      onChange={(e) =>
                        setKeyForm({ ...keyForm, apiKey: e.target.value })
                      }
                      placeholder={
                        addingService === "openai"
                          ? "sk-proj-..."
                          : addingService === "claude"
                            ? "sk-ant-..."
                            : "API 키를 입력하세요"
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    {addingService === "custom" && (
                      <input
                        type="text"
                        value={keyForm.baseUrl}
                        onChange={(e) =>
                          setKeyForm({ ...keyForm, baseUrl: e.target.value })
                        }
                        placeholder="Base URL (https://api.example.com/v1)"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveKey}
                        disabled={!keyForm.apiKey}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setAddingService(null)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:text-gray-300"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    API 키는 암호화된 별도 파일에 저장됩니다.
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* 모델 선택 */}
          <Section title="AI 모델 설정">
            <div>
              <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                사용할 모델
              </label>
              <select
                value={settings.openai.model}
                onChange={(e) => update("openai", "model", e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {AI_SERVICES.flatMap((svc) => {
                  const hasKey = keys.some((k) => k.service === svc.value);
                  if (!hasKey || svc.models.length === 0) return [];
                  return [
                    <optgroup key={svc.value} label={svc.label}>
                      {svc.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </optgroup>,
                  ];
                })}
                {keys.length === 0 && (
                  <option value="" disabled>
                    먼저 API 키를 등록하세요
                  </option>
                )}
              </select>
            </div>
          </Section>

          {/* AI 포스팅 1 */}
          <Section title="AI 포스팅 1">
            <div className="space-y-4">
              <Toggle
                label="AI 포스팅1 사용"
                checked={settings.aiPosting1.enabled}
                onChange={(v) => update("aiPosting1", "enabled", v)}
              />
              {settings.aiPosting1.enabled && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                      AI 포스팅1 사용 위치
                    </label>
                    <select
                      value={settings.aiPosting1.position}
                      onChange={(e) =>
                        update("aiPosting1", "position", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      {AI_POSITIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                      AI 포스팅1에 사용할 질문을 적어보세요.
                    </label>
                    <textarea
                      value={settings.aiPosting1.prompt}
                      onChange={(e) =>
                        update("aiPosting1", "prompt", e.target.value)
                      }
                      rows={5}
                      placeholder="내용을 보는 사람들이 쉽게 세련되게 전문가가 작성한느낌으로 변경해주고 다녀온 것 처럼 작성해주세요."
                      className="w-full rounded-lg border border-gray-300 bg-blue-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* AI 포스팅 2 */}
          <Section title="AI 포스팅 2">
            <div className="space-y-4">
              <Toggle
                label="AI 포스팅2 사용"
                checked={settings.aiPosting2.enabled}
                onChange={(v) => update("aiPosting2", "enabled", v)}
              />
              {settings.aiPosting2.enabled && (
                <div>
                  <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                    AI 포스팅2에 사용할 질문을 적어보세요.
                  </label>
                  <textarea
                    value={settings.aiPosting2.prompt}
                    onChange={(e) =>
                      update("aiPosting2", "prompt", e.target.value)
                    }
                    rows={5}
                    placeholder="AI 포스팅2에 사용할 질문을 적어보세요."
                    className="w-full rounded-lg border border-gray-300 bg-blue-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ─── 이미지 폴더 탭 ─── */}
      {tab === "image" && (
        <div className="space-y-6">
          <Section title="블로그 시작 이미지">
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              블로그 글 시작 부분에 자동 삽입할 이미지를 등록하세요. 발행 시 랜덤 1장이 선택됩니다.
            </p>
            <ImageUploadZone type="start" />
          </Section>

          <Section title="블로그 마무리 이미지">
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              블로그 글 마무리에 자동 삽입할 이미지를 등록하세요. 발행 시 랜덤 1장이 선택됩니다.
            </p>
            <ImageUploadZone type="end" />
          </Section>

          <Section title="자동 삽입 설정">
            <div className="space-y-3">
              <Toggle
                label="자동 이미지 삽입"
                checked={settings.posting.autoImageInsert}
                onChange={(v) => update("posting", "autoImageInsert", v)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                활성화하면 발행 시 시작 이미지에서 랜덤 1장을 글 앞에,
                마무리 이미지에서 랜덤 1장을 글 뒤에 자동 삽입합니다.
              </p>
            </div>
          </Section>
        </div>
      )}

      {/* ─── 포스팅 설정 탭 ─── */}
      {tab === "posting" && (
        <div className="space-y-6">
          <Section title="구분선 스타일">
            <div className="space-y-3">
              <select
                value={settings.posting.separatorStyle}
                onChange={(e) =>
                  update("posting", "separatorStyle", e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {SEPARATOR_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="mb-2 text-xs text-gray-500">미리보기:</p>
                <SeparatorPreview style={settings.posting.separatorStyle} />
              </div>
            </div>
          </Section>

          <Section title="발행 제한">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                  발행 간격 (초)
                </label>
                <input
                  type="number"
                  value={settings.posting.publishInterval}
                  onChange={(e) =>
                    update(
                      "posting",
                      "publishInterval",
                      parseInt(e.target.value) || 300,
                    )
                  }
                  min={60}
                  max={3600}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  봇 탐지 방지를 위해 최소 60초 이상 권장 (기본: 300초)
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                  일일 최대 발행 수
                </label>
                <input
                  type="number"
                  value={settings.posting.maxDailyPosts}
                  onChange={(e) =>
                    update(
                      "posting",
                      "maxDailyPosts",
                      parseInt(e.target.value) || 5,
                    )
                  }
                  min={1}
                  max={30}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">
                  계정당 하루 최대 발행 횟수 (기본: 5회)
                </p>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

/* ─── 공통 컴포넌트 ─── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </div>
      <span className="text-sm font-medium dark:text-gray-300">{label}</span>
    </label>
  );
}

function ImageUploadZone({ type }: { type: "start" | "end" }) {
  const [images, setImages] = useState<FolderImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    reload();
  }, [type]);

  function reload() {
    foldersApi.list(type).then((res) => setImages(res.images));
  }

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) return;

      setUploading(true);
      try {
        await foldersApi.upload(type, imageFiles);
        reload();
      } finally {
        setUploading(false);
      }
    },
    [type],
  );

  async function handleDelete(name: string) {
    await foldersApi.delete(type, name);
    reload();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return (
    <div className="space-y-3">
      {/* 드래그앤드롭 영역 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 hover:border-gray-400 dark:border-gray-600"
        }`}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {uploading
            ? "업로드 중..."
            : "클릭하거나 이미지를 드래그하여 등록"}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          JPG, PNG, GIF, WebP 지원
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* 등록된 이미지 목록 */}
      {images.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            등록된 이미지 ({images.length}개)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.name}
                className="group relative overflow-hidden rounded-lg border dark:border-gray-700"
              >
                <img
                  src={`/api${img.url}`}
                  alt={img.name}
                  className="h-24 w-full object-cover"
                />
                <div className="flex items-center justify-between bg-white px-2 py-1 dark:bg-gray-800">
                  <span className="truncate text-xs text-gray-500" title={img.name}>
                    {img.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatSize(img.size)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(img.name);
                  }}
                  className="absolute right-1 top-1 hidden rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white hover:bg-red-600 group-hover:block"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && (
        <p className="text-center text-sm text-gray-400">
          등록된 이미지가 없습니다
        </p>
      )}
    </div>
  );
}

function SeparatorPreview({ style }: { style: string }) {
  const previews: Record<string, React.ReactNode> = {
    random: (
      <p className="text-center text-gray-400 italic">
        (발행 시 랜덤 스타일 적용)
      </p>
    ),
    quote: (
      <div className="border-l-4 border-gray-300 py-2 pl-4 text-gray-600 dark:border-gray-600 dark:text-gray-400">
        "구분선 - 따옴표 스타일"
      </div>
    ),
    vertical: (
      <div className="text-center">
        <div className="mx-auto h-12 w-px bg-gray-400" />
      </div>
    ),
    bubble: (
      <div className="mx-auto max-w-xs rounded-xl bg-gray-100 p-3 text-center text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        말풍선 스타일 구분선
      </div>
    ),
    line_quote: (
      <div className="space-y-1 text-center">
        <hr className="border-gray-300 dark:border-gray-600" />
        <p className="text-sm text-gray-500">"라인 & 따옴표"</p>
        <hr className="border-gray-300 dark:border-gray-600" />
      </div>
    ),
  };
  return <>{previews[style] || previews.quote}</>;
}
