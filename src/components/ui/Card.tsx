import type { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** right side of the header — filters, menus, buttons */
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** The house card: dark surface, 1px border, 14px radius, soft shadow. */
export function Card({ title, subtitle, action, className = "", bodyClassName = "", children }: CardProps) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-0">
          <div className="min-w-0">
            {title && <h3 className="text-[14px] font-semibold text-ink leading-tight">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`p-5 ${title || action ? "pt-4" : ""} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
