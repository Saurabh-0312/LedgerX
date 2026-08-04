import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** max width utility, default max-w-lg */
  widthClass?: string;
}

/** Centered modal dialog. ESC / backdrop click to close. */
export function Modal({ open, onClose, title, children, widthClass = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]" role="dialog" aria-modal="true">
      <button aria-label="Close" className="fixed inset-0 bg-black/60 backdrop-blur-[2px] cursor-default" onClick={onClose} />
      <div className={`animate-pop glass-pop relative w-full ${widthClass} rounded-2xl`}>
        {title && (
          <header className="flex items-center justify-between border-b border-edge px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink">
              <X size={16} />
            </button>
          </header>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** width utility, default w-[480px] */
  widthClass?: string;
}

/** Right-side drawer — trade detail, day detail, etc. */
export function Drawer({ open, onClose, title, children, widthClass = "w-full max-w-[520px]" }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-[2px] cursor-default" onClick={onClose} />
      <div className={`glass-pop absolute right-0 top-0 h-full ${widthClass} animate-[drawer-in_0.25s_cubic-bezier(0.21,1.02,0.73,1)_both] overflow-y-auto !rounded-none border-y-0 border-r-0`}>
        <style>{`@keyframes drawer-in { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-[#16181d]/80 px-5 py-4 backdrop-blur-xl">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close drawer" className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink">
            <X size={16} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
