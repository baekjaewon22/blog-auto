import { Hono } from "hono";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH =
  process.env.SETTINGS_PATH ||
  path.resolve(__dirname, "../../../data/settings.json");

export interface AppSettings {
  // OpenAI 설정
  openai: {
    enabled: boolean;
    model: string; // gpt-4, gpt-3.5-turbo 등
  };
  // AI 포스팅 1
  aiPosting1: {
    enabled: boolean;
    position: string; // 본문1, 본문2, 서론, 결론
    prompt: string;
  };
  // AI 포스팅 2
  aiPosting2: {
    enabled: boolean;
    prompt: string;
  };
  // 이미지 폴더
  imageFolders: {
    startFolder: string; // 블로그 시작 이미지 폴더
    endFolder: string; // 블로그 마무리 이미지 폴더
  };
  // 포스팅 설정
  posting: {
    separatorStyle: string; // random, quote, vertical, bubble, line_quote
    publishInterval: number; // 발행 간격 (초)
    maxDailyPosts: number; // 일일 최대 발행 수
    autoImageInsert: boolean; // 자동 이미지 삽입
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  openai: {
    enabled: false,
    model: "gpt-4",
  },
  aiPosting1: {
    enabled: false,
    position: "본문1",
    prompt: "",
  },
  aiPosting2: {
    enabled: false,
    prompt: "",
  },
  imageFolders: {
    startFolder: "",
    endFolder: "",
  },
  posting: {
    separatorStyle: "quote",
    publishInterval: 300,
    maxDailyPosts: 5,
    autoImageInsert: false,
  },
};

function loadSettings(): AppSettings {
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings): void {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

const app = new Hono();

// 설정 조회
app.get("/", async (c) => {
  return c.json(loadSettings());
});

// 설정 저장 (전체)
app.put("/", async (c) => {
  const body = await c.req.json();
  const current = loadSettings();
  const merged = { ...current, ...body };
  saveSettings(merged);
  return c.json(merged);
});

// 섹션별 부분 저장
app.patch("/:section", async (c) => {
  const section = c.req.param("section") as keyof AppSettings;
  const body = await c.req.json();
  const current = loadSettings();
  if (section in current) {
    (current as any)[section] = { ...(current as any)[section], ...body };
    saveSettings(current);
  }
  return c.json(current);
});

export default app;
