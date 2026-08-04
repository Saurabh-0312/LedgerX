import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { Toaster } from "@/components/ui/Toaster";
import { PageSkeleton } from "@/components/ui/Skeleton";

/** App shell: collapsible sidebar + topbar + routed page content. */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("ledgerx-sidebar") === "1");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem("ledgerx-sidebar", collapsed ? "1" : "0");
  }, [collapsed]);

  // Ctrl/Cmd+K anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 lg:px-6">
          {/* key by pathname → re-run the entrance animation on navigation */}
          <div key={location.pathname} className="animate-in">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  );
}
