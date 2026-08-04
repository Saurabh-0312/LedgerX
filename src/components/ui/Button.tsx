import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-[#8d70ff] active:bg-[#6f4ef2] shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
  outline: "border border-edge bg-transparent text-ink hover:bg-raised hover:border-[#333945]",
  ghost: "bg-transparent text-muted hover:bg-raised hover:text-ink",
  danger: "bg-loss-soft text-loss border border-transparent hover:border-loss/40",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-[13px] gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  children?: ReactNode;
}

export function Button({ variant = "outline", size = "md", icon: Icon, children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[10px] font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 14 : 15} aria-hidden />}
      {children}
    </button>
  );
}
