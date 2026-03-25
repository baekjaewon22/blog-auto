/**
 * AI 콘텐츠 생성 엔드포인트.
 * 등록된 API 키 + 설정된 프롬프트로 블로그 글을 자동 생성한다.
 */
import { Hono } from "hono";
import { z } from "zod";
import { secretsDb } from "../db/secrets.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH =
  process.env.SETTINGS_PATH ||
  path.resolve(__dirname, "../../../data/settings.json");

function loadSettings(): Record<string, any> {
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

const app = new Hono();

const generateSchema = z.object({
  topic: z.string().min(1),
  style: z.string().optional(), // 추가 스타일 지시 (선택)
});

interface ChatMessage {
  role: string;
  content: string;
}

/** OpenAI API 호출 */
async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096, temperature: 0.7 }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error?.message || "OpenAI API 오류");
  return data.choices[0].message.content;
}

/** Claude API 호출 */
async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  userMessage: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error?.message || "Claude API 오류");
  return data.content[0].text;
}

/** Gemini API 호출 */
async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error?.message || "Gemini API 오류");
  return data.candidates[0].content.parts[0].text;
}

// AI 글 생성
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { topic, style } = parsed.data;
  const settings = loadSettings();
  const model = settings.openai?.model || "gpt-4";

  // AI 포스팅1 프롬프트를 시스템 프롬프트로 사용
  const ai1 = settings.aiPosting1 || {};
  const basePrompt = ai1.prompt || "";

  const systemPrompt = `너는 블로그 글만 출력하는 기계다. 블로그 본문 텍스트만 출력해라. 그 외 어떤 말도 하지 마라.

절대 금지 (하나라도 어기면 실패):
- 인사말, 자기소개 금지 ("안녕하세요" 같은 것 쓰지 마)
- 이모지 절대 금지
- 마크다운 서식 금지 (**, ##, - 목록 금지)
- "다른 주제도 가능합니다", "알려주세요", "작성해드리겠습니다" 같은 AI 응답 금지
- "꿀팁", "강추", "완벽한", "핵심 포인트" 같은 AI 냄새 표현 금지
- 메타 코멘트 금지 (글에 대한 설명, 분석, 제안 일체 금지)
- 마지막에 "도움이 되셨으면", "궁금한 점은" 같은 마무리 멘트 금지

출력 형식:
- 블로그 글 본문 텍스트만 출력
- 줄바꿈으로 단락 구분
- 1000~1500자
- 실제 경험한 사람이 쓰는 솔직한 후기 톤
- 제목은 쓰지 마라 (본문만)
${basePrompt ? `\n추가 지시:\n${basePrompt}` : ""}
${style ? `\n문체:\n${style}` : ""}`;

  const userMessage = `주제: ${topic}\n\n위 주제로 블로그 본문만 써라. 다른 말 하지 마라.`;

  try {
    let content: string;

    if (model.startsWith("gpt")) {
      const key = secretsDb.getKeyByService("openai");
      if (!key) return c.json({ error: "OpenAI API 키가 등록되지 않았습니다. 설정에서 API 키를 등록하세요." }, 400);
      content = await callOpenAI(key.apiKey, model, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ]);
    } else if (model.startsWith("claude")) {
      const key = secretsDb.getKeyByService("claude");
      if (!key) return c.json({ error: "Claude API 키가 등록되지 않았습니다. 설정에서 API 키를 등록하세요." }, 400);
      content = await callClaude(key.apiKey, model, systemPrompt, userMessage);
    } else if (model.startsWith("gemini")) {
      const key = secretsDb.getKeyByService("gemini");
      if (!key) return c.json({ error: "Gemini API 키가 등록되지 않았습니다. 설정에서 API 키를 등록하세요." }, 400);
      content = await callGemini(key.apiKey, model, `${systemPrompt}\n\n${userMessage}`);
    } else {
      return c.json({ error: `지원하지 않는 모델: ${model}` }, 400);
    }

    // AI 포스팅2 프롬프트로 추가 변환
    const ai2 = settings.aiPosting2 || {};
    if (ai2.enabled && ai2.prompt) {
      try {
        if (model.startsWith("gpt")) {
          const key = secretsDb.getKeyByService("openai")!;
          content = await callOpenAI(key.apiKey, model, [
            { role: "system", content: ai2.prompt },
            { role: "user", content },
          ]);
        } else if (model.startsWith("claude")) {
          const key = secretsDb.getKeyByService("claude")!;
          content = await callClaude(key.apiKey, model, ai2.prompt, content);
        }
      } catch {
        // AI2 실패 시 AI1 결과 그대로 사용
      }
    }

    return c.json({ content, model });
  } catch (err: any) {
    return c.json({ error: err.message || "AI 생성 실패" }, 500);
  }
});

export default app;
