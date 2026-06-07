import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.js";

export interface PersistedChatItem {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  provider?: string;
  model?: string;
  source?: string;
  latencyMs?: number;
}

interface ProjectHistory {
  messages: PersistedChatItem[];
}

type UserHistory = Record<string, ProjectHistory>;
type HistoryStore = Record<string, UserHistory>;

const historyFile = path.join(repoRoot, "data", "ai-chat-history.json");
const MAX_MESSAGES_PER_PROJECT = 100;

function sanitizeChatText(text: string): string {
  let t = String(text || "");
  t = t.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted-api-key]");
  t = t.replace(/\b(Bearer\s+)[A-Za-z0-9._-]{16,}\b/gi, "$1[redacted-token]");
  t = t.replace(/\b(api[_-]?key\s*[:=]\s*)([^\s,;]+)/gi, "$1[redacted]");
  t = t.replace(/\b(x-api-key\s*[:=]\s*)([^\s,;]+)/gi, "$1[redacted]");
  t = t.replace(/https?:\/\/discord\.com\/api\/webhooks\/[^\s]+/gi, "[redacted-webhook]");
  t = t.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, (m) => {
    if (/^sk-|^Bearer/i.test(m)) return m;
    return m.slice(0, 4) + "...[redacted]";
  });
  return t.trim();
}

function load(): HistoryStore {
  try {
    return JSON.parse(fs.readFileSync(historyFile, "utf-8"));
  } catch {
    return {};
  }
}

function save(store: HistoryStore): void {
  const dir = path.dirname(historyFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(historyFile, JSON.stringify(store, null, 2));
}

function projectKey(userId: string, projectPath?: string): string {
  const p = (projectPath || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return p || "default";
}

export function getChatHistory(userId: string, projectPath?: string): PersistedChatItem[] {
  const store = load();
  const pk = projectKey(userId, projectPath);
  return store[userId]?.[pk]?.messages || [];
}

export function appendChatHistory(userId: string, projectPath: string | undefined, items: PersistedChatItem[]): void {
  if (!items.length) return;
  const store = load();
  if (!store[userId]) store[userId] = {};
  const pk = projectKey(userId, projectPath);
  if (!store[userId][pk]) store[userId][pk] = { messages: [] };
  const entry = store[userId][pk];
  for (const item of items) {
    entry.messages.push({
      ...item,
      text: sanitizeChatText(item.text)
    });
  }
  entry.messages = entry.messages.slice(-MAX_MESSAGES_PER_PROJECT);
  save(store);
}

export function clearChatHistory(userId: string, projectPath?: string): void {
  const store = load();
  const pk = projectKey(userId, projectPath);
  if (store[userId]?.[pk]) {
    delete store[userId][pk];
    if (Object.keys(store[userId]).length === 0) delete store[userId];
    save(store);
  }
}

export function replaceChatHistory(userId: string, projectPath: string | undefined, messages: PersistedChatItem[]): void {
  const store = load();
  if (!store[userId]) store[userId] = {};
  const pk = projectKey(userId, projectPath);
  store[userId][pk] = { messages: messages.slice(-MAX_MESSAGES_PER_PROJECT) };
  save(store);
}

export { sanitizeChatText };
