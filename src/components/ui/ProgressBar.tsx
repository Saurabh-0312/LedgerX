/** Meter — the fill carries state; the track is a lighter step of the same ramp
 *  so the whole bar reads (per the dataviz meter spec). */

type Tone = "accent" | "profit" | "loss" | "warning";

const FILLS: Record<Tone, { fill: string; track: string }> = {
  accent: { fill: "#7c5cff", track: "rgba(124, 92, 255, 0.16)" },
  profit: { fill: "#16a34a", track: "rgba(22, 163, 74, 0.16)" },
  loss: { fill: "#ef4444", track: "rgba(239, 68, 68, 0.16)" },
  warning: { fill: "#f59e0b", track: "rgba(245, 158, 11, 0.16)" },
};

interface ProgressBarProps {
  /** 0–100 (clamped) */
  value: number;
  tone?: Tone;
  className?: string;
  label?: string; // aria label
}

export function ProgressBar({ value, tone = "accent", className = "", label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const { fill, track } = FILLS[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full ${className}`}
      style={{ background: track }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: fill }}
      />
    </div>
  );
}
