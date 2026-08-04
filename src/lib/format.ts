/** Formatting helpers — every page uses these so numbers read identically app-wide. */

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inrFmt2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const usdFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usdFmt2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export type Currency = "INR" | "USD";

export interface MoneyOpts {
  currency?: Currency;
  /** Indian compact notation: ₹1.24L / ₹2.1Cr (USD falls back to K/M) */
  compact?: boolean;
  /** always show sign: +₹1,200 / −₹840 */
  sign?: boolean;
  /** show paise/cents */
  decimals?: boolean;
}

export function formatMoney(value: number, opts: MoneyOpts = {}): string {
  const { currency = "INR", compact = false, sign = false, decimals = false } = opts;
  const sym = currency === "INR" ? "₹" : "$";
  const abs = Math.abs(value);
  const prefix = value < 0 ? "−" : sign && value > 0 ? "+" : "";

  if (compact) {
    if (currency === "INR") {
      if (abs >= 1e7) return `${prefix}${sym}${trim((abs / 1e7).toFixed(2))}Cr`;
      if (abs >= 1e5) return `${prefix}${sym}${trim((abs / 1e5).toFixed(2))}L`;
      if (abs >= 1e3) return `${prefix}${sym}${trim((abs / 1e3).toFixed(1))}K`;
    } else {
      if (abs >= 1e6) return `${prefix}${sym}${trim((abs / 1e6).toFixed(2))}M`;
      if (abs >= 1e3) return `${prefix}${sym}${trim((abs / 1e3).toFixed(1))}K`;
    }
    return `${prefix}${sym}${Math.round(abs)}`;
  }

  const fmt = currency === "INR" ? (decimals ? inrFmt2 : inrFmt) : decimals ? usdFmt2 : usdFmt;
  return `${prefix}${sym}${fmt.format(abs)}`;
}

const trim = (s: string) => s.replace(/\.?0+$/, "");

export function formatPct(value: number, dp = 1, sign = false): string {
  const prefix = value < 0 ? "−" : sign && value > 0 ? "+" : "";
  return `${prefix}${Math.abs(value).toFixed(dp)}%`;
}

export function formatNumber(value: number, dp = 0): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: dp,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatR(r: number | undefined): string {
  if (r === undefined || Number.isNaN(r)) return "—";
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(2)}R`;
}

/** "12 Mar 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** "12 Mar" */
export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** "12 Mar 2026, 10:24" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso)}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** minutes → "45m" | "3h 20m" | "4d 6h" */
export function formatDuration(minutes: number | undefined): string {
  if (minutes === undefined || Number.isNaN(minutes)) return "—";
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24 ? `${h % 24}h` : ""}`.trim();
}

/** Tailwind text class for a signed value. */
export function pnlClass(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-muted";
}

/** For bars/fills — validated chart mark colors, NOT the text greens. */
export function pnlMarkColor(value: number): string {
  if (value > 0) return "#16a34a";
  if (value < 0) return "#ef4444";
  return "#8b929d";
}
