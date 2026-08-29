"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth";
import {
  AuthError,
  SESSION_COOKIE,
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  hashPassword,
  verifyPassword,
} from "@/lib/users";

export type AuthFormState = { error?: string; ok?: boolean };

const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址。"),
  password: z.string().min(8, "密码至少 8 位。"),
});

const signupSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, "请输入用户名。").max(40, "用户名最多 40 个字符。"),
});

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "请检查填写的信息。" };
  }

  const user = findUserByEmail(parsed.data.email);
  if (!user) {
    // 抹平「用户不存在」与「密码错误」的耗时差异，避免账号枚举。
    hashPassword(parsed.data.password);
    return { error: "邮箱或密码不正确。" };
  }
  if (!verifyPassword(parsed.data.password, user.passwordHash)) {
    return { error: "邮箱或密码不正确。" };
  }

  const session = createSession(user.id);
  await setSessionCookie(session.token, session.expiresAt);
  return { ok: true };
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "请检查填写的信息。" };
  }

  let userId: string;
  try {
    userId = createUser(parsed.data.email, parsed.data.password, parsed.data.displayName).id;
  } catch (cause) {
    if (cause instanceof AuthError) return { error: cause.message };
    return { error: "注册失败，请稍后重试。" };
  }

  const session = createSession(userId);
  await setSessionCookie(session.token, session.expiresAt);
  return { ok: true };
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  await clearSessionCookie();
  redirect("/");
}
