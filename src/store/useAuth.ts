/** Auth store — Phase 4. Thin wrapper over supabase-js: it owns the session,
 *  user and a one-time `loading` flag, and exposes sign in / up / out. Session
 *  persistence and token refresh are handled by supabase-js, not here. */

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  /** true until the initial getSession() resolves — gate the UI on this. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>(() => ({
  session: null,
  user: null,
  loading: true,
  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    // With "Confirm email" enabled, signUp returns a user but no session.
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
  },
  signOut: async () => {
    await supabase.auth.signOut();
  },
}));

// Initialise once at module load: seed from any persisted session, then keep
// the store in sync with every future auth event (sign in/out, token refresh).
supabase.auth.getSession().then(({ data }) => {
  useAuth.setState({ session: data.session, user: data.session?.user ?? null, loading: false });
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuth.setState({ session, user: session?.user ?? null, loading: false });
});
