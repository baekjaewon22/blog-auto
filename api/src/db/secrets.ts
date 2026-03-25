/**
 * 민감 정보(API 키) 별도 저장소.
 * data/secrets.enc.json 파일에 암호화하여 저장한다.
 * 암호화 키는 환경변수 SECRETS_KEY로 설정한다.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRETS_PATH =
  process.env.SECRETS_PATH ||
  path.resolve(__dirname, "../../../data/secrets.enc.json");

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.SECRETS_KEY || "blog-auto-default-key-change-me!!";
  // SHA-256으로 32바이트 키 생성
  return crypto.createHash("sha256").update(key).digest();
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export interface ApiKeyEntry {
  id: string;
  name: string; // 표시 이름 (e.g. "OpenAI GPT-4")
  service: string; // 서비스 종류 (e.g. "openai", "claude", "dalle", "custom")
  apiKey: string; // 암호화된 API 키
  baseUrl?: string; // 커스텀 엔드포인트 (선택)
  createdAt: string;
  updatedAt: string;
}

interface SecretsData {
  apiKeys: ApiKeyEntry[];
}

function loadSecrets(): SecretsData {
  if (!fs.existsSync(SECRETS_PATH)) {
    return { apiKeys: [] };
  }
  try {
    const raw = fs.readFileSync(SECRETS_PATH, "utf-8");
    const decrypted = decrypt(raw);
    return JSON.parse(decrypted);
  } catch {
    return { apiKeys: [] };
  }
}

function saveSecrets(data: SecretsData): void {
  fs.mkdirSync(path.dirname(SECRETS_PATH), { recursive: true });
  const json = JSON.stringify(data, null, 2);
  const encrypted = encrypt(json);
  fs.writeFileSync(SECRETS_PATH, encrypted, "utf-8");
}

export const secretsDb = {
  // API 키 목록 (키 값은 마스킹)
  getApiKeys(): Omit<ApiKeyEntry, "apiKey">[] {
    const data = loadSecrets();
    return data.apiKeys.map(({ apiKey, ...rest }) => ({
      ...rest,
      apiKey: apiKey.slice(0, 4) + "****" + apiKey.slice(-4),
    }));
  },

  // API 키 상세 (복호화된 실제 키 반환 — 내부용)
  getApiKeyDecrypted(id: string): ApiKeyEntry | undefined {
    const data = loadSecrets();
    return data.apiKeys.find((k) => k.id === id);
  },

  // API 키 추가
  addApiKey(entry: ApiKeyEntry): void {
    const data = loadSecrets();
    data.apiKeys.push(entry);
    saveSecrets(data);
  },

  // API 키 수정
  updateApiKey(id: string, updates: Partial<ApiKeyEntry>): void {
    const data = loadSecrets();
    const idx = data.apiKeys.findIndex((k) => k.id === id);
    if (idx >= 0) {
      data.apiKeys[idx] = { ...data.apiKeys[idx], ...updates };
      saveSecrets(data);
    }
  },

  // API 키 삭제
  deleteApiKey(id: string): void {
    const data = loadSecrets();
    data.apiKeys = data.apiKeys.filter((k) => k.id !== id);
    saveSecrets(data);
  },

  // 서비스별 API 키 조회 (내부용 — 실제 키 반환)
  getKeyByService(service: string): ApiKeyEntry | undefined {
    const data = loadSecrets();
    return data.apiKeys.find((k) => k.service === service);
  },
};
