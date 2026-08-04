/** Monthly target chart — the achievement line against N target lines, Jan→Dec.
 *  `mode="amount"`  plots ₹ (targets = percents% of capital);
 *  `mode="percent"` plots each month's achieve% against flat target-% lines;
 *  `mode="cumavg"`  plots the running average of achieve% up to each month. */

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Target } from "lucide-react";
import type { Currency } from "@/lib/format";
import { formatMoney, formatPct } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { TARGET_COLORS, type MonthTargetRow } from "./portfolioTargets";

/** Bright, prominent color for the achievement line — the star of the chart. */
const ACHIEVED_COLOR = "#f8fafc";

interface Props {
  rows: MonthTargetRow[];
  percents: number[];
  currency: Currency;
  mode: "amount" | "percent" | "cumavg";
  title: string;
  subtitle: string;
  height?: number;
}

const pctLabel = (p: number) => `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function MonthlyTargetChart({ rows, percents, currency, mode, title, subtitle, height = 400 }: Props) {
  // running (cumulative) average of achieve% up to each month, carried through gaps
  const cumAvg = useMemo(() => {
    let sum = 0;
    let count = 0;
    return rows.map((r) => {
      if (r.capital > 0) {
        sum += r.achievePct;
        count += 1;
      }
      return count > 0 ? round2(sum / count) : null;
    });
  }, [rows]);

  const data = useMemo(
    () =>
      rows.map((r, idx) => {
        const o: Record<string, number | string | null> = {
          label: r.label,
          achieved:
            mode === "amount"
              ? r.achieved
              : mode === "percent"
                ? r.capital > 0
                  ? round2(r.achievePct)
                  : null // break the line on months with no portfolio value
                : cumAvg[idx],
        };
        // target lines only exist for months with a portfolio value — break otherwise
        percents.forEach((p, i) => {
          o[`t${i}`] = r.capital > 0 ? (mode === "amount" ? r.targets[i] : p) : null;
        });
        return o;
      }),
    [rows, percents, mode, cumAvg],
  );

  const hasCapital = rows.some((r) => r.capital > 0);
  const fmt = (v: number) => (mode === "amount" ? formatMoney(v, { currency, compact: true, sign: true }) : formatPct(v, 2, true));
  const axisFmt = (v: number) => (mode === "amount" ? formatMoney(v, { currency, compact: true }) : `${v}%`);

  return (
    <Card title={title} subtitle={subtitle}>
      {!hasCapital ? (
        <EmptyState
          icon={Target}
          title="Enter a portfolio value to see targets"
          hint="Fill in at least one month's amount below and the target lines will appear."
        />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid {...gridDefaults} />
            <XAxis {...axisDefaults} dataKey="label" />
            <YAxis {...axisDefaults} tickFormatter={axisFmt} width={64} />
            {mode !== "amount" && <ReferenceLine y={0} stroke={GRID} />}
            <Tooltip cursor={{ stroke: GRID }} content={<ChartTooltip valueFormatter={fmt} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#8b929d" }} iconSize={10} />
            {percents.map((p, i) => (
              <Line
                key={i}
                name={`${pctLabel(p)} target`}
                dataKey={`t${i}`}
                type={mode === "amount" ? "monotone" : "linear"}
                stroke={TARGET_COLORS[i % TARGET_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2 }}
              />
            ))}
            {/* the headline line (drawn last, on top) — achieved, or the running average */}
            <Line
              name={mode === "amount" ? "Achieved" : mode === "percent" ? "Achieved %" : "Avg % so far"}
              dataKey="achieved"
              type="monotone"
              stroke={ACHIEVED_COLOR}
              strokeWidth={2.75}
              connectNulls={false}
              dot={{ r: 3, fill: ACHIEVED_COLOR, stroke: "#141619", strokeWidth: 1.5 }}
              activeDot={{ r: 5, stroke: "#141619", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
