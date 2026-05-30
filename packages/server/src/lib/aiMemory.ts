import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.js";

interface MemoryEntry {
  summaries: string[];
  lastChatAt: number;
}

type MemoryStore = Record<string, MemoryEntry>;

const memoryFile = path.join(repoRoot, "data", "ai-memory.json");

function load(): MemoryStore {
  try {
    return JSON.parse(fs.readFileSync(memoryFile, "utf-8"));
  } catch {
    return {};
  }
}

function save(store: MemoryStore): void {
  const dir = path.dirname(memoryFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(memoryFile, JSON.stringify(store, null, 2));
}

function sanitizeSummary(summary: string): string {
  let text = String(summary || "");
  text = text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted-api-key]");
  text = text.replace(/\b(Bearer\s+)[A-Za-z0-9._-]{16,}\b/gi, "$1[redacted-token]");
  text = text.replace(/\b(api[_-]?key\s*[:=]\s*)([^\s,;]+)/gi, "$1[redacted]");
  text = text.replace(/\b(x-api-key\s*[:=]\s*)([^\s,;]+)/gi, "$1[redacted]");
  return text.trim();
}

export function getMemoryForUser(username: string): MemoryEntry {
  const store = load();
  return store[username] || { summaries: [], lastChatAt: 0 };
}

export function appendMemoryForUser(username: string, summary: string): void {
  const sanitized = sanitizeSummary(summary);
  if (!sanitized) return;
  const store = load();
  if (!store[username]) store[username] = { summaries: [], lastChatAt: 0 };
  const entry = store[username];
  entry.summaries = [...entry.summaries.slice(-49), sanitized];
  entry.lastChatAt = Date.now();
  save(store);
}

export function clearMemoryForUser(username: string): void {
  const store = load();
  delete store[username];
  save(store);
}
