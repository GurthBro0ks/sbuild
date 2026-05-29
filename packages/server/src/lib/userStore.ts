import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { repoRoot } from "./paths.js";

export type UserRole = "admin" | "user";

export interface SBuildUser {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  disabled?: boolean;
}

let _usersFilePath: string | undefined;

export function setUsersFilePath(filePath: string): void {
  _usersFilePath = filePath;
}

export function getUsersFilePath(): string {
  return _usersFilePath || path.join(repoRoot, "project", "users.json");
}

function generateId(): string {
  return crypto.randomUUID();
}

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const N = 16384;
  const r = 8;
  const p = 1;
  const keyLen = 32;
  const derived = crypto.scryptSync(plain, salt, keyLen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, encodedHash: string): boolean {
  const parts = encodedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const derived = crypto.scryptSync(plain, salt, expected.length, { N: n, r, p });
  return crypto.timingSafeEqual(derived, expected);
}

function loadUsersRaw(): SBuildUser[] {
  const fp = getUsersFilePath();
  try {
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, "utf8");
    return JSON.parse(raw) as SBuildUser[];
  } catch {
    return [];
  }
}

function saveUsersRaw(users: SBuildUser[]): void {
  const fp = getUsersFilePath();
  const dir = path.dirname(fp);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(users, null, 2), "utf8");
}

export function findUserByUsername(username: string): SBuildUser | undefined {
  return loadUsersRaw().find((u) => u.username === username && !u.disabled);
}

export function findUserById(id: string): SBuildUser | undefined {
  return loadUsersRaw().find((u) => u.id === id && !u.disabled);
}

export function listUsers(): Omit<SBuildUser, "passwordHash">[] {
  return loadUsersRaw().map(({ passwordHash: _, ...rest }) => rest);
}

export function createUser(username: string, plainPassword: string, role: UserRole = "user"): SBuildUser {
  const users = loadUsersRaw();
  if (users.some((u) => u.username === username)) {
    throw new Error(`User "${username}" already exists`);
  }
  const user: SBuildUser = {
    id: generateId(),
    username,
    passwordHash: hashPassword(plainPassword),
    role,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsersRaw(users);
  return user;
}

export function updateUserPassword(id: string, newPlainPassword: string): boolean {
  const users = loadUsersRaw();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return false;
  users[idx].passwordHash = hashPassword(newPlainPassword);
  saveUsersRaw(users);
  return true;
}

export function disableUser(id: string): boolean {
  const users = loadUsersRaw();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return false;
  const adminCount = users.filter((u) => u.role === "admin" && u.id !== id && !u.disabled).length;
  if (users[idx].role === "admin" && adminCount < 1) {
    throw new Error("Cannot disable the only admin account");
  }
  users[idx].disabled = true;
  saveUsersRaw(users);
  return true;
}

export function migrateFromEnv(): void {
  const existing = loadUsersRaw();
  if (existing.length > 0) return;
  const envUser = String(process.env.SBUILD_AUTH_USERNAME || "").trim();
  const envHash = String(process.env.SBUILD_AUTH_PASSWORD_HASH || "").trim();
  if (!envUser || !envHash) {
    createUser("admin", "admin", "admin");
    return;
  }
  const adminUser: SBuildUser = {
    id: generateId(),
    username: envUser === "sbuilder" ? "admin" : envUser,
    passwordHash: envHash,
    role: "admin",
    createdAt: new Date().toISOString(),
  };
  saveUsersRaw([adminUser]);
}
