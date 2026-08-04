import type { ReactNode } from "react";

export type BadgeTone = "profit" | "loss" | "accent" | "warning" | "info" | "neutral";

const TONES: Record<BadgeTone, string> = {
  profit: "bg-profit-soft text-profit",
  loss: "bg-loss-soft text-loss",
  accent: "bg-accent-soft text-[#a18bff]",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-raised text-muted border border-edge",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

/** Small pill badge — direction, win/loss, status, tag chips. */
export function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Long/Short direction badge with the house colors. */
export function DirectionBadge({ direction }: { direction: "Long" | "Short" }) {
  return <Badge tone={direction === "Long" ? "profit" : "loss"}>{direction}</Badge>;
}

/** Open/Closed/Cancelled status badge. */
export function StatusBadge({ status }: { status: "Open" | "Closed" | "Cancelled" }) {
  const tone = status === "Open" ? "info" : status === "Closed" ? "neutral" : "warning";
  return <Badge tone={tone}>{status}</Badge>;
}
