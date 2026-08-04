import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface KpiDelta {
  /** already-formatted delta text, e.g. "+12.4%" or "+₹8,200 vs last month" */
  text: string;
  direction: "up" | "down" | "flat";
  /** is "up" good here? (drawdown/fees: false) */
  upIsGood?: boolean;
}

interface KpiCardProps {
  label: string;
  /** raw numeric value — animated count-up applies the formatter each frame */
  value: number;
  format: (n: number) => string;
  delta?: KpiDelta;
  icon?: LucideIcon;
  /** small line under the value, e.g. "412 trades" */
  sub?: string;
  /** color the VALUE by sign (P&L tiles). Default: plain ink. */
  toneBySign?: boolean;
  /** optional 12-point sparkline */
  spark?: number[];
  className?: string;
}

function useCountUp(target: number, ms = 700): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      // animate from 0 on first mount for the "alive" landing feel
      firstRef.current = false;
      fromRef.current = 0;
    }
    const from = fromRef.current;
    if (from === target) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return display;
}

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 72;
  const h = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(1)}`);
  const last = coords[coords.length - 1].split(",");
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      <polyline points={coords.join(" ")} fill="none" stroke="#3f4552" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="#7c5cff" stroke="#141619" strokeWidth="2" />
    </svg>
  );
}

/** Stat tile: uppercase muted label · big semibold value (count-up) · optional signed delta + sparkline. */
export function KpiCard({ label, value, format, delta, icon: Icon, sub, toneBySign = false, spark, className = "" }: KpiCardProps) {
  const animated = useCountUp(value);
  const valueClass = toneBySign ? (value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-ink") : "text-ink";
  const deltaGood = delta ? (delta.direction === "flat" ? null : (delta.direction === "up") === (delta.upIsGood ?? true)) : null;

  return (
    <div className={`card px-4 py-3.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{label}</span>
        {Icon && <Icon size={15} className="text-faint" aria-hidden />}
      </div>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
        <div className="min-w-0">
          <div className={`whitespace-nowrap text-[21px] font-semibold leading-tight tracking-tight ${valueClass}`}>
            {format(animated)}
          </div>
          {sub && <div className="mt-0.5 text-[11px] text-muted truncate">{sub}</div>}
        </div>
        {spark && <Spark points={spark} />}
      </div>
      {delta && (
        <div
          className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${
            deltaGood === null ? "text-muted" : deltaGood ? "text-profit" : "text-loss"
          }`}
        >
          {delta.direction === "up" && <ArrowUpRight size={12} aria-hidden />}
          {delta.direction === "down" && <ArrowDownRight size={12} aria-hidden />}
          <span>{delta.text}</span>
        </div>
      )}
    </div>
  );
}
