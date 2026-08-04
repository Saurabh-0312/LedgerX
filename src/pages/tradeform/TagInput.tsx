/** Chip-style tag input: type + Enter adds, × removes, existing tags suggested below. */

import { useRef, useState } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  id?: string;
  tags: string[];
  /** existing tags across the journal, most used first */
  suggestions: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ id, tags, suggestions, onChange }: TagInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const t = raw.trim();
    setText("");
    if (!t) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...tags, t]);
  };

  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  const remaining = suggestions
    .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
    .slice(0, 10);

  return (
    <div>
      {/* clicking anywhere in the shell focuses the inner text input */}
      <div
        className="input-base flex min-h-[40px] cursor-text flex-wrap items-center gap-1.5 focus-within:border-accent"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-[#a18bff]"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(t);
              }}
              className="cursor-pointer rounded-sm text-[#a18bff]/60 transition-colors duration-150 hover:text-[#a18bff]"
            >
              <X size={11} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && text === "" && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          placeholder={tags.length === 0 ? "Type a tag and press Enter" : ""}
          className="min-w-[140px] flex-1 border-0 bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-faint"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-faint">Suggested:</span>
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="cursor-pointer rounded-md border border-edge bg-raised px-2 py-0.5 text-[11px] text-muted transition-colors duration-150 hover:border-[#333945] hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
