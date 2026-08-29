import { describe, expect, it } from "vitest";
import {
  AuthError,
  createSession,
  createUser,
  findSessionUser,
  findUserByEmail,
  hashPassword,
  verifyPassword,
} from "@/lib/users";
import { getDatabase } from "@/lib/db";

describe("password hashing", () => {
  it("verifies a matching password and rejects a wrong one", () => {
    const stored = hashPassword("correct-horse");
    expect(verifyPassword("correct-horse", stored)).toBe(true);
    expect(verifyPassword("wrong-horse", stored)).toBe(false);
  });

  it("rejects a malformed stored hash", () => {
    expect(verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});

describe("user accounts", () => {
  it("rejects a duplicate email regardless of case", () => {
    createUser("Dup@Example.com", "password123", "重复用户");
    expect(() => createUser("dup@example.com", "password123", "重复用户 2")).toThrow(AuthError);
  });

  it("looks up a user case-insensitively", () => {
    const created = createUser("Case@Example.com", "password123", "大小写");
    expect(findUserByEmail("case@example.com")?.id).toBe(created.id);
    expect(created.email).toBe("case@example.com");
  });
});

describe("sessions", () => {
  it("resolves the owner of a valid session", () => {
    const user = createUser("session@example.com", "password123", "会话用户");
    const { token } = createSession(user.id);
    expect(findSessionUser(token)?.id).toBe(user.id);
  });

  it("returns null for an expired session", () => {
    const user = createUser("expired@example.com", "password123", "过期用户");
    const { token } = createSession(user.id);
    getDatabase()
      .prepare("UPDATE sessions SET expires_at = ? WHERE user_id = ?")
      .run(new Date(Date.now() - 1000).toISOString(), user.id);
    expect(findSessionUser(token)).toBeNull();
  });

  it("returns null for an unknown token", () => {
    expect(findSessionUser("nope")).toBeNull();
  });
});
