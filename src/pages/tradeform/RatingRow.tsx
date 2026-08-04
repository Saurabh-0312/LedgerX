/** 1–5 rating as a segmented button row (emotion / confidence). */

import type { Rating } from "@/types";

const STEPS: Rating[] = [1, 2, 3, 4, 5];

interface RatingRowProps {
  /** used for the group + per-button aria labels */
  label: string;
  value: Rating;
  onChange: (r: Rating) => void;
}

export function RatingRow({ label, value, onChange }: RatingRowProps) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {STEPS.map((n) => {
        const filled = n <= value;
        const selected = n === value;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} of 5`}
            aria-pressed={selected}
            onClick={() => onChange(n)}
            className={`h-9 flex-1 cursor-pointer rounded-[10px] border text-[13px] font-semibold transition-colors duration-150 ${
              filled
                ? "border-accent/40 bg-accent-soft text-[#a18bff]"
                : "border-edge bg-raised text-faint hover:border-[#333945] hover:text-muted"
            } ${selected ? "ring-1 ring-accent/50" : ""}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
