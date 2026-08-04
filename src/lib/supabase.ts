/** Supabase browser client — Phase 4 (auth only). A single instance with
 *  supabase-js's default localStorage session persistence (key
 *  `sb-<ref>-auth-token`). The publishable/anon key is safe in the browser
 *  bundle — Row Level Security is the real boundary. */

import { createClient } from "@supabase/supabase-js";

// Vite inlines import.meta.env.VITE_* at build time. Typed locally so this file
// needs no ambient vite/client reference.
const env = (import.meta as unknown as {
  env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
}).env;

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.",
  );
}

export const supabase = createClient(url, anonKey);
