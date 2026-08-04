/** Chart design tokens — dataviz-validated on the card surface #141619.
 *  Every Recharts chart in the app uses these; never hand-pick chart colors. */

/** Categorical series slots — FIXED order, assigned in sequence, never cycled.
 *  Validated: all adjacent CVD ΔE ≥ 52, contrast ≥ 3:1, OKLCH band OK. */
export const CAT = [
  "#7c5cff", // 1 violet (brand)
  "#ec4899", // 2 pink
  "#d97706", // 3 amber
  "#a855f7", // 4 purple
  "#0d9488", // 5 teal
  "#6366f1", // 6 indigo
  "#ea580c", // 7 orange
  "#3b82f6", // 8 blue
] as const;

/** P&L polarity marks (diverging) — validated pair. Text greens are brighter; these are for fills/bars/lines. */
export const PNL = {
  profit: "#16a34a",
  loss: "#ef4444",
  neutral: "#8b929d",
} as const;

export const ACCENT = "#7c5cff";
export const INFO = "#38bdf8";
export const WARNING = "#f59e0b"; // fees/tax accent — pair with icon/label, never alone

/** Chrome */
export const GRID = "#22262c"; // hairline, one step off surface — always solid, never dashed
export const AXIS_TEXT = "#8b929d";
export const CURSOR_FILL = "rgba(124, 92, 255, 0.08)";

/** Default tick style for XAxis/YAxis `tick` prop. */
export const tickStyle = { fill: AXIS_TEXT, fontSize: 11 } as const;

/** Spread these on <XAxis> / <YAxis> for the house style (no axis lines, quiet ticks). */
export const axisDefaults = {
  axisLine: false,
  tickLine: false,
  tick: tickStyle,
} as const;

/** Spread on <CartesianGrid> — horizontal hairlines only. */
export const gridDefaults = {
  stroke: GRID,
  vertical: false,
} as const;

/** Mark specs (from the dataviz method) */
export const BAR_MAX = 24; // px — max bar thickness
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]; // rounded data-end, square baseline
export const BAR_RADIUS_H: [number, number, number, number] = [0, 4, 4, 0]; // horizontal bars
export const LINE_WIDTH = 2;
export const AREA_OPACITY = 0.1; // area fills are a wash, never a block

/** Sequential/diverging alpha steps for heatmap cells (calendar, time-of-day). */
export function heatColor(value: number, maxAbs: number): string {
  if (value === 0 || maxAbs === 0) return "#1c1f24";
  const t = Math.min(1, Math.abs(value) / maxAbs);
  const alpha = 0.15 + t * 0.75;
  return value > 0 ? `rgba(22, 163, 74, ${alpha.toFixed(2)})` : `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
}

/** Text color to place ON a heat cell, by intensity. */
export function heatTextColor(value: number, maxAbs: number): string {
  if (value === 0 || maxAbs === 0) return "#5c626c";
  const t = Math.min(1, Math.abs(value) / maxAbs);
  return t > 0.55 ? "#ffffff" : "#e6e8eb";
}
