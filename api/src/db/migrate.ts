/**
 * DB 초기화 스크립트 — 테이블이 없으면 생성한다.
 * drizzle-kit push 대신 직접 DDL을 실행하는 간단한 방식.
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH =
  process.env.DB_PATH ||
  path.resolve(__dirname, "../../../data/db.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    blog_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    session_valid INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT,
    visibility TEXT DEFAULT 'public',
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT,
    published_at TEXT,
    published_url TEXT,
    template_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT DEFAULT '',
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    type TEXT NOT NULL,
    status TEXT DEFAULT 'waiting',
    result TEXT,
    error TEXT,
    screenshot_path TEXT,
    attempts INTEGER DEFAULT 0,
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

console.log(`Database initialized at ${DB_PATH}`);
sqlite.close();
