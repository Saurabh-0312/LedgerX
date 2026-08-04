import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Plus, Search, Settings, User, Wallet } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useAuth } from "@/store/useAuth";
import { Button } from "@/components/ui/Button";
import { DateRangePicker } from "./DateRangePicker";

/** Top bar: search (opens ⌘K palette) · global date range · account filter · add trade · profile. */
export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const navigate = useNavigate();
  const accounts = useStore((s) => s.accounts);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const userName = useStore((s) => s.settings.userName);
  const signOut = useAuth((s) => s.signOut);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [profileOpen]);

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-edge bg-base/60 px-4 backdrop-blur-xl lg:px-6">
      {/* Search — opens the command palette */}
      <button
        onClick={onOpenPalette}
        className="flex h-8 w-full max-w-[280px] items-center gap-2 rounded-[10px] border border-edge bg-raised px-3 text-[13px] text-faint transition-colors hover:border-[#333945] hover:text-muted"
        aria-label="Search trades and pages (Ctrl+K)"
      >
        <Search size={14} aria-hidden />
        <span className="flex-1 text-left">Search trades, symbols…</span>
        <kbd className="rounded border border-edge bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Global filters: date range first, then account (they scope everything) */}
        <DateRangePicker />

        <div className="relative">
          <Wallet size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <select
            value={filters.accountId}
            onChange={(e) => setFilters({ accountId: e.target.value })}
            aria-label="Filter by account"
            className="h-8 cursor-pointer appearance-none rounded-[10px] border border-edge bg-raised pl-8 pr-7 text-[13px] font-medium text-ink transition-colors hover:border-[#333945] focus:border-accent focus:outline-none"
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        </div>

        <Button variant="primary" size="sm" icon={Plus} onClick={() => navigate("/trades/new")} className="hidden sm:inline-flex">
          Add trade
        </Button>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            aria-label="Profile menu"
            aria-expanded={profileOpen}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-[#b3a3ff] ring-1 ring-edge transition-shadow hover:ring-accent/50"
          >
            {initials}
          </button>
          {profileOpen && (
            <div className="animate-pop glass-pop absolute right-0 z-40 mt-1.5 w-[200px] rounded-xl p-1.5">
              <div className="border-b border-edge px-3 py-2">
                <p className="text-[13px] font-medium text-ink">{userName}</p>
                <p className="text-[11px] text-muted">Personal journal</p>
              </div>
              <MenuLink icon={User} label="Profile" onClick={() => { setProfileOpen(false); navigate("/settings"); }} />
              <MenuLink icon={Settings} label="Settings" onClick={() => { setProfileOpen(false); navigate("/settings"); }} />
              <MenuLink icon={LogOut} label="Log out" onClick={async () => { setProfileOpen(false); await signOut(); navigate("/login"); }} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ icon: Icon, label, onClick }: { icon: typeof User; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
    >
      <Icon size={15} aria-hidden />
      {label}
    </button>
  );
}
