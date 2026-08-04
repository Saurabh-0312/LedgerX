import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { heatColor } from "@/components/charts/chartTheme";
import { formatDate, formatMoney, formatNumber, formatPct } from "@/lib/format";
import { calendarMonth } from "@/lib/metrics";
import { datasetToday, useFilteredTrades } from "@/store/useFilteredTrades";
import { DayCell } from "./calendar/DayCell";
import { DayPanel } from "./calendar/DayPanel";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Diverging legend stops rendered with heatColor(v, 1): loss → flat → profit. */
const LEGEND_STOPS = [-1, -0.62, -0.3, 0, 0.3, 0.62, 1] as const;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDay = (s: string): boolean => DAY_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());

interface MonthView {
  year: number;
  month0: number;
}

const monthOf = (isoDay: string): MonthView => ({
  year: Number(isoDay.slice(0, 4)),
  month0: Number(isoDay.slice(5, 7)) - 1,
});

const isoDayOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface CalDay {
  date: string;
  day: number;
  pnl: number;
  trades: number;
}

export default function CalendarPage() {
  const trades = useFilteredTrades();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const anchor = useMemo(() => datasetToday(trades), [trades]);
  const todayKey = isoDayOf(anchor);

  // Month + selected-day state. ?date=yyyy-MM-dd (deep link) wins on mount.
  const [view, setView] = useState<MonthView>(() => {
    const p = searchParams.get("date");
    if (p && isValidDay(p)) return monthOf(p);
    const t = datasetToday(trades);
    return { year: t.getFullYear(), month0: t.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const p = searchParams.get("date");
    return p && isValidDay(p) ? p : null;
  });

  // Keep panel in sync if the URL param changes underneath us (external nav).
  useEffect(() => {
    const raw = searchParams.get("date");
    const valid = raw && isValidDay(raw) ? raw : null;
    if (valid === selectedDate) return;
    setSelectedDate(valid);
    if (valid) setView(monthOf(valid));
  }, [searchParams, selectedDate]);

  const openDay = (date: string) => {
    setSelectedDate(date);
    setSearchParams({ date }, { replace: true });
  };
  const closeDay = () => {
    setSelectedDate(null);
    setSearchParams({}, { replace: true });
  };

  // Month nav closes an open panel so state never dangles across months.
  const changeMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
    if (selectedDate) closeDay();
  };
  const goToAnchorMonth = () => {
    setView({ year: anchor.getFullYear(), month0: anchor.getMonth() });
    if (selectedDate) closeDay();
  };

  const ym = `${view.year}-${String(view.month0 + 1).padStart(2, "0")}`;
  const days = useMemo<CalDay[]>(() => calendarMonth(trades, view.year, view.month0), [trades, view.year, view.month0]);
  const maxAbs = useMemo(() => days.reduce((m, d) => Math.max(m, Math.abs(d.pnl)), 0), [days]);

  const monthStats = useMemo(() => {
    const active = days.filter((d) => d.trades > 0);
    const green = active.filter((d) => d.pnl > 0).length;
    const red = active.filter((d) => d.pnl < 0).length;
    const net = active.reduce((s, d) => s + d.pnl, 0);
    const closed = trades.filter((t) => t.status === "Closed" && t.closedAt !== undefined && t.closedAt.slice(0, 7) === ym);
    const wins = closed.filter((t) => t.netPnl > 0).length;
    const losses = closed.filter((t) => t.netPnl < 0).length;
    const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    let best: CalDay | null = null;
    let worst: CalDay | null = null;
    for (const d of active) {
      if (best === null || d.pnl > best.pnl) best = d;
      if (worst === null || d.pnl < worst.pnl) worst = d;
    }
    return { activeDays: active.length, green, red, net, closedCount: closed.length, wins, losses, winRate, best, worst };
  }, [days, trades, ym]);

  // Monday-first 6×7 grid: leading blanks from the 1st's weekday, padded to 42.
  const cells = useMemo<(CalDay | null)[]>(() => {
    const leading = (new Date(view.year, view.month0, 1).getDay() + 6) % 7;
    const arr: (CalDay | null)[] = Array.from({ length: leading }, () => null);
    arr.push(...days);
    while (arr.length < 42) arr.push(null);
    return arr;
  }, [days, view.year, view.month0]);

  const dayTrades = useMemo(() => {
    if (selectedDate === null) return [];
    return trades
      .filter((t) => (t.closedAt ?? t.openedAt).slice(0, 10) === selectedDate)
      .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
  }, [trades, selectedDate]);

  const monthTitle = `${MONTH_NAMES[view.month0]} ${view.year}`;

  return (
    <div className="animate-in">
      <PageHeader
        title="Calendar"
        description="Daily P&L heatmap — click a day to review its trades."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={goToAnchorMonth}>
              Today
            </Button>
            <div className="flex items-center gap-0.5 rounded-[10px] border border-edge bg-surface p-0.5">
              <Button variant="ghost" size="sm" icon={ChevronLeft} aria-label="Previous month" onClick={() => changeMonth(-1)} />
              <span className="tnum min-w-[132px] text-center text-[13px] font-medium text-ink">{monthTitle}</span>
              <Button variant="ghost" size="sm" icon={ChevronRight} aria-label="Next month" onClick={() => changeMonth(1)} />
            </div>
          </>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Month net P&L"
            value={monthStats.net}
            format={(n) => formatMoney(n, { compact: true, sign: true })}
            toneBySign
            icon={Wallet}
            sub={`${monthStats.closedCount} closed trades`}
          />
          <KpiCard
            label="Trading days"
            value={monthStats.activeDays}
            format={(n) => formatNumber(n)}
            icon={CalendarDays}
            sub={`${monthStats.green} green · ${monthStats.red} red`}
          />
          <KpiCard
            label="Win rate"
            value={monthStats.winRate}
            format={(n) => formatPct(n)}
            icon={Target}
            sub={`${monthStats.wins}W · ${monthStats.losses}L`}
          />
          <KpiCard
            label="Best day"
            value={monthStats.best?.pnl ?? 0}
            format={(n) => formatMoney(n, { compact: true, sign: true })}
            toneBySign
            icon={TrendingUp}
            sub={monthStats.best ? formatDate(monthStats.best.date) : "no trading days"}
          />
          <KpiCard
            label="Worst day"
            value={monthStats.worst?.pnl ?? 0}
            format={(n) => formatMoney(n, { compact: true, sign: true })}
            toneBySign
            icon={TrendingDown}
            sub={monthStats.worst ? formatDate(monthStats.worst.date) : "no trading days"}
          />
        </div>

        <Card title={monthTitle} subtitle="Net P&L per trading day — shade scales with the month's biggest day">
          <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="label-caps py-1 text-center">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map((c, i) =>
              c === null ? (
                <div key={`blank-${i}`} aria-hidden className="min-h-[56px] rounded-lg bg-raised/15 sm:min-h-[84px]" />
              ) : (
                <DayCell
                  key={c.date}
                  date={c.date}
                  day={c.day}
                  pnl={c.pnl}
                  tradeCount={c.trades}
                  maxAbs={maxAbs}
                  weekend={i % 7 >= 5}
                  future={c.date > todayKey}
                  selected={c.date === selectedDate}
                  onOpen={openDay}
                />
              ),
            )}
          </div>

          {monthStats.activeDays === 0 && (
            <EmptyState
              className="py-8"
              icon={CalendarOff}
              title={`No trades in ${monthTitle}`}
              hint="Browse months with ‹ › or widen the date range in the top bar."
            />
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted">
            <span>Loss</span>
            <div className="flex items-center gap-1" role="img" aria-label="Color scale from large loss through flat to large profit">
              {LEGEND_STOPS.map((v) => (
                <span key={v} className="h-3.5 w-6 rounded-[4px]" style={{ backgroundColor: heatColor(v, 1) }} />
              ))}
            </div>
            <span>Profit</span>
            <span className="ml-2 text-faint">less ← P&L → more</span>
          </div>
        </Card>
      </div>

      <DayPanel
        date={selectedDate}
        trades={dayTrades}
        onClose={closeDay}
        onOpenTrade={(id) => navigate(`/trades?highlight=${id}`)}
      />
    </div>
  );
}
