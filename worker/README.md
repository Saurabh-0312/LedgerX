# LedgerX API — Cloudflare Worker (Hono)

Phase 3 scaffold: `GET /health` + `GET /` + CORS. No DB/auth/data routes yet.
Isolated package — the frontend's root `package.json` is untouched.

## Local dev

```bash
cd worker
npm install
npx wrangler dev            # http://localhost:8787
curl http://localhost:8787/health   # {"ok":true,"service":"ledgerx-api","time":"…"}
```

## Deploy the Worker (needs your Cloudflare login)

```bash
npx wrangler login         # opens a browser, one time
npx wrangler deploy        # publishes to https://ledgerx-api.<subdomain>.workers.dev
curl https://ledgerx-api.<subdomain>.workers.dev/health
```

CORS origins live in `wrangler.toml` → `[vars] CORS_ORIGINS` (comma-separated,
`*` = wildcard label). Edit there, redeploy — no code change.

## Deploy the frontend to Cloudflare Pages (dashboard, one time)

1. **Cloudflare dashboard → Compute (Workers & Pages) → Create → Pages → Connect to Git.**
2. Authorize GitHub, pick repo **`Saurabh-0312/LedgerX`**, branch **`main`**.
3. Build settings:
   - **Project name:** `ledgerx`
   - **Framework preset:** None (or Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Environment variables → add `NODE_VERSION` = `20`** (pins CI to match local).
5. **Save and Deploy.** Note the `https://ledgerx.pages.dev` URL when it finishes.
6. SPA deep links work because the repo already ships `public/_redirects`
   (`/*  /index.html  200`), which Vite copies to `dist/_redirects` and Cloudflare
   Pages honors. Verify `https://ledgerx.pages.dev/trades` and `/settings` load on
   hard refresh; if either 404s, confirm `dist/_redirects` is present in the build.

## Phase 4 — Auth setup (one time, needs the dashboard)

### Supabase → Authentication → Sign In / Providers
1. **Disable "Confirm email".** Supabase's built-in SMTP is rate-limited to a
   couple of emails/hour and will block development. ⚠️ Re-enable this before the
   app is ever opened to other users, or wire a real SMTP provider.
2. **Site URL** → `https://ledgerx.pages.dev`
3. **Redirect URLs** → add `http://localhost:5173/**` and `https://ledgerx.pages.dev/**`

### Local `.env` (repo root — gitignored, never commit)
```
VITE_SUPABASE_URL=https://wdkwwbszbydciywexmnn.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key from Settings → API>
VITE_API_URL=http://localhost:8787
```

### Cloudflare Pages → Settings → Environment variables
Add the same three vars, but set `VITE_API_URL` to the **deployed Worker URL**
(`https://ledgerx-api.saurabhsingh03122000.workers.dev`). Vite inlines `VITE_*`
at build time, so **trigger a Pages redeploy** after adding them.

### Worker
`SUPABASE_URL` / `SUPABASE_ANON_KEY` are already in `wrangler.toml [vars]` (both
public). Run `npx wrangler deploy` to push the auth-enabled Worker. The
`service_role` key is never used anywhere.

## Entity API (Phases 5–6)

Thin authenticated proxy to Supabase PostgREST. Every route requires
`Authorization: Bearer <token>`; the token is forwarded to PostgREST so Postgres
RLS scopes rows to the caller. The Worker holds no `service_role` key. Reads
stream the PostgREST body straight through (never parsed) so CPU stays flat.

### Collection entities — five verbs each (`worker/src/crud.ts`)

The six collection paths below (kebab-case) map to their snake_case tables:

| Path | Table |
|---|---|
| `/api/trades` | `trades` |
| `/api/accounts` | `accounts` |
| `/api/cash-transactions` | `cash_transactions` |
| `/api/journal` | `journal_entries` |
| `/api/watchlist` | `watchlist_items` |
| `/api/mtf/positions` | `mtf_positions` |
| `/api/mtf/brokers` | `mtf_brokers` |

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/api/<path>` | — | all the caller's rows (pass-through stream) |
| `POST` | `/api/<path>` | one row **or** an array | bulk insert; `user_id` forced from token |
| `PATCH` | `/api/<path>/:id` | partial row | `user_id` & `id` stripped; id URL-encoded |
| `DELETE` | `/api/<path>/:id` | — | delete one |
| `DELETE` | `/api/<path>` | `{"ids":[...]}` | bulk delete; empty/all-falsy list = safe no-op |

### Singleton — `/api/settings` → `user_settings` (`worker/src/settings.ts`)

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/api/settings` | — | the caller's row as a 0-or-1 array; `[]` when none yet (never a 500) |
| `PUT` | `/api/settings` | whole settings object | upsert (create or replace); `user_id` forced from token |

No POST/PATCH/DELETE and no `:id` on `/api/settings` — nothing to enumerate or
delete. The client sends the complete object every time (no server-side merging).

- `user_id` always comes from the validated token; any client-supplied value is
  ignored (RLS would reject a mismatch too).
- Errors pass through with PostgREST's status and body — not translated.
- The API adds **no cascade** on `accountId` (only `user_id → auth.users` cascades
  in the DB); the client issues any dependent deletes.

### Known limit — pagination (not implemented)
PostgREST returns **at most 1000 rows** per request by default. Well beyond any
current collection. When it matters, page with a `Range` header (e.g.
`Range: 0-999`, then `1000-1999`, …) on the `GET` fetch; no schema change needed.

### Known limit — `double precision` output rounding (accepted)
Supabase returns `double precision` columns at ~15 significant digits
(`extra_float_digits`), so a value needing 16+ sig-figs (e.g. `avgBuyPrice
1153.297619047619`) round-trips off by ~1e-12 — **far below one paisa**. Every
LedgerX value is displayed and calculated to 2 decimals, so this is invisible in
practice and **accepted**. `jsonb` (numbers stored as `numeric`) is unaffected.
For byte-exact float output, run `alter role authenticator set extra_float_digits = 3;`
in the Supabase SQL editor (a runtime setting, not a schema migration).

### Testing the API
```powershell
# In the browser console at http://localhost:5173 while signed in:
#   const { data } = await (await import("/src/lib/supabase.ts")).supabase.auth.getSession();
#   copy(data.session.access_token);
$env:LEDGERX_TOKEN="<paste the token>"
# optional: $env:LEDGERX_API="http://localhost:8787"   (default)
node test-api.mjs
```
`test-api.mjs` exercises every route and deletes every row it creates. Tokens
expire after ~1 hour — if it starts returning 401, grab a fresh one.
