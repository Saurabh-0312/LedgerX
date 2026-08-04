/** Tax Report charts — monthly taxable gains stacked by category, and est. tax vs net profit. */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  AXIS_TEXT,
  BAR_MAX,
  BAR_RADIUS,
  CURSOR_FILL,
  GRID,
  PNL,
  WARNING,
  axisDefaults,
  gridDefaults,
} from "@/components/charts/chartTheme";
import type { Currency } from "@/lib/format";
import { formatMoney, pnlMarkColor } from "@/lib/format";
import type { TaxMonthRow } from "./taxMeta";
import { CATEGORY_META, TAX_CATEGORIES } from "./taxMeta";

/** Card surface hex — used as the gap stroke between stacked segments. */
const SURFACE = "#141619";

const legendStyle = { fontSize: 12, color: AXIS_TEXT } as const;
/** Legend text wears muted ink, never the series hue. */
const legendFormatter = (value: string) => <span style={{ color: AXIS_TEXT }}>{value}</span>;

interface TaxChartsProps {
  months: TaxMonthRow[];
  currency: Currency;
  fy: string;
}

export function TaxCharts({ months, currency, fy }: TaxChartsProps) {
  const compact = (v: number) => formatMoney(v, { currency, compact: true });
  const compactSigned = (v: number) => formatMoney(v, { currency, compact: true, sign: true });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Taxable gains by month" subtitle={`Stacked by tax category · ${fy}`}>
        {months.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Nothing to chart"
            hint="No taxable trades were closed in this financial year."
          />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={months} barCategoryGap="24%">
              <CartesianGrid {...gridDefaults} />
              <XAxis {...axisDefaults} dataKey="label" />
              <YAxis {...axisDefaults} tickFormatter={compact} />
              <Tooltip
                content={<ChartTooltip hideZero valueFormatter={(v) => compact(v)} />}
                cursor={{ fill: CURSOR_FILL }}
              />
              <Legend wrapperStyle={legendStyle} formatter={legendFormatter} iconType="circle" iconSize={8} />
              {TAX_CATEGORIES.map((cat, i) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="taxable"
                  fill={CATEGORY_META[cat].color}
                  stroke={SURFACE}
                  strokeWidth={1}
                  maxBarSize={BAR_MAX}
                  radius={i === TAX_CATEGORIES.length - 1 ? BAR_RADIUS : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Tax vs net profit" subtitle={`Net P&L vs gross per-trade tax — before exemptions & §87A (see total above) · ${fy}`}>
        {months.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Nothing to chart"
            hint="No trades were closed in this financial year."
          />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={months} barGap={2} barCategoryGap="24%">
              <CartesianGrid {...gridDefaults} />
              <XAxis {...axisDefaults} dataKey="label" />
              <YAxis {...axisDefaults} tickFormatter={compact} />
              <ReferenceLine y={0} stroke={GRID} />
              <Tooltip
                content={<ChartTooltip valueFormatter={(v) => compactSigned(v)} />}
                cursor={{ fill: CURSOR_FILL }}
              />
              <Legend wrapperStyle={legendStyle} formatter={legendFormatter} iconType="circle" iconSize={8} />
              <Bar dataKey="netPnl" name="Net P&L" fill={PNL.profit} maxBarSize={BAR_MAX} radius={BAR_RADIUS}>
                {months.map((m) => (
                  <Cell key={m.month} fill={pnlMarkColor(m.netPnl)} />
                ))}
              </Bar>
              <Bar dataKey="tax" name="Gross tax (pre-rebate)" fill={WARNING} maxBarSize={BAR_MAX} radius={BAR_RADIUS} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
