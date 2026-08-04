import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

type Tone = "accent" | "profit" | "loss" | "warning";

interface GoalProgressCardProps {
  icon: LucideIcon;
  label: string;
  /** big current value */
  value: string;
  valueClassName?: string;
  /** small line under the value, e.g. "of ₹60,000 target" */
  targetLine: string;
  /** 0–100 meter fill (ProgressBar clamps) */
  pct: number;
  /** right-side numeric readout next to the meter, e.g. "68%" */
  pctText: string;
  tone: Tone;
  /** pace / status hint under the meter */
  hint: ReactNode;
}

/** One goal tile: label, hero value, target line, meter, pace hint. */
export function GoalProgressCard({
  icon: Icon,
  label,
  value,
  valueClassName = "text-ink",
  targetLine,
  pct,
  pctText,
  tone,
  hint,
}: GoalProgressCardProps) {
  return (
    <Card className="animate-in">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-edge bg-raised">
          <Icon size={14} className="text-muted" aria-hidden />
        </span>
        <span className="label-caps">{label}</span>
      </div>

      <div className={`mt-4 text-[26px] font-semibold leading-none tracking-tight ${valueClassName}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-muted">{targetLine}</div>

      <div className="mt-4 flex items-center gap-2.5">
        <ProgressBar value={pct} tone={tone} label={`${label} progress`} className="flex-1" />
        <span className="tnum w-11 shrink-0 text-right text-[11px] font-medium text-muted">{pctText}</span>
      </div>

      <div className="mt-2.5 text-[11px] leading-relaxed text-faint">{hint}</div>
    </Card>
  );
}
