import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/store/toast";
import { AuthLayout } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";

interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  barClass: string;
  textClass: string;
}

const STRENGTH_LEVELS: Record<1 | 2 | 3 | 4, Omit<Strength, "score">> = {
  1: { label: "Weak", barClass: "bg-loss", textClass: "text-loss" },
  2: { label: "Fair", barClass: "bg-warning", textClass: "text-warning" },
  3: { label: "Good", barClass: "bg-profit", textClass: "text-profit" },
  4: { label: "Strong", barClass: "bg-profit", textClass: "text-profit" },
};

/** Score 0–4 from length + character variety (lower/upper/digit/symbol). */
function passwordStrength(pw: string): Strength {
  if (pw.length === 0) return { score: 0, label: "", barClass: "", textClass: "" };

  let variety = 0;
  if (/[a-z]/.test(pw)) variety += 1;
  if (/[A-Z]/.test(pw)) variety += 1;
  if (/[0-9]/.test(pw)) variety += 1;
  if (/[^A-Za-z0-9]/.test(pw)) variety += 1;

  let score: 1 | 2 | 3 | 4 = 1;
  if ((pw.length >= 8 && variety >= 2) || pw.length >= 12) score = 2;
  if ((pw.length >= 10 && variety >= 3) || (pw.length >= 14 && variety >= 2)) score = 3;
  if (pw.length >= 12 && variety >= 4) score = 4;

  return { score, ...STRENGTH_LEVELS[score] };
}

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const strength = passwordStrength(password);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast("Account created — welcome!");
    navigate("/");
  };

  return (
    <AuthLayout>
      <div className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">Create your account</h1>
        <p className="mt-1 text-[13px] text-muted">Start journaling every trade — and every rupee of cost.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" required>
          {(id) => (
            <Input
              id={id}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              autoFocus
              required
            />
          )}
        </Field>

        <Field label="Email" required>
          {(id) => (
            <Input
              id={id}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          )}
        </Field>

        <Field label="Password" required>
          {(id) => (
            <div>
              <PasswordInput
                id={id}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                aria-describedby={`${id}-strength`}
                required
              />
              <div className="mt-2 flex gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                      i < strength.score ? strength.barClass : "bg-edge"
                    }`}
                  />
                ))}
              </div>
              <p
                id={`${id}-strength`}
                aria-live="polite"
                className="mt-1.5 flex items-baseline justify-between gap-2 text-[11px]"
              >
                <span className="text-faint">Use 8+ characters with mixed case, numbers &amp; symbols.</span>
                {strength.score > 0 && (
                  <span className={`shrink-0 font-medium ${strength.textClass}`}>{strength.label}</span>
                )}
              </p>
            </div>
          )}
        </Field>

        <Button type="submit" variant="primary" icon={UserPlus} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
