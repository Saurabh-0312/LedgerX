import type { ReactNode } from "react";
import { BarChart3, Receipt, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ACCENT, GRID } from "@/components/charts/chartTheme";
import { formatMoney } from "@/lib/format";

/* ── Brand ─────────────────────────────────────────────────────────── */

function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#141619" />
      <path
        d="M9 7v14a2 2 0 0 0 2 2h12"
        fill="none"
        stroke="#7C5CFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 17l4-5 3 3 4-6"
        fill="none"
        stroke="#22C55E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-ink ${className}`}>
      Ledger<span className="text-accent">X</span>
    </span>
  );
}

/* ── Feature bullets ───────────────────────────────────────────────── */

const FEATURES: ReadonlyArray<{ icon: LucideIcon; title: string; copy: string }> = [
  {
    icon: BarChart3,
    title: "P&L you can trust",
    copy: "Every trade netted against brokerage, STT and GST — no broker-screen gross illusions.",
  },
  {
    icon: Receipt,
    title: "Costs, itemised",
    copy: "Charges tracked order by order, so you see exactly what execution really takes from your edge.",
  },
  {
    icon: Target,
    title: "Discipline, measured",
    copy: "R-multiples, streaks and goal tracking keep your process — not just your P&L — honest.",
  },
];

/* ── Decorative equity curve (hand-written points, violet glow) ────── */

const CURVE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 122],
  [36, 112],
  [72, 117],
  [108, 95],
  [144, 103],
  [180, 78],
  [216, 88],
  [252, 60],
  [288, 70],
  [324, 44],
  [360, 52],
  [396, 28],
  [432, 34],
  [468, 12],
];

const LINE_D = "M " + CURVE_POINTS.map(([x, y]) => `${x} ${y}`).join(" L ");
const AREA_D = `${LINE_D} L 468 150 L 0 150 Z`;

function EquityCurveArt() {
  return (
    <div className="rounded-xl border border-edge-soft bg-surface/60 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="label-caps">Net equity · after charges</span>
        <span className="text-[12px] font-medium text-profit tnum">
          {formatMoney(423500, { compact: true, sign: true })} this FY
        </span>
      </div>
      <svg viewBox="0 0 468 150" className="block w-full" aria-hidden>
        <defs>
          <linearGradient id="lx-auth-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="60%" stopColor={ACCENT} stopOpacity={0.9} />
            <stop offset="100%" stopColor="#b9a6ff" />
          </linearGradient>
          <linearGradient id="lx-auth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
          <filter id="lx-auth-glow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        {[30, 70, 110].map((y) => (
          <line key={y} x1={0} x2={468} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
        ))}

        <path d={AREA_D} fill="url(#lx-auth-fill)" />
        <path
          d={LINE_D}
          fill="none"
          stroke={ACCENT}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.4}
          filter="url(#lx-auth-glow)"
        />
        <path
          d={LINE_D}
          fill="none"
          stroke="url(#lx-auth-stroke)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={252} cy={60} r={3.5} fill={ACCENT} stroke="#141619" strokeWidth={2} />
        <circle cx={468} cy={12} r={4.5} fill="#b9a6ff" stroke="#141619" strokeWidth={2} />
      </svg>
    </div>
  );
}

/* ── Split-screen shell ────────────────────────────────────────────── */

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Full-screen auth shell rendered outside AppLayout: brand/feature panel on
 * the left (lg+), centered 400px card on the right, violet radial glow behind.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen bg-base text-ink">
      {/* Radial violet glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-48 left-1/3 h-[520px] w-[760px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(closest-side, rgba(124, 92, 255, 0.16), transparent 70%)" }}
        />
        <div
          className="absolute -right-24 -bottom-40 h-[420px] w-[560px] rounded-full blur-[110px]"
          style={{ background: "radial-gradient(closest-side, rgba(124, 92, 255, 0.10), transparent 70%)" }}
        />
      </div>

      {/* Left — brand panel (hidden on mobile) */}
      <aside className="relative z-10 hidden w-1/2 flex-col justify-between border-r border-edge-soft p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <Wordmark className="text-[17px]" />
        </div>

        <div className="max-w-[460px] space-y-9 py-10">
          <p className="text-[28px] leading-[1.18] font-semibold tracking-tight text-ink xl:text-[32px]">
            The trading journal that tells you <span className="text-accent">the truth</span>.
          </p>

          <ul className="space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
                  <f.icon size={17} aria-hidden />
                </span>
                <span>
                  <span className="block text-[13px] font-medium text-ink">{f.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{f.copy}</span>
                </span>
              </li>
            ))}
          </ul>

          <EquityCurveArt />
        </div>

        <p className="text-[12px] text-faint">₹-native · charges-aware · private by design</p>
      </aside>

      {/* Right — form panel */}
      <main className="relative z-10 flex min-h-screen flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <BrandMark size={28} />
            <Wordmark className="text-[16px]" />
          </div>

          <Card className="animate-in">{children}</Card>

          <p className="mt-4 text-center text-[11px] text-faint">Your data is private to your account.</p>
        </div>
      </main>
    </div>
  );
}
