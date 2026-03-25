const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Posts
export const postsApi = {
  list: (status?: string) =>
    request<Post[]>(`/posts${status ? `?status=${status}` : ""}`),
  get: (id: string) => request<Post>(`/posts/${id}`),
  create: (data: CreatePost) =>
    request<{ id: string }>("/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CreatePost>) =>
    request<{ id: string }>(`/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/posts/${id}`, { method: "DELETE" }),
  publish: (id: string) =>
    request<{ jobId: string }>(`/posts/${id}/publish`, { method: "POST" }),
  schedule: (id: string, scheduledAt: string) =>
    request<{ jobId: string }>(`/posts/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ scheduledAt }),
    }),
  cancelSchedule: (id: string) =>
    request<{ success: boolean }>(`/posts/${id}/schedule`, {
      method: "DELETE",
    }),
};

// Accounts
export const accountsApi = {
  list: () => request<Account[]>("/accounts"),
  create: (data: { blogId: string; displayName: string }) =>
    request<{ id: string }>("/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/accounts/${id}`, { method: "DELETE" }),
  login: (id: string) =>
    request<{ success: boolean; message: string }>(`/accounts/${id}/login`, {
      method: "POST",
    }),
  checkStatus: (id: string) =>
    request<{ valid: boolean; message: string }>(`/accounts/${id}/status`),
};

// Jobs
export const jobsApi = {
  list: (status?: string) =>
    request<Job[]>(`/jobs${status ? `?status=${status}` : ""}`),
  get: (id: string) => request<Job>(`/jobs/${id}`),
};

// Categories
export const categoriesApi = {
  list: (accountId: string) =>
    request<{ success: boolean; categories: Category[] }>(
      `/categories/${accountId}`,
    ),
};

// Templates
export const templatesApi = {
  list: () => request<Template[]>("/templates"),
  get: (id: string) => request<Template>(`/templates/${id}`),
  create: (data: CreateTemplate) =>
    request<{ id: string }>("/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CreateTemplate>) =>
    request<{ id: string }>(`/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/templates/${id}`, { method: "DELETE" }),
};

// Types
export interface Post {
  id: string;
  accountId: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  visibility: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  createdAt: string;
}

export interface CreatePost {
  accountId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  visibility?: string;
}

export interface Account {
  id: string;
  blogId: string;
  displayName: string;
  sessionValid: boolean;
  updatedAt: string;
}

export interface Job {
  id: string;
  postId: string;
  accountId: string;
  type: string;
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
  screenshotPath: string | null;
  attempts: number;
  scheduledAt: string | null;
  createdAt: string;
}

export interface Category {
  name: string;
  id: string;
}

export interface Template {
  id: string;
  name: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  createdAt: string;
}

export interface CreateTemplate {
  name: string;
  title?: string;
  content: string;
  category?: string;
  tags?: string[];
}

// API Keys
export const apikeysApi = {
  list: () => request<ApiKey[]>("/apikeys"),
  create: (data: CreateApiKey) =>
    request<{ id: string }>("/apikeys", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CreateApiKey>) =>
    request<{ id: string }>(`/apikeys/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/apikeys/${id}`, { method: "DELETE" }),
};

export interface ApiKey {
  id: string;
  name: string;
  service: string;
  apiKey: string; // 마스킹됨
  baseUrl?: string;
  createdAt: string;
}

export interface CreateApiKey {
  name: string;
  service: string;
  apiKey: string;
  baseUrl?: string;
}

// Runner (자동 포스팅 실행/스케줄)
export const runnerApi = {
  status: () => request<RunnerStatus>("/runner/status"),
  start: () =>
    request<{ success: boolean; queued: number; message: string }>(
      "/runner/start",
      { method: "POST" },
    ),
  stop: () =>
    request<{ success: boolean; message: string }>("/runner/stop", {
      method: "POST",
    }),
  resetFailed: () =>
    request<{ success: boolean; reset: number; message: string }>(
      "/runner/reset-failed",
      { method: "POST" },
    ),
  setSchedule: (times: ScheduleEntry[]) =>
    request<{ success: boolean; message: string; nextRunAt: string }>(
      "/runner/schedule",
      { method: "POST", body: JSON.stringify({ times }) },
    ),
  clearSchedule: () =>
    request<{ success: boolean; message: string }>("/runner/schedule", {
      method: "DELETE",
    }),
};

export interface ScheduleEntry {
  hour: number;
  minute: number;
}

export interface RunnerStatus {
  running: boolean;
  schedule: {
    enabled: boolean;
    times: ScheduleEntry[];
    nextRunAt: string | null;
  };
  lastRunAt: string | null;
  publishedCount: number;
  draftCount?: number;
  failedCount?: number;
}

// AI 글 생성
export const generateApi = {
  generate: (topic: string, style?: string) =>
    request<{ content: string; model: string }>("/generate", {
      method: "POST",
      body: JSON.stringify({ topic, style }),
    }),
};

// Settings
export const settingsApi = {
  get: () => request<AppSettings>("/settings"),
  save: (data: AppSettings) =>
    request<AppSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  patch: (section: string, data: Record<string, unknown>) =>
    request<AppSettings>(`/settings/${section}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Folders (이미지 업로드/관리)
export const foldersApi = {
  list: (type: "start" | "end") =>
    request<{ images: FolderImage[]; count: number }>(`/folders/${type}`),
  upload: async (type: "start" | "end", files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const res = await fetch(`/api/folders/${type}/upload`, {
      method: "POST",
      body: formData,
    });
    return res.json() as Promise<{ uploaded: string[]; count: number }>;
  },
  delete: (type: "start" | "end", name: string) =>
    request<{ success: boolean }>(`/folders/${type}/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
};

export interface FolderImage {
  name: string;
  size: number;
  url: string;
}

export interface AppSettings {
  openai: {
    enabled: boolean;
    model: string;
  };
  aiPosting1: {
    enabled: boolean;
    position: string;
    prompt: string;
  };
  aiPosting2: {
    enabled: boolean;
    prompt: string;
  };
  imageFolders: {
    startFolder: string;
    endFolder: string;
  };
  posting: {
    separatorStyle: string;
    publishInterval: number;
    maxDailyPosts: number;
    autoImageInsert: boolean;
  };
}
