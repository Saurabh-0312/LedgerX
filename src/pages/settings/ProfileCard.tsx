/** Settings → Profile: display name + email. */

import { useState } from "react";
import { Save } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useStore } from "@/store/useStore";
import { toast } from "@/store/toast";
import { CardFooter } from "@/pages/settings/shared";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function ProfileCard() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [userName, setUserName] = useState(settings.userName);
  const [email, setEmail] = useState(settings.email);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const dirty = userName !== settings.userName || email !== settings.email;

  const initials =
    userName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => (w[0] ? w[0].toUpperCase() : ""))
      .join("") || "?";

  const save = () => {
    const next: { name?: string; email?: string } = {};
    if (!userName.trim()) next.name = "Display name can't be empty";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address";
    setErrors(next);
    if (next.name || next.email) {
      toast("Fix the highlighted fields to save your profile", "error");
      return;
    }
    updateSettings({ userName: userName.trim(), email: email.trim() });
    setUserName(userName.trim());
    setEmail(email.trim());
    toast("Profile saved");
  };

  return (
    <Card title="Profile" subtitle="Shown in the sidebar and on exported reports.">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent"
        >
          {initials}
        </div>
        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
          <Field label="Display name" required error={errors.name}>
            {(id) => (
              <Input
                id={id}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            )}
          </Field>
          <Field label="Email" required error={errors.email} hint="Local only — never sent anywhere.">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            )}
          </Field>
        </div>
      </div>

      <CardFooter dirty={dirty}>
        <Button variant="primary" icon={Save} size="sm" onClick={save} disabled={!dirty}>
          Save profile
        </Button>
      </CardFooter>
    </Card>
  );
}
