/** Dashboard tile — mini P&L heatmap of the latest month with data; day click opens the Calendar page. */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import type { Trade } from "@/types";
import { calendarMonth, monthlyPnl } from "@/lib/metrics";
import { formatDate, formatMoney, pnlClass } from "@/lib/format";
import { heatColor, heatTextColor } from "@/components/charts/chartTheme";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export function PnlCalendarCard({ trades }: { trades: Trade[] }) {
  const navigate = useNavigate();

  const cal = useMemo(() => {
    const months = monthlyPnl(trades);
    if (months.length === 0) return null;
    const latest = months[months.length - 1].month; // "yyyy-MM"
    const year = Number(latest.slice(0, 4));
    const month0 = Number(latest.slice(5, 7)) - 1;
    const days = calendarMonth(trades, year, month0);
    const maxAbs = Math.max(0, ...days.map((d) => Math.abs(d.pnl)));
    const lead = (new Date(year, month0, 1).getDay() + 6) % 7; // Monday-first offset
    const netPnl = days.reduce((acc, d) => acc + d.pnl, 0);
    const monthName = new Date(year, month0, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    return { days, maxAbs, lead, netPnl, monthName };
  }, [trades]);

  return (
    <Card
      className="h-full"
      title="P&L calendar"
      subtitle={
        cal ? (
          <>
            {cal.monthName} ·{" "}
            <span className={pnlClass(cal.netPnl)}>
              {formatMoney(cal.netPnl, { sign: true, compact: true })}
            </span>{" "}
            net
          </>
        ) : (
          "Daily results at a glance"
        )
      }
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>
          Open calendar →
        </Button>
      }
    >
      {!cal ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing to map yet"
          hint="Closed trades will paint this month's heatmap."
        />
      ) : (
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-[10px] font-medium uppercase tracking-wide text-faint">
              {w}
            </div>
          ))}
          {Array.from({ length: cal.lead }, (_, i) => (
            <div key={`pad-${i}`} aria-hidden />
          ))}
          {cal.days.map((d) => {
            const tip =
              d.trades > 0
                ? `${formatDate(d.date)} — ${formatMoney(d.pnl, { sign: true })} · ${d.trades} trade${d.trades === 1 ? "" : "s"}`
                : `${formatDate(d.date)} — no trades`;
            return (
              <button
                key={d.date}
                type="button"
                title={tip}
                aria-label={tip}
                onClick={() => navigate(`/calendar?date=${d.date}`)}
                className="tnum aspect-square rounded-md text-[11px] transition-transform duration-100 hover:scale-[1.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{ background: heatColor(d.pnl, cal.maxAbs), color: heatTextColor(d.pnl, cal.maxAbs) }}
              >
                {d.day}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
