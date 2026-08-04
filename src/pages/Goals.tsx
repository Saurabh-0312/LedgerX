import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  Crown,
  Flame,
  Pencil,
  Percent,
  ShieldAlert,
  Target,
  Trophy,
} from "lucide-react";
import type { Goals as GoalsModel } from "@/types";
import { useStore } from "@/store/useStore";
import { datasetToday, useFilteredTrades, useScopeCurrency } from "@/store/useFilteredTrades";
import { toast } from "@/store/toast";
import { closedOf, computeKpis, dailyPnl, monthlyPnl } from "@/lib/metrics";
import {
  formatDate,
  formatDateShort,
  formatMoney,
  formatNumber,
  formatPct,
  pnlClass,
} from "@/lib/format";
import { CalendarRange, Gauge, Layers, Trophy as TrophyIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/ui/KpiCard";
import { GoalProgressCard } from "@/pages/goals/GoalProgressCard";
import { EditGoalsModal } from "@/pages/goals/EditGoalsModal";
import { DisciplineCard, type DisciplineRow } from "@/pages/goals/DisciplineCard";
import { MilestonesCard, type Milestone, type StreakStat } from "@/pages/goals/MilestonesCard";
import {
  buildMonthlyTargetRows,
  targetYears,
  type MonthTargetRow,
} from "@/pages/goals/portfolioTargets";
import { CapitalPlanner } from "@/pages/goals/CapitalPlanner";
import { MonthlyTargetChart } from "@/pages/goals/MonthlyTargetChart";
import { MonthlyTargetTable } from "@/pages/goals/MonthlyTargetTable";

const LAKH = 100_000;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const pctLabel = (p: number) => `${Number.isInteger(p) ? p : p.toFixed(1)}%`;

export default function Goals() {
  const trades = useStore((s) => s.trades);
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const portfolioTargets = useStore((s) => s.portfolioTargets);
  const setTargetPercents = useStore((s) => s.setTargetPercents);
  const setMonthCapital = useStore((s) => s.setMonthCapital);
  const startingCapital = useStore((s) => s.settings.startingCapital);
  const currency = useScopeCurrency();
  const filtered = useFilteredTrades();
  const [editOpen, setEditOpen] = useState(false);

  // ---- Monthly portfolio targets ---------------------------------------------
  const years = useMemo(() => {
    const ys = targetYears(trades, portfolioTargets.capitalByMonth);
    return ys.length ? ys : [datasetToday(trades).getFullYear()];
  }, [trades, portfolioTargets.capitalByMonth]);

  const [yearSel, setYearSel] = useState<number | null>(null);
  const year = yearSel !== null && years.includes(yearSel) ? yearSel : years[years.length - 1];

  const targetRows = useMemo(
    () => buildMonthlyTargetRows(trades, year, portfolioTargets.percents, portfolioTargets.capitalByMonth),
    [trades, year, portfolioTargets],
  );

  const targetSummary = useMemo(() => {
    const withCap = targetRows.filter((r) => r.capital > 0);
    const ytd = targetRows.reduce((a, r) => a + r.achieved, 0);
    const avgPct = withCap.length ? withCap.reduce((a, r) => a + r.achievePct, 0) / withCap.length : 0;
    const topIdx = portfolioTargets.percents.length - 1;
    const topHits = topIdx >= 0 ? targetRows.filter((r) => r.bestTargetHit === topIdx).length : 0;
    const anyHits = targetRows.filter((r) => r.bestTargetHit >= 0).length;
    const best = targetRows.reduce<MonthTargetRow | null>(
      (b, r) => (r.capital > 0 && (b === null || r.achieved > b.achieved) ? r : b),
      null,
    );
    return { ytd, avgPct, topHits, anyHits, best, monthsPlanned: withCap.length };
  }, [targetRows, portfolioTargets.percents.length]);

  /** Chart/table rows trimmed to the last month you've entered a portfolio value
   *  for — the chart is built as you fill months, never into the future. */
  const chartRows = useMemo(() => {
    let last = -1;
    targetRows.forEach((r, i) => {
      if (r.capital > 0) last = i;
    });
    return last >= 0 ? targetRows.slice(0, last + 1) : [];
  }, [targetRows]);


  /** "This month" metrics — always over ALL store trades of the current dataset month,
   *  so goal tracking stays stable regardless of the global topbar range. */
  const month = useMemo(() => {
    const today = datasetToday(trades);
    const y = today.getFullYear();
    const m = today.getMonth();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthName = today.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const inMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === y && d.getMonth() === m;
    };

    const monthTrades = trades.filter(
      (t) => t.status !== "Cancelled" && inMonth(t.closedAt ?? t.openedAt),
    );
    const closed = closedOf(monthTrades);
    const netPnl = closed.reduce((acc, t) => acc + t.netPnl, 0);
    const wins = closed.filter((t) => t.netPnl > 0).length;
    const winRate = closed.length ? (wins / closed.length) * 100 : 0;

    // Daily P&L (close-day) for the loss limit
    const daily = dailyPnl(monthTrades);
    let worstDay: { date: string; pnl: number } | null = null;
    for (const d of daily) {
      if (d.pnl < 0 && (worstDay === null || d.pnl < worstDay.pnl)) worstDay = { date: d.date, pnl: d.pnl };
    }
    const breachDays = daily.filter((d) => d.pnl < -goals.maxDailyLoss);

    // Trades taken per day (open-day) for the trade cap
    const perDay = new Map<string, number>();
    for (const t of trades) {
      if (t.status === "Cancelled" || !inMonth(t.openedAt)) continue;
      const key = t.openedAt.slice(0, 10);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    let busiest = 0;
    let busiestDate: string | null = null;
    for (const [date, n] of [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (n > busiest) {
        busiest = n;
        busiestDate = date;
      }
    }
    const daysOverCap = [...perDay.values()].filter((n) => n > goals.maxTradesPerDay).length;

    // Linear pace: what the target implies you should have banked by today
    const expected = goals.monthlyProfitTarget * (dayOfMonth / daysInMonth);

    return {
      dayOfMonth,
      daysInMonth,
      monthName,
      closedCount: closed.length,
      netPnl,
      wins,
      winRate,
      worstDay,
      breachDays,
      busiest,
      busiestDate,
      daysOverCap,
      expected,
      hasActivity: monthTrades.length > 0 || perDay.size > 0,
    };
  }, [trades, goals]);

  /** Composite 0–100 discipline score, 25 pts per component. */
  const discipline = useMemo(() => {
    const paceRatio =
      month.expected > 0 ? clamp01(month.netPnl / month.expected) : month.netPnl >= 0 ? 1 : 0;
    const winRatio = goals.winRateTarget > 0 ? clamp01(month.winRate / goals.winRateTarget) : 1;
    const lossRatio = Math.max(0, 1 - 0.25 * month.breachDays.length);
    const capRatio = Math.max(0, 1 - 0.25 * month.daysOverCap);

    const rows: DisciplineRow[] = [
      {
        label: "Profit pace",
        pts: paceRatio * 25,
        note: `${formatMoney(month.netPnl, { sign: true, compact: true })} banked vs ${formatMoney(
          month.expected,
          { compact: true },
        )} expected by day ${month.dayOfMonth}`,
      },
      {
        label: "Win rate vs target",
        pts: winRatio * 25,
        note: `${formatPct(month.winRate)} this month vs ${formatPct(goals.winRateTarget, 0)} target`,
      },
      {
        label: "Daily-loss adherence",
        pts: lossRatio * 25,
        note: month.breachDays.length
          ? `${month.breachDays.length} ${plural(month.breachDays.length, "day", "days")} breached the ${formatMoney(goals.maxDailyLoss, { compact: true })} limit`
          : "No day breached the loss limit",
      },
      {
        label: "Trades-per-day adherence",
        pts: capRatio * 25,
        note: month.daysOverCap
          ? `${month.daysOverCap} ${plural(month.daysOverCap, "day", "days")} over the ${goals.maxTradesPerDay}-trade cap`
          : `All days within the ${goals.maxTradesPerDay}-trade cap`,
      },
    ];
    return { rows, score: rows.reduce((acc, r) => acc + r.pts, 0) };
  }, [month, goals]);

  /** Streaks & milestones over the globally-filtered history. */
  const history = useMemo(() => {
    const closed = closedOf(filtered);
    const kpis = computeKpis(filtered, startingCapital);

    const daily = dailyPnl(filtered);
    let greenDays = 0;
    for (let i = daily.length - 1; i >= 0; i--) {
      if (daily[i].pnl > 0) greenDays += 1;
      else break;
    }

    const months = monthlyPnl(filtered);
    let best: (typeof months)[number] | null = null;
    for (const mo of months) if (best === null || mo.pnl > best.pnl) best = mo;
    const targetHit = months.find((mo) => mo.pnl >= goals.monthlyProfitTarget) ?? null;

    let cum = 0;
    let lakhDate: string | null = null;
    for (const t of closed) {
      cum += t.netPnl;
      if (lakhDate === null && cum >= LAKH) lakhDate = t.closedAt ?? t.openedAt;
    }

    return { closedCount: closed.length, kpis, greenDays, best, targetHit, lakhDate, totalNet: cum };
  }, [filtered, startingCapital, goals.monthlyProfitTarget]);

  const handleSaveGoals = (next: GoalsModel) => {
    setGoals(next);
    setEditOpen(false);
    toast("Goals updated");
  };

  // ---- Goal card derivations -------------------------------------------------
  const profitPct =
    goals.monthlyProfitTarget > 0 ? (month.netPnl / goals.monthlyProfitTarget) * 100 : 0;
  const onPace = month.netPnl >= month.expected;

  const winPct = goals.winRateTarget > 0 ? (month.winRate / goals.winRateTarget) * 100 : 100;

  const lossUsedPct =
    goals.maxDailyLoss > 0 && month.worstDay
      ? (Math.abs(month.worstDay.pnl) / goals.maxDailyLoss) * 100
      : 0;
  const firstBreach = month.breachDays.length > 0 ? month.breachDays[0] : null;

  const capPct = goals.maxTradesPerDay > 0 ? (month.busiest / goals.maxTradesPerDay) * 100 : 0;
  const capTone: "accent" | "warning" | "loss" =
    month.busiest > goals.maxTradesPerDay
      ? "loss"
      : month.busiest === goals.maxTradesPerDay
        ? "warning"
        : "accent";

  // ---- Streak stats & milestones ---------------------------------------------
  const streak = history.kpis.currentStreak;
  const streakStats: StreakStat[] = [
    {
      icon: Flame,
      label: "Current streak",
      value:
        streak > 0 ? (
          <Badge tone="profit">{`+${streak} ${plural(streak, "win", "wins")}`}</Badge>
        ) : streak < 0 ? (
          <Badge tone="loss">{`−${Math.abs(streak)} ${plural(Math.abs(streak), "loss", "losses")}`}</Badge>
        ) : (
          <Badge tone="neutral">Flat</Badge>
        ),
    },
    {
      icon: Trophy,
      label: "Max win streak",
      value: `${history.kpis.maxWinStreak} ${plural(history.kpis.maxWinStreak, "trade", "trades")}`,
    },
    {
      icon: CalendarCheck2,
      label: "Green days in a row",
      value: `${history.greenDays} ${plural(history.greenDays, "day", "days")}`,
    },
    {
      icon: Crown,
      label: "Best month",
      value: history.best ? (
        <span className={pnlClass(history.best.pnl)}>
          {history.best.label} · {formatMoney(history.best.pnl, { sign: true, compact: true })}
        </span>
      ) : (
        "—"
      ),
    },
  ];

  const milestones: Milestone[] = [
    {
      label: "First ₹1L net profit",
      achieved: history.lakhDate !== null,
      detail: history.lakhDate
        ? `Crossed on ${formatDate(history.lakhDate)}`
        : `${formatMoney(Math.max(0, LAKH - history.totalNet), { compact: true })} to go`,
    },
    {
      label: `Monthly target hit (${formatMoney(goals.monthlyProfitTarget, { compact: true })})`,
      achieved: history.targetHit !== null,
      detail: history.targetHit
        ? `${history.targetHit.label} · ${formatMoney(history.targetHit.pnl, { sign: true, compact: true })}`
        : history.best
          ? `Best so far: ${history.best.label} · ${formatMoney(history.best.pnl, { sign: true, compact: true })}`
          : "No full month on record yet",
    },
    {
      label: "5-trade win streak",
      achieved: history.kpis.maxWinStreak >= 5,
      detail: `Best run: ${history.kpis.maxWinStreak} in a row`,
    },
    {
      label: "100 closed trades",
      achieved: history.closedCount >= 100,
      detail: `${formatNumber(history.closedCount)} / 100 logged`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Goals & Progress"
        description="Monthly percentage targets on your portfolio, plus behavioural discipline tracking."
        actions={
          <Button variant="outline" icon={Pencil} onClick={() => setEditOpen(true)}>
            Edit goals
          </Button>
        }
      />

      <div className="space-y-4">
        {/* ── Monthly portfolio targets (the headline system) ── */}
        <section className="space-y-4" aria-label="Monthly portfolio targets">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label={`${year} achieved`}
              value={targetSummary.ytd}
              format={(n) => formatMoney(n, { currency, compact: true, sign: true })}
              icon={CalendarRange}
              toneBySign
              sub={`${targetSummary.monthsPlanned} month${targetSummary.monthsPlanned === 1 ? "" : "s"} planned`}
            />
            <KpiCard
              label="Avg achieve %"
              value={targetSummary.avgPct}
              format={(n) => formatPct(n, 2, true)}
              icon={Gauge}
              sub="P&L ÷ portfolio, monthly avg"
            />
            <KpiCard
              label="Hit top target"
              value={targetSummary.topHits}
              format={(n) => formatNumber(Math.round(n))}
              icon={TrophyIcon}
              sub={
                portfolioTargets.percents.length
                  ? `${pctLabel(portfolioTargets.percents[portfolioTargets.percents.length - 1])} · ${targetSummary.anyHits} hit a tier`
                  : "—"
              }
            />
            <KpiCard
              label="Best month"
              value={targetSummary.best?.achieved ?? 0}
              format={(n) => formatMoney(n, { currency, compact: true, sign: true })}
              icon={Layers}
              toneBySign
              sub={targetSummary.best ? targetSummary.best.label : "—"}
            />
          </div>

          <CapitalPlanner
            year={year}
            years={years}
            onYearChange={setYearSel}
            percents={portfolioTargets.percents}
            onPercentsChange={setTargetPercents}
            rows={targetRows}
            currency={currency}
            onSetCapital={setMonthCapital}
          />

          <MonthlyTargetChart
            rows={chartRows}
            percents={portfolioTargets.percents}
            currency={currency}
            mode="amount"
            title="Monthly targets vs achieved"
            subtitle={`White line = profit booked · colored lines = ${portfolioTargets.percents.map(pctLabel).join(" / ")} of that month's portfolio · ${year}`}
            height={420}
          />

          <MonthlyTargetChart
            rows={chartRows}
            percents={portfolioTargets.percents}
            currency={currency}
            mode="percent"
            title="Achieve % vs target %"
            subtitle="White line = your monthly % return · flat colored lines = the fixed % targets"
            height={360}
          />

          <MonthlyTargetChart
            rows={chartRows}
            percents={portfolioTargets.percents}
            currency={currency}
            mode="cumavg"
            title="Running average % return"
            subtitle="White line = the average of every month's % return up to that month — where your average return stands so far this year"
            height={360}
          />

          <MonthlyTargetTable rows={chartRows} percents={portfolioTargets.percents} currency={currency} />
        </section>

        {/* ── Behavioural discipline goals ── */}
        <div className="pt-2">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Discipline & limits</h2>
        </div>

        {/* Goal progress cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <GoalProgressCard
            icon={Target}
            label="Monthly profit"
            value={formatMoney(month.netPnl, { sign: true })}
            valueClassName={pnlClass(month.netPnl)}
            targetLine={`of ${formatMoney(goals.monthlyProfitTarget)} target`}
            pct={profitPct}
            pctText={formatPct(profitPct, 0)}
            tone={month.netPnl < 0 ? "loss" : "profit"}
            hint={
              <>
                {formatMoney(month.netPnl, { sign: true })} by day {month.dayOfMonth} of{" "}
                {month.daysInMonth} vs {formatMoney(Math.round(month.expected))} expected —{" "}
                <span className={onPace ? "text-profit" : "text-loss"}>
                  {onPace ? "ahead of pace" : "behind pace"}
                </span>
              </>
            }
          />

          <GoalProgressCard
            icon={Percent}
            label="Win rate"
            value={formatPct(month.winRate)}
            targetLine={`of ${formatPct(goals.winRateTarget, 0)} target`}
            pct={winPct}
            pctText={formatPct(winPct, 0)}
            tone="accent"
            hint={
              <>
                {month.wins} of {month.closedCount} closed {plural(month.closedCount, "trade", "trades")}{" "}
                won this month —{" "}
                <span className={month.winRate >= goals.winRateTarget ? "text-profit" : "text-loss"}>
                  {month.winRate >= goals.winRateTarget ? "on target" : "below target"}
                </span>
              </>
            }
          />

          <GoalProgressCard
            icon={ShieldAlert}
            label="Max daily loss"
            value={month.worstDay ? formatMoney(month.worstDay.pnl, { sign: true }) : formatMoney(0)}
            valueClassName={month.worstDay ? "text-loss" : "text-ink"}
            targetLine={`worst day vs ${formatMoney(goals.maxDailyLoss)} limit`}
            pct={lossUsedPct}
            pctText={formatPct(lossUsedPct, 0)}
            tone={lossUsedPct > 80 ? "loss" : "accent"}
            hint={
              firstBreach ? (
                <>
                  <span className="text-loss">
                    Breached on {formatDateShort(firstBreach.date)}
                    {month.breachDays.length > 1 && ` +${month.breachDays.length - 1} more`}
                  </span>{" "}
                  — worst day {formatMoney(month.worstDay?.pnl ?? 0, { sign: true })}
                </>
              ) : (
                <>
                  <span className="text-profit">Limit intact</span>
                  {month.worstDay ? (
                    <>
                      {" "}
                      — worst day {formatDateShort(month.worstDay.date)} used {Math.round(lossUsedPct)}%
                      of the limit
                    </>
                  ) : (
                    <> — no red days this month</>
                  )}
                </>
              )
            }
          />

          <GoalProgressCard
            icon={CalendarClock}
            label="Trades per day"
            value={`${month.busiest} ${plural(month.busiest, "trade", "trades")}`}
            targetLine={`busiest day vs cap of ${goals.maxTradesPerDay}/day`}
            pct={capPct}
            pctText={`${month.busiest}/${goals.maxTradesPerDay}`}
            tone={capTone}
            hint={
              <>
                <span className={month.daysOverCap > 0 ? "text-loss" : "text-profit"}>
                  Days over limit: {month.daysOverCap}
                </span>
                {month.busiestDate && <> — busiest on {formatDateShort(month.busiestDate)}</>}
              </>
            }
          />
        </div>

        {/* Discipline + streaks/milestones */}
        <div className="grid gap-4 lg:grid-cols-2">
          <DisciplineCard
            score={discipline.score}
            rows={discipline.rows}
            hasActivity={month.hasActivity}
          />
          <MilestonesCard
            stats={streakStats}
            milestones={milestones}
            hasHistory={history.closedCount > 0}
          />
        </div>
      </div>

      <EditGoalsModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        goals={goals}
        onSave={handleSaveGoals}
      />
    </>
  );
}
