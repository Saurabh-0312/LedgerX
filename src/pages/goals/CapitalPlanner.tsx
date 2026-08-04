/** Portfolio target planner — pick a year, tune the target percentages, and
 *  enter each month's portfolio value. Targets + charts update live. */

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Currency } from "@/lib/format";
import { formatMoney, pnlClass } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { TARGET_COLORS, type MonthTargetRow } from "./portfolioTargets";

interface Props {
  year: number;
  years: number[];
  onYearChange: (y: number) => void;
  percents: number[];
  onPercentsChange: (p: number[]) => void;
  rows: MonthTargetRow[];
  currency: Currency;
  onSetCapital: (ym: string, value: number) => void;
}

const pctLabel = (p: number) => `${Number.isInteger(p) ? p : p.toFixed(1)}%`;

export function CapitalPlanner({
  year,
  years,
  onYearChange,
  percents,
  onPercentsChange,
  rows,
  currency,
  onSetCapital,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newPct, setNewPct] = useState("");

  // reseed the capital drafts whenever the year (or its stored values) changes
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const r of rows) next[r.ym] = r.capital > 0 ? String(r.capital) : "";
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, rows.map((r) => `${r.ym}:${r.capital}`).join(",")]);

  const commit = (ym: string, raw: string) => {
    setDrafts((d) => ({ ...d, [ym]: raw }));
    const n = Number(raw.replace(/[,\s₹$]/g, ""));
    onSetCapital(ym, Number.isFinite(n) && n > 0 ? n : 0);
  };

  const addPercent = () => {
    const n = Number(newPct);
    if (!Number.isFinite(n) || n <= 0 || percents.includes(n)) {
      setNewPct("");
      return;
    }
    onPercentsChange([...percents, n].sort((a, b) => a - b));
    setNewPct("");
  };

  const sym = currency === "INR" ? "₹" : "$";

  return (
    <Card
      title="Monthly plan"
      subtitle="Set each month's portfolio value — targets are that percentage of it"
      action={
        <Select
          aria-label="Year"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="!w-auto !py-1.5 !px-2.5 text-[13px] font-medium"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      }
    >
      {/* target percentages */}
      <div className="mb-4">
        <div className="label-caps mb-2">Target percentages (of month's portfolio)</div>
        <div className="flex flex-wrap items-center gap-2">
          {percents.map((p, i) => (
            <span
              key={p}
              className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-raised px-2.5 py-1.5 text-[13px] font-medium text-ink"
            >
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: TARGET_COLORS[i % TARGET_COLORS.length] }} />
              {pctLabel(p)}
              {percents.length > 1 && (
                <button
                  onClick={() => onPercentsChange(percents.filter((x) => x !== p))}
                  aria-label={`Remove ${pctLabel(p)} target`}
                  className="rounded p-0.5 text-faint hover:text-loss"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="add %"
              value={newPct}
              onChange={(e) => setNewPct(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPercent()}
              className="!w-[84px] !py-1.5 text-[13px]"
            />
            <Button size="sm" variant="ghost" icon={Plus} aria-label="Add target percentage" onClick={addPercent} />
          </span>
        </div>
      </div>

      {/* monthly capital inputs */}
      <div className="label-caps mb-2">Portfolio value by month</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {rows.map((r) => (
          <div key={r.ym} className="rounded-[10px] border border-edge-soft bg-raised/40 p-2.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor={`cap-${r.ym}`} className="text-[12px] font-medium text-muted">
                {r.label}
              </label>
              {r.capital > 0 && r.achieved !== 0 && (
                <span className={`tnum text-[10px] ${pnlClass(r.achieved)}`}>
                  {formatMoney(r.achieved, { currency, compact: true, sign: true })}
                </span>
              )}
            </div>
            <div className="relative mt-1">
              <span aria-hidden className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-faint">
                {sym}
              </span>
              <Input
                id={`cap-${r.ym}`}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="0"
                value={drafts[r.ym] ?? ""}
                onChange={(e) => commit(r.ym, e.target.value)}
                className="!py-1.5 !pl-6 !pr-2 text-[13px]"
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
