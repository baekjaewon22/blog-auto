import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH =
  process.env.DB_PATH ||
  path.resolve(__dirname, "../../../data/db.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// JSON file-based DB (no native dependencies needed)
// Stores data as JSON files — simple and portable

interface DbData {
  accounts: Record<string, any>[];
  posts: Record<string, any>[];
  templates: Record<string, any>[];
  jobs: Record<string, any>[];
}

const DB_JSON_PATH = DB_PATH.replace(".sqlite", ".json");

function loadDb(): DbData {
  if (fs.existsSync(DB_JSON_PATH)) {
    return JSON.parse(fs.readFileSync(DB_JSON_PATH, "utf-8"));
  }
  return { accounts: [], posts: [], templates: [], jobs: [] };
}

function saveDb(data: DbData): void {
  fs.writeFileSync(DB_JSON_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export const db = {
  get data() {
    return loadDb();
  },

  // Accounts
  getAccounts(): any[] {
    return loadDb().accounts;
  },
  getAccount(id: string): any | undefined {
    return loadDb().accounts.find((a) => a.id === id);
  },
  insertAccount(account: any): void {
    const data = loadDb();
    data.accounts.push(account);
    saveDb(data);
  },
  deleteAccount(id: string): void {
    const data = loadDb();
    data.accounts = data.accounts.filter((a) => a.id !== id);
    saveDb(data);
  },
  updateAccount(id: string, updates: Record<string, any>): void {
    const data = loadDb();
    const idx = data.accounts.findIndex((a) => a.id === id);
    if (idx >= 0) data.accounts[idx] = { ...data.accounts[idx], ...updates };
    saveDb(data);
  },

  // Posts
  getPosts(): any[] {
    return loadDb().posts.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },
  getPost(id: string): any | undefined {
    return loadDb().posts.find((p) => p.id === id);
  },
  insertPost(post: any): void {
    const data = loadDb();
    data.posts.push(post);
    saveDb(data);
  },
  updatePost(id: string, updates: Record<string, any>): void {
    const data = loadDb();
    const idx = data.posts.findIndex((p) => p.id === id);
    if (idx >= 0) data.posts[idx] = { ...data.posts[idx], ...updates };
    saveDb(data);
  },
  deletePost(id: string): void {
    const data = loadDb();
    data.posts = data.posts.filter((p) => p.id !== id);
    saveDb(data);
  },

  // Templates
  getTemplates(): any[] {
    return loadDb().templates.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },
  getTemplate(id: string): any | undefined {
    return loadDb().templates.find((t) => t.id === id);
  },
  insertTemplate(template: any): void {
    const data = loadDb();
    data.templates.push(template);
    saveDb(data);
  },
  updateTemplate(id: string, updates: Record<string, any>): void {
    const data = loadDb();
    const idx = data.templates.findIndex((t) => t.id === id);
    if (idx >= 0) data.templates[idx] = { ...data.templates[idx], ...updates };
    saveDb(data);
  },
  deleteTemplate(id: string): void {
    const data = loadDb();
    data.templates = data.templates.filter((t) => t.id !== id);
    saveDb(data);
  },

  // Jobs
  getJobs(): any[] {
    return loadDb().jobs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },
  getJob(id: string): any | undefined {
    return loadDb().jobs.find((j) => j.id === id);
  },
  insertJob(job: any): void {
    const data = loadDb();
    data.jobs.push(job);
    saveDb(data);
  },
  updateJob(id: string, updates: Record<string, any>): void {
    const data = loadDb();
    const idx = data.jobs.findIndex((j) => j.id === id);
    if (idx >= 0) data.jobs[idx] = { ...data.jobs[idx], ...updates };
    saveDb(data);
  },
};
