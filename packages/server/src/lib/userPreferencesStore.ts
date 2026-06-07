import fs from "node:fs/promises";
import path from "node:path";
import { projectFile } from "./paths.js";

type BuilderTheme = "Light" | "Dark";

type UserPreferenceRecord = {
  builderUiTheme?: BuilderTheme;
  updatedAt?: string;
};

type UserPreferencesFile = Record<string, UserPreferenceRecord>;

const preferencesFile = path.join(path.dirname(projectFile), "user-preferences.json");

async function loadAllPreferences(): Promise<UserPreferencesFile> {
  try {
    const raw = await fs.readFile(preferencesFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as UserPreferencesFile;
  } catch {
    return {};
  }
}

async function saveAllPreferences(next: UserPreferencesFile): Promise<void> {
  await fs.mkdir(path.dirname(preferencesFile), { recursive: true });
  await fs.writeFile(preferencesFile, JSON.stringify(next, null, 2), "utf8");
}

export async function getUserPreferences(username: string): Promise<UserPreferenceRecord> {
  const all = await loadAllPreferences();
  return all[username] || {};
}

export async function setUserBuilderTheme(username: string, theme: BuilderTheme): Promise<UserPreferenceRecord> {
  const all = await loadAllPreferences();
  const current = all[username] || {};
  const next: UserPreferenceRecord = {
    ...current,
    builderUiTheme: theme,
    updatedAt: new Date().toISOString()
  };
  all[username] = next;
  await saveAllPreferences(all);
  return next;
}

export function normalizeBuilderTheme(input: unknown): BuilderTheme {
  return String(input || "").trim().toLowerCase() === "dark" ? "Dark" : "Light";
}
