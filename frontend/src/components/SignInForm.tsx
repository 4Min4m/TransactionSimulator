import { useEffect, useState, type FormEvent } from "react";
import { login } from "../services/api";
import { setToken } from "../services/auth";
import { Field, inputCls, primaryBtn } from "./ui";

interface SignInFormProps {
  onSignIn: () => void;
  onClose: () => void;
  notice?: string;
}

export default function SignInForm({ onSignIn, onClose, notice }: SignInFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(notice ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError("Enter a username and password.");
    setError("");
    setLoading(true);
    try {
      const data = await login({ username: username.trim(), password });
      if (data.token) {
        setToken(data.token);
        onSignIn();
      } else {
        setError(data.error || data.message || "Invalid credentials");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during sign-in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(6,9,8,0.72)] p-5 backdrop-blur-[3px]"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="flex w-full max-w-[400px] flex-col gap-[18px] rounded-xl border border-line bg-panel p-[26px] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span id="signin-title" className="text-[19px] font-semibold tracking-tight">Sign in</span>
            <span className="text-[13.5px] text-muted">Admin access to protected API routes</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-[30px] w-[30px] rounded-md border border-line text-sm text-muted hover:border-faint hover:text-fg"
          >
            ✕
          </button>
        </div>

        <Field label="Username">
          <input
            autoFocus
            autoComplete="username"
            className={`${inputCls} font-sans`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            className={`${inputCls} font-sans`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && <span className="text-[13px] text-bad">{error}</span>}

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? "Verifying…" : "Sign in"}
        </button>

        <div className="border-t border-line2 pt-3.5 font-mono text-[11px] leading-relaxed text-dim">
          bcrypt check · timing-safe · HS256 JWT · rate-limited by WAF on /api/login
        </div>
      </form>
    </div>
  );
}
