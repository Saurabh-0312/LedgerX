import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, hint, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 text-center ${className}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-edge bg-raised">
        <Icon size={20} className="text-faint" aria-hidden />
      </div>
      <p className="mt-1 text-[14px] font-medium text-ink">{title}</p>
      {hint && <p className="max-w-[360px] text-[12px] text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
