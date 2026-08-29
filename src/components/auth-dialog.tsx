"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, ScanLine, X } from "lucide-react";
import { loginAction, signupAction, type AuthFormState } from "@/lib/actions/auth";

type Mode = "login" | "signup";

const COPY = {
  login: {
    title: "登录后继续识别",
    subtitle: "识别记录仅自己可见，登录即可开始。",
    submit: "登录",
    pending: "登录中…",
    footer: "还没有账号？",
    footerAction: "注册",
  },
  signup: {
    title: "注册账号",
    subtitle: "创建账号，你的发票记录仅自己可见。",
    submit: "注册并继续",
    pending: "注册中…",
    footer: "已有账号？",
    footerAction: "登录",
  },
} as const;

const fieldClass =
  "h-10 w-full border border-[#d9dfe2] bg-white px-3 text-sm text-[#263236] outline-none focus:border-[#087f72]";
const labelClass = "mb-1.5 block text-xs text-[#667177]";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 w-full items-center justify-center gap-2 bg-[#087f72] text-sm font-medium text-white transition-colors hover:bg-[#066a5f] disabled:cursor-not-allowed disabled:bg-[#9bb7b3]"
    >
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {pending ? pendingLabel : label}
    </button>
  );
}

function AuthPanel({
  mode,
  onSwitchMode,
  onSuccess,
}: {
  mode: Mode;
  onSwitchMode: (next: Mode) => void;
  onSuccess: () => void;
}) {
  const copy = COPY[mode];
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    mode === "login" ? loginAction : signupAction,
    {},
  );

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <>
      <h2 className="text-lg font-medium text-[#172024]">{copy.title}</h2>
      <p className="mt-1.5 text-xs text-[#758086]">{copy.subtitle}</p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        {mode === "signup" && (
          <div>
            <label className={labelClass} htmlFor="displayName">
              用户名
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              maxLength={40}
              autoComplete="nickname"
              className={fieldClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="email">
            邮箱
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={fieldClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="password">
            密码
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={fieldClass}
          />
          {mode === "signup" && <p className="mt-1.5 text-xs text-[#758086]">至少 8 位字符。</p>}
        </div>

        {state.error && (
          <p role="alert" className="border border-[#e3b3ad] bg-[#fdf3f2] px-3 py-2 text-xs text-[#b4231a]">
            {state.error}
          </p>
        )}

        <SubmitButton label={copy.submit} pendingLabel={copy.pending} />
      </form>

      <p className="mt-6 text-xs text-[#758086]">
        {copy.footer}
        <button
          type="button"
          className="ml-1 text-[#087f72] hover:underline"
          onClick={() => onSwitchMode(mode === "login" ? "signup" : "login")}
        >
          {copy.footerAction}
        </button>
      </p>
    </>
  );
}

/** 悬浮登录框：仅在需要身份时弹出，成功后原地关闭并刷新会话状态。 */
export function AuthDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>("login");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172024]/45 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="登录或注册"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[380px] border border-[#d9dfe2] bg-white p-7 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="关闭"
          className="absolute top-3.5 right-3.5 grid h-8 w-8 place-items-center text-[#8b9599] transition-colors hover:text-[#263236]"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-7 flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-[#087f72]" />
          <span className="text-base font-semibold tracking-wide text-[#172024]">票识</span>
        </div>

        {/* key 让切换模式时重置表单状态与错误提示。 */}
        <AuthPanel key={mode} mode={mode} onSwitchMode={setMode} onSuccess={onSuccess} />
      </div>
    </div>
  );
}
