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
