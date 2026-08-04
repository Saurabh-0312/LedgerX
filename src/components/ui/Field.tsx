import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}

/** Label + control wrapper. Usage: <Field label="Symbol">{(id) => <Input id={id} …/>}</Field> */
export function Field({ label, hint, error, required, children, className = "" }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-muted">
        {label}
        {required && <span className="ml-0.5 text-loss">*</span>}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-loss">{error}</p>}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input-base ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input-base appearance-none cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input-base min-h-[90px] resize-y ${className}`} {...rest} />;
}
