import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { Toaster } from "@/components/ui/Toaster";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/store/useStore";

/** App shell: collapsible sidebar + topbar + routed page content. */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("ledgerx-sidebar") === "1");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const hydrated = useStore((s) => s.hydrated);
  const hydrateError = useStore((s) => s.hydrateError);
  const hydrate = useStore((s) => s.hydrate);

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

  // Load the user's cloud data once — we're already behind RequireAuth (D7).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Never render the app with empty arrays after a failed load — show Retry (D7).
  if (hydrateError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-edge bg-raised p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 text-warning" size={28} aria-hidden />
          <h1 className="text-[16px] font-semibold text-ink">Couldn’t load your data</h1>
          <p className="mt-1.5 break-words text-[13px] text-muted">{hydrateError}</p>
          <Button variant="primary" className="mt-5" onClick={() => void hydrate()}>
            Retry
          </Button>
        </div>
        <Toaster />
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-[1440px] p-6">
        <PageSkeleton />
      </div>
    );
  }

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
