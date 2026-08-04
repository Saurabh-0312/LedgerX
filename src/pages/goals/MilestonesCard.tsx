import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Circle, Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export interface StreakStat {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}

export interface Milestone {
  label: string;
  achieved: boolean;
  detail: string;
}

interface MilestonesCardProps {
  stats: StreakStat[];
  milestones: Milestone[];
  /** false when the filtered range has no closed trades */
  hasHistory: boolean;
}

/** Streak stats + achievement checklist over the globally-filtered history. */
export function MilestonesCard({ stats, milestones, hasHistory }: MilestonesCardProps) {
  return (
    <Card
      title="Streaks & milestones"
      subtitle="From trade history in the selected range"
      className="animate-in"
    >
      {!hasHistory ? (
        <EmptyState
          icon={Trophy}
          title="No closed trades in range"
          hint="Widen the global date range to see streaks and milestone progress."
        />
      ) : (
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div>
            <p className="label-caps mb-3">Streaks</p>
            <ul className="space-y-3.5">
              {stats.map((stat) => (
                <li key={stat.label} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-edge bg-raised">
                    <stat.icon size={14} className="text-muted" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{stat.label}</span>
                  <span className="shrink-0 text-[12.5px] font-medium text-ink">{stat.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-caps mb-3">Milestones</p>
            <ul className="space-y-3.5">
              {milestones.map((m) => (
                <li key={m.label} className="flex items-start gap-3">
                  {m.achieved ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-profit" aria-hidden />
                  ) : (
                    <Circle size={16} className="mt-0.5 shrink-0 text-faint" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[12.5px] font-medium ${m.achieved ? "text-ink" : "text-muted"}`}
                    >
                      {m.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-faint">{m.detail}</span>
                  </span>
                  <span className="sr-only">{m.achieved ? "Achieved" : "Pending"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
