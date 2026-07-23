import { useEffect, useState } from "react";
import {
  login,
  signup,
  forgotPassword,
  resetPassword,
  fetchAuthMode,
  loginWithPasscode,
  type AuthMode,
} from "../api";
import Icon, { Spinner } from "./Icon";
import ContactAdmin from "./ContactAdmin";

type Mode = "signin" | "signup" | "forgot";

export default function AuthPage({ onLogin }: { onLogin: (username: string) => void }) {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [loginId, setLoginId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthMode().then(setAuthMode);
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setOtpSent(false);
    setOtpCode("");
    setPassword("");
    setConfirm("");
  }

  const canSubmit =
    authMode === "passcode"
      ? password !== ""
      : loginId.trim() !== "" &&
        (mode === "forgot"
          ? !otpSent || (otpCode.trim() !== "" && password !== "" && confirm !== "")
          : password !== "" &&
            (mode === "signin" || (username.trim() !== "" && confirm !== "")));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (authMode === "passcode") {
        onLogin(await loginWithPasscode(password));
        return;
      }
      if (mode === "forgot") {
        if (!otpSent) {
          await forgotPassword(loginId);
          setOtpSent(true);
          setNotice(
            "If an account exists for this email, a 6-digit code has been sent to it. Check your inbox (and spam folder)."
          );
        } else {
          if (password !== confirm) {
            setError("Passwords do not match.");
            return;
          }
          await resetPassword(loginId, otpCode, password);
          switchMode("signin");
          setNotice("Password changed. Sign in with your new password.");
        }
        return;
      }
      if (mode === "signup" && password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      const name =
        mode === "signup"
          ? await signup(loginId, username, password)
          : await login(loginId, password);
      onLogin(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-indigo-400 focus:outline-none";
  const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

  const submitLabel = busy
    ? mode === "signup"
      ? "Creating account…"
      : mode === "forgot"
        ? otpSent
          ? "Resetting…"
          : "Sending code…"
        : "Signing in…"
    : mode === "signup"
      ? "Create account"
      : mode === "forgot"
        ? otpSent
          ? "Reset password"
          : "Email me a code"
        : "Sign in";

  if (authMode === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-500">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
      <div className="h-1 bg-gradient-to-r from-indigo-600 via-sky-400 to-indigo-600" />
      <div className="flex justify-end pt-4 sm:pr-2">
        <ContactAdmin tone="dark" />
      </div>
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="animate-fade-up w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 ring-1 ring-inset ring-indigo-400/40">
              <Icon name="documents" className="h-7 w-7 text-indigo-300" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Legal PDF Splitter
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {authMode === "passcode"
                ? "Enter the office passcode to continue"
                : mode === "signin"
                  ? "Welcome back — sign in to continue"
                  : mode === "signup"
                    ? "Create your account to get started"
                    : "Reset your password"}
            </p>
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 shadow-xl">
            {authMode === "accounts" && mode !== "forgot" && (
              <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                      mode === m
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {m === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === "accounts" && mode === "signup" && (
                <div>
                  <label htmlFor="auth-username" className={labelClass}>
                    Your name
                  </label>
                  <input
                    id="auth-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="name"
                    placeholder="What should we call you?"
                    className={inputClass}
                  />
                </div>
              )}

              {authMode === "accounts" && (
              <div>
                <label htmlFor="auth-loginid" className={labelClass}>
                  Email address
                </label>
                <input
                  id="auth-loginid"
                  type="email"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={mode === "forgot" && otpSent}
                  placeholder="you@example.com"
                  className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500`}
                />
              </div>
              )}

              {mode === "forgot" && otpSent && (
                <div>
                  <label htmlFor="auth-otp" className={labelClass}>
                    6-digit code from the email
                  </label>
                  <input
                    id="auth-otp"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className={`${inputClass} text-center font-mono text-lg tracking-[0.5em]`}
                  />
                </div>
              )}

              {(mode !== "forgot" || otpSent) && (
                <div>
                  <label htmlFor="auth-password" className={labelClass}>
                    {authMode === "passcode"
                      ? "Office passcode"
                      : mode === "signin"
                        ? "Password"
                        : "New password"}
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    placeholder={mode === "signin" ? "••••••••" : "At least 6 characters"}
                    className={inputClass}
                  />
                </div>
              )}

              {(mode === "signup" || (mode === "forgot" && otpSent)) && (
                <div>
                  <label htmlFor="auth-confirm" className={labelClass}>
                    Confirm password
                  </label>
                  <input
                    id="auth-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Type it again"
                    className={inputClass}
                  />
                </div>
              )}

              {notice && (
                <div className="flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
                  {notice}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-indigo-600 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
              >
                {busy ? <Spinner className="h-5 w-5" /> : <Icon name="shield" className="h-5 w-5" />}
                {submitLabel}
              </button>

              {authMode === "accounts" && mode === "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="block w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Forgot password?
                </button>
              )}

              {mode === "forgot" && (
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-medium text-slate-500 hover:text-slate-700"
                  >
                    ← Back to sign in
                  </button>
                  {otpSent && (
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode("");
                        setNotice(null);
                        setError(null);
                      }}
                      className="font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Send a new code
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Sessions end after 10 minutes of inactivity — you'll simply sign in again.
          </p>
        </div>
      </div>
    </div>
  );
}
