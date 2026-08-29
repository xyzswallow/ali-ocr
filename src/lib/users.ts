import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { getDatabase } from "@/lib/db";
import type { User, UserWithHash } from "@/lib/types";

export const SESSION_COOKIE = "ali_ocr_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_LENGTH = 64;

/** 认证流程中可以直接展示给用户的错误。 */
export class AuthError extends Error {}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: "member" | "admin";
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

export function createUser(
  email: string,
  password: string,
  displayName: string,
  role: "member" | "admin" = "member",
): User {
  const user: UserRow = {
    id: randomUUID(),
    email: normalizeEmail(email),
    password_hash: hashPassword(password),
    display_name: displayName.trim(),
    role,
    created_at: new Date().toISOString(),
  };
  try {
    getDatabase()
      .prepare(
        "INSERT INTO users (id,email,password_hash,display_name,role,created_at) VALUES (?,?,?,?,?,?)",
      )
      .run(user.id, user.email, user.password_hash, user.display_name, user.role, user.created_at);
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("UNIQUE")) {
      throw new AuthError("该邮箱已被注册，请直接登录。");
    }
    throw cause;
  }
  return toUser(user);
}

export function findUserByEmail(email: string): UserWithHash | null {
  const row = getDatabase()
    .prepare("SELECT * FROM users WHERE email=?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
}

export function findUserById(id: string): User | null {
  const row = getDatabase().prepare("SELECT * FROM users WHERE id=?").get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function countUsers() {
  const row = getDatabase().prepare("SELECT COUNT(*) AS total FROM users").get() as { total: number };
  return row.total;
}

function tokenKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  getDatabase()
    .prepare("INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)")
    .run(tokenKey(token), userId, expiresAt.toISOString(), new Date().toISOString());
  return { token, expiresAt };
}

export function findSessionUser(token: string): User | null {
  const key = tokenKey(token);
  const row = getDatabase()
    .prepare("SELECT user_id, expires_at FROM sessions WHERE id=?")
    .get(key) as { user_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    getDatabase().prepare("DELETE FROM sessions WHERE id=?").run(key);
    return null;
  }
  return findUserById(row.user_id);
}

export function deleteSession(token: string) {
  getDatabase().prepare("DELETE FROM sessions WHERE id=?").run(tokenKey(token));
}

export function deleteExpiredSessions() {
  getDatabase().prepare("DELETE FROM sessions WHERE expires_at<=?").run(new Date().toISOString());
}
