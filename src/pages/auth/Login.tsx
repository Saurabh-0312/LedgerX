import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/store/toast";
import { useAuth } from "@/store/useAuth";
import { AuthLayout } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";

function GoogleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29V6.62H1.27a12 12 0 0 0 0 10.76l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.62l4.01 3.09C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const signIn = useAuth((s) => s.signIn);
  const session = useAuth((s) => s.session);
  const authLoading = useAuth((s) => s.loading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // D6: render nothing until the session check resolves (no form flash for an
  // already-signed-in user), then redirect them past the login screen.
  if (authLoading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast(error, "error");
      return;
    }
    toast("Welcome back");
    navigate("/");
  };

  return (
    <AuthLayout>
      <div className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1 text-[13px] text-muted">Sign in to continue to your journal.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" required>
          {(id) => (
            <Input
              id={id}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
            />
          )}
        </Field>

        <Field label="Password" required>
          {(id) => (
            <PasswordInput
              id={id}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
          )}
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer rounded accent-accent"
            />
            Remember me
          </label>
          <a href="#" className="text-[12px] text-faint transition-colors duration-150 hover:text-accent">
            Forgot password?
          </a>
        </div>

        <Button type="submit" variant="primary" icon={LogIn} className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3" aria-hidden>
        <div className="h-px flex-1 bg-edge-soft" />
        <span className="text-[11px] text-faint">or</span>
        <div className="h-px flex-1 bg-edge-soft" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => toast("Google sign-in coming soon", "info")}
      >
        <GoogleGlyph />
        Continue with Google
      </Button>

      <p className="mt-5 text-center text-[13px] text-muted">
        New to LedgerX?{" "}
        <Link to="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
