/** Guards the app shell — renders its children only for an authenticated
 *  session. While the initial session check is pending we render nothing, so we
 *  never flash the login screen at an already-signed-in user (or the app at a
 *  signed-out one). Login/Signup live outside this and stay public. */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/store/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
