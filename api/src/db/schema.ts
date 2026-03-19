import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  blogId: text("blog_id").notNull(),
  displayName: text("display_name").notNull(),
  sessionValid: integer("session_valid", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags"), // JSON array string
  visibility: text("visibility").default("public"),
  status: text("status").default("draft"), // draft, scheduled, published, failed
  scheduledAt: text("scheduled_at"),
  publishedAt: text("published_at"),
  publishedUrl: text("published_url"),
  templateId: text("template_id"),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").default(""),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags"),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  type: text("type").notNull(), // publish, scheduled_publish
  status: text("status").default("waiting"), // waiting, active, completed, failed
  result: text("result"), // JSON string
  error: text("error"),
  screenshotPath: text("screenshot_path"),
  attempts: integer("attempts").default(0),
  scheduledAt: text("scheduled_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").default("(datetime('now'))"),
});
