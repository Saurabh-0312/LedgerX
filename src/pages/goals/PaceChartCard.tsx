import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  ACCENT,
  BAR_RADIUS,
  CURSOR_FILL,
  axisDefaults,
  gridDefaults,
} from "@/components/charts/chartTheme";
import { formatMoney, pnlMarkColor } from "@/lib/format";

export interface PaceMonth {
  month: string; // yyyy-MM
  label: string; // "Mar 26"
  pnl: number;
}

interface PaceChartCardProps {
  data: PaceMonth[];
  target: number;
}

/** Last-6-months net P&L bars vs the monthly profit target reference line. */
export function PaceChartCard({ data, target }: PaceChartCardProps) {
  return (
    <Card
      title="Monthly P&L vs target"
      subtitle={`Last 6 months across all accounts · target ${formatMoney(target, { compact: true })}/month`}
      className="animate-in"
    >
      {data.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No closed trades yet"
          hint="Close a few trades and monthly performance will chart here against your target."
        />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridDefaults} />
            <XAxis {...axisDefaults} dataKey="label" />
            <YAxis
              {...axisDefaults}
              width={56}
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
            />
            <Tooltip
              content={
                <ChartTooltip valueFormatter={(v) => formatMoney(v, { compact: true, sign: true })} />
              }
              cursor={{ fill: CURSOR_FILL }}
            />
            <ReferenceLine
              y={target}
              stroke={ACCENT}
              strokeWidth={1.5}
              ifOverflow="extendDomain"
              label={{ value: "target", position: "insideTopRight", fill: ACCENT, fontSize: 11 }}
            />
            <Bar dataKey="pnl" name="Net P&L" maxBarSize={24} radius={BAR_RADIUS}>
              {data.map((m) => (
                <Cell key={m.month} fill={pnlMarkColor(m.pnl)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
