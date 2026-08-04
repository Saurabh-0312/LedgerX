/** Segmented control — pill button group used for direction / status toggles. */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** classes applied when this option is active (defaults to the accent tint) */
  activeClass?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex gap-1 rounded-[10px] border border-edge bg-raised p-1 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`h-8 min-w-0 flex-1 cursor-pointer rounded-lg px-3 text-[13px] font-medium transition-colors duration-150 ${
              active
                ? (o.activeClass ?? "bg-accent-soft text-[#a18bff]")
                : "text-muted hover:bg-surface/60 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
