# LedgerX — Supabase database

Versioned Postgres schema for LedgerX. The React app still runs entirely on
localStorage; this schema is the cloud backend that later phases wire up.

## Apply the schema to your project

```bash
npm i -D supabase                          # already installed
npx supabase login                         # opens a browser, one time
npx supabase link --project-ref <ref>      # <ref> = your project ref (Dashboard → Settings → General)
npx supabase db push                       # applies supabase/migrations/*.sql
```

`db push` runs every migration in `supabase/migrations/` in filename order
against the linked remote database.

## Reset (⚠️ destroys all data in the linked project)

There is no automatic down-migration. To rebuild from scratch, drop the tables
in the SQL editor (or the Dashboard) and re-run `npx supabase db push`.

## Conventions (see the migration header for the full contract)

- Column names are the exact TypeScript field names (camelCase, quoted); the
  Worker streams rows through unchanged, so column names are the JSON keys.
- All dates/times are `text`, all numbers `double precision`, all ids `text`.
- Primary key is `(user_id, id)`; every table is RLS-scoped to `auth.uid()`.
- `authenticated` has full CRUD; `anon` has no access.
