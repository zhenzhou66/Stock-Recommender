# KLSE Swing Desk

A display-only website for the Bursa Malaysia swing-trading reports Claude produces: market check, catalyst radar, early candidates (with buy trigger, stop-loss and take-profit), stocks that already ran, hot industries, and the full history of every run.

**How the data flows**

1. After each run, Claude commits the report to `data/runs/<date>.json` and the stock screen to `data/snapshots/<date>.json`.
2. The GitHub Action **Sync data to Supabase** loads them into Supabase, then downloads 2 years of daily prices (Yahoo Finance) for every stock named in recent reports.
3. The Next.js site (on Vercel) reads Supabase with the public, read-only key.

Your Supabase service-role key only ever lives in GitHub Secrets. The website and Claude never see it.

## One-time setup

### 1. Supabase
1. Open your Supabase project → **SQL Editor** → paste the contents of `supabase/migrations/001_init.sql` → **Run**.
2. **Project Settings → API**: note the **Project URL**, the **anon / publishable** key and the **service_role / secret** key.

### 2. GitHub secrets (for the sync Action)
Repo → **Settings → Secrets and variables → Actions → New repository secret**:
- `SUPABASE_URL` = your Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = the service_role / secret key

Then **Actions → Sync data to Supabase → Run workflow** to load the data already in the repo.

### 3. Vercel
1. **Add New → Project** → import this repo (framework: Next.js, defaults are fine).
2. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon / publishable key
3. Deploy. Pages refresh from Supabase every 5 minutes.

Without the environment variables the site falls back to reading the `data/` folder directly (handy for local development: `npm install && npm run dev`).

## Pages
- `/` latest report
- `/runs` all reports, `/runs/<date>` one report
- `/stocks/<CODE>` price chart with MA50/MA200 and the buy trigger, stop-loss and targets, plus the stock's history across reports

Not financial advice.
