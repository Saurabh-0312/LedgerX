/** Mood metadata shared by the Journal timeline, filter chips and composer. */

import type { Mood } from "@/types";
import type { BadgeTone } from "@/components/ui/Badge";

export const MOOD_ORDER: Mood[] = ["great", "good", "neutral", "bad", "terrible"];

export interface MoodMeta {
  label: string;
  /** Tailwind bg-* class for the mood dot */
  dot: string;
  /** Badge tone for the mood pill */
  tone: BadgeTone;
}

export const MOOD_META: Record<Mood, MoodMeta> = {
  great: { label: "Great", dot: "bg-profit", tone: "profit" },
  good: { label: "Good", dot: "bg-info", tone: "info" },
  neutral: { label: "Neutral", dot: "bg-muted", tone: "neutral" },
  bad: { label: "Bad", dot: "bg-warning", tone: "warning" },
  terrible: { label: "Terrible", dot: "bg-loss", tone: "loss" },
};
