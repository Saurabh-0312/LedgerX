import { Gauge } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";

export interface DisciplineRow {
  label: string;
  /** earned points, 0–25 */
  pts: number;
  /** short explanation of the current score */
  note: string;
}

interface DisciplineCardProps {
  score: number; // 0–100
  rows: DisciplineRow[];
  /** false when the current month has no trades at all */
  hasActivity: boolean;
}

type Tone = "accent" | "profit" | "loss" | "warning";

const toneFor = (ratio: number): Tone => (ratio >= 0.75 ? "profit" : ratio >= 0.4 ? "accent" : "loss");

const gradeFor = (score: number): { text: string; tone: "profit" | "accent" | "warning" | "loss" } => {
  if (score >= 80) return { text: "Excellent", tone: "profit" };
  if (score >= 60) return { text: "Solid", tone: "accent" };
  if (score >= 40) return { text: "Needs work", tone: "warning" };
  return { text: "At risk", tone: "loss" };
};

/** 0–100 composite discipline score with a per-component breakdown. */
export function DisciplineCard({ score, rows, hasActivity }: DisciplineCardProps) {
  const grade = gradeFor(score);

  if (!hasActivity) {
    return (
      <Card
        title="Discipline score"
        subtitle="How closely this month tracks your own rules"
        className="animate-in"
      >
        <EmptyState
          icon={Gauge}
          title="No trades this month yet"
          hint="Take a few trades and your discipline score will build up here."
        />
      </Card>
    );
  }

  return (
    <Card
      title="Discipline score"
      subtitle="How closely this month tracks your own rules"
      className="animate-in"
    >
      <div className="flex items-end gap-3">
        <div className="text-[44px] font-semibold leading-none tracking-tight text-ink">
          {Math.round(score)}
        </div>
        <div className="pb-1 text-[13px] text-muted">/ 100</div>
        <div className="ml-auto pb-1">
          <Badge tone={grade.tone}>{grade.text}</Badge>
        </div>
      </div>

      <ProgressBar
        value={score}
        tone={toneFor(score / 100)}
        label="Overall discipline score"
        className="mt-4"
      />

      <ul className="mt-5 space-y-4">
        {rows.map((row) => {
          const ratio = row.pts / 25;
          return (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-medium text-ink">{row.label}</span>
                <span className="tnum shrink-0 text-[12px] text-muted">
                  <span className="font-semibold text-ink">{row.pts.toFixed(1)}</span> / 25
                </span>
              </div>
              <ProgressBar
                value={ratio * 100}
                tone={toneFor(ratio)}
                label={`${row.label} score`}
                className="mt-1.5"
              />
              <p className="mt-1 text-[11px] text-faint">{row.note}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 border-t border-edge-soft pt-3 text-[11px] leading-relaxed text-faint">
        Formula: 25 pts each — profit pace and win rate are capped ratios vs target; every
        daily-loss breach day and every day over the trade cap costs 25% of its component.
      </p>
    </Card>
  );
}
