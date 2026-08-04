/** MTF module chart palette (spec §2.2) — the ONLY place raw hex is allowed
 *  besides the shared chartTheme. Break-even yellow is local to this module;
 *  never add it to index.css. */

import type { MtfAlertSeverity, MtfHealthLevel } from "./types";

export const MTF_COLORS = {
  interest: "#f59e0b", // amber — all interest figures/series
  breakEven: "#eab308", // yellow-500 — break-even accents (local constant)
  holding: "#38bdf8", // info blue — holding/duration
  forecast: "#7c5cff", // accent violet — forecast framing
  profit: "#16a34a", // chart profit mark (matches PNL.profit)
  loss: "#ef4444",
} as const;

/** Health tier → Badge tone-ish styling. yellow has no token: local classes. */
export const HEALTH_META: Record<
  MtfHealthLevel,
  { label: string; className: string; dot: string }
> = {
  green: { label: "Healthy", className: "bg-profit-soft text-profit", dot: "#22c55e" },
  blue: { label: "OK", className: "bg-info-soft text-info", dot: "#38bdf8" },
  yellow: { label: "Watch", className: "bg-[#eab308]/15 text-[#eab308]", dot: "#eab308" },
  orange: { label: "Heavy", className: "bg-warning-soft text-warning", dot: "#f59e0b" },
  red: { label: "Critical", className: "bg-loss-soft text-loss", dot: "#ef4444" },
};

export const ALERT_META: Record<
  MtfAlertSeverity,
  { className: string; iconClass: string }
> = {
  info: { className: "bg-info-soft text-info", iconClass: "text-info" },
  warning: { className: "bg-warning-soft text-warning", iconClass: "text-warning" },
  loss: { className: "bg-loss-soft text-loss", iconClass: "text-loss" },
};
