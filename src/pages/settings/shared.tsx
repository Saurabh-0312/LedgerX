/** Shared building blocks for the Settings page cards (owned by the Settings agent). */

import type { ReactNode } from "react";
import { Input } from "@/components/ui/Field";

interface CardFooterProps {
  /** small print shown on the left */
  note?: ReactNode;
  /** shows an "Unsaved changes" marker next to the actions */
  dirty?: boolean;
  children: ReactNode;
}

/** Bottom action row of a settings card: small print left, buttons right. */
export function CardFooter({ note, dirty, children }: CardFooterProps) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-edge-soft pt-4">
      {note && <p className="max-w-[440px] text-[11px] leading-relaxed text-faint">{note}</p>}
      <div className="ml-auto flex items-center gap-2">
        {dirty && (
          <span className="mr-1 whitespace-nowrap text-[11px] font-medium text-warning" role="status">
            Unsaved changes
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

interface RateInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** fixed unit shown inside the control, e.g. "%", "₹/order" */
  suffix?: string;
  max?: number;
}

/** Numeric input with a fixed unit suffix. Value is a string draft so partial entries ("0.", "") don't fight the caret. */
export function RateInput({ id, value, onChange, suffix, max }: RateInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={suffix ? "pr-16" : ""}
      />
      {suffix && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-faint"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Number map → string drafts for controlled inputs. */
export function numsToStrings<K extends string>(source: Record<K, number>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(source) as K[]) out[k] = String(source[k]);
  return out;
}

/**
 * Parse a string draft back to numbers.
 * Returns null when any value is empty, non-numeric, negative, or above `max` (if given).
 */
export function parseNums<K extends string>(
  draft: Record<K, string>,
  keys: readonly K[],
  max?: number,
): Record<K, number> | null {
  const out = {} as Record<K, number>;
  for (const k of keys) {
    const raw = draft[k].trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n) || n < 0) return null;
    if (max !== undefined && n > max) return null;
    out[k] = n;
  }
  return out;
}

/** True when the string draft no longer matches the stored numbers. */
export function draftDirty<K extends string>(
  draft: Record<K, string>,
  source: Record<K, number>,
  keys: readonly K[],
): boolean {
  return keys.some((k) => draft[k].trim() !== String(source[k]));
}
