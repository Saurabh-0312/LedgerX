import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Trades = lazy(() => import("@/pages/Trades"));
const TradeForm = lazy(() => import("@/pages/TradeForm"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const Charges = lazy(() => import("@/pages/Charges"));
const TaxReport = lazy(() => import("@/pages/TaxReport"));
const Mtf = lazy(() => import("@/pages/Mtf"));
const MtfPositionDetail = lazy(() => import("@/pages/MtfPositionDetail"));
const Goals = lazy(() => import("@/pages/Goals"));
const Journal = lazy(() => import("@/pages/Journal"));
const Accounts = lazy(() => import("@/pages/Accounts"));
const Watchlist = lazy(() => import("@/pages/Watchlist"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Signup = lazy(() => import("@/pages/auth/Signup"));

/** Fullscreen fallback shown while a lazy route chunk is downloading. */
function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
    </div>
  );
}

export default function App() {
  return (
    // future.v7_startTransition wraps route updates in React.startTransition, so a
    // lazy chunk that loads mid-navigation suspends as a transition (the current page
    // stays visible) instead of throwing React #426; Suspense provides its fallback.
    <BrowserRouter future={{ v7_startTransition: true }}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Auth screens live outside the app shell */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/trades/new" element={<TradeForm />} />
            <Route path="/trades/:id/edit" element={<TradeForm />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/charges" element={<Charges />} />
            <Route path="/tax" element={<TaxReport />} />
            <Route path="/mtf" element={<Mtf />} />
            <Route path="/mtf/:id" element={<MtfPositionDetail />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
