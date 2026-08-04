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
