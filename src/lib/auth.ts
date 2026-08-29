import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";
import { SESSION_COOKIE, findSessionUser } from "@/lib/users";
import type { User } from "@/lib/types";

/** 读取当前会话用户，不做跳转。同一请求内多次调用只查库一次。 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findSessionUser(token) : null;
});

/** Route Handler 用：返回用户，或已构造好的 401 响应。 */
export async function requireApiUser(): Promise<{ user: User } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "请先登录后再操作。" }, { status: 401 }),
    };
  }
  return { user };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
