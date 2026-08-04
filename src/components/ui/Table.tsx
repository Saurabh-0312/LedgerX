import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/** Horizontal-scroll-safe table shell with house styling.
 *  Numeric columns: add className="tnum text-right" to TH/TD. */
export function TableShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function TH({ className = "", children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`label-caps border-b border-edge px-3 py-2.5 text-left font-semibold whitespace-nowrap ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({ className = "", children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`border-b border-edge-soft px-3 py-2.5 align-middle whitespace-nowrap ${className}`} {...rest}>
      {children}
    </td>
  );
}

/** Clickable-row helper: <tr className={rowClass}> */
export const rowClass = "transition-colors hover:bg-raised/60 cursor-pointer";
