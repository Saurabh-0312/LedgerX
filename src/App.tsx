import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth screens live outside the app shell */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<AppLayout />}>
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
    </BrowserRouter>
  );
}
