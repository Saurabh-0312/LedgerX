import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  FileDown,
  LayoutDashboard,
  Landmark,
  NotebookPen,
  Percent,
  PlusCircle,
  Receipt,
  Settings,
  Table2,
  Target,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    title: "Trading",
    items: [
      { to: "/trades", label: "Trades", icon: Table2 },
      { to: "/trades/new", label: "Add Trade", icon: PlusCircle },
      { to: "/watchlist", label: "Watchlist", icon: Eye },
    ],
  },
  {
    title: "Money",
    items: [
      { to: "/charges", label: "Charges & Fees", icon: Receipt },
      { to: "/tax", label: "Tax Report", icon: Landmark },
      { to: "/mtf", label: "MTF Interest", icon: Percent },
      { to: "/accounts", label: "Accounts", icon: Wallet },
    ],
  },
  {
    title: "Growth",
    items: [
      { to: "/goals", label: "Goals", icon: Target },
      { to: "/journal", label: "Journal", icon: NotebookPen },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/reports", label: "Reports", icon: FileDown },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-edge bg-[#0d0e11]/75 backdrop-blur-xl transition-[width] duration-200 ${
        collapsed ? "w-[64px]" : "w-[224px]"
      }`}
    >
      {/* Brand */}
      <div className={`flex h-14 items-center gap-2.5 border-b border-edge-soft px-4 ${collapsed ? "justify-center px-0" : ""}`}>
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden className="shrink-0">
          <rect width="32" height="32" rx="8" fill="#141619" />
          <path d="M9 7v14a2 2 0 0 0 2 2h12" fill="none" stroke="#7C5CFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 17l4-5 3 3 4-6" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            Ledger<span className="text-accent">X</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Primary">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && <div className="label-caps mb-1.5 px-2.5">{section.title}</div>}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        collapsed ? "justify-center px-0" : ""
                      } ${
                        isActive
                          ? "bg-accent-soft text-[#b3a3ff]"
                          : "text-muted hover:bg-raised hover:text-ink"
                      }`
                    }
                  >
                    <item.icon size={17} aria-hidden className="shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-edge-soft p-2.5">
        <button
          onClick={onToggle}
          className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-muted hover:bg-raised hover:text-ink ${
            collapsed ? "justify-center px-0" : ""
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
