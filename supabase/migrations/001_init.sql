-- KLSE Swing Desk schema. Run once in Supabase: SQL Editor -> paste -> Run.
-- The website only READS (anon key). Writes happen from the GitHub Action with the service-role key.

create table if not exists runs (
  run_date     date primary key,
  created_at   timestamptz not null default now(),
  market_pass  boolean not null,
  verdict      text,
  klci_close   numeric,
  market       jsonb not null,           -- checks, summary, klci numbers, sources
  counts       jsonb,
  notes        text
);

create table if not exists sectors (
  id               bigint generated always as identity primary key,
  run_date         date not null references runs(run_date) on delete cascade,
  name             text not null,
  rank             int,
  pass             boolean,
  trend            text,
  perf_1m          numeric,
  perf_3m          numeric,
  volume_trend     text,
  hot_reason       text,
  earnings_outlook text,
  checks           jsonb default '[]',
  sources          jsonb default '[]'
);

create table if not exists catalysts (
  id            bigint generated always as identity primary key,
  run_date      date not null references runs(run_date) on delete cascade,
  title         text not null,
  when_text     text,
  theme         text,
  detail        text,
  beneficiaries jsonb default '[]',
  sources       jsonb default '[]'
);

-- early = setting up, pick = ready to buy, ran = already ran (wait for pullback)
create table if not exists candidates (
  id          bigint generated always as identity primary key,
  run_date    date not null references runs(run_date) on delete cascade,
  kind        text not null check (kind in ('early','pick','ran')),
  code        text not null,
  name        text,
  theme       text,
  price       numeric,
  chg_pct     numeric,
  readiness   int,
  setup       text,
  trigger     numeric,
  stop        numeric,
  tp1         numeric,
  tp2         numeric,
  pe          numeric,
  roe         numeric,
  eps_growth  numeric,
  de          numeric,
  mcap_rm_m   numeric,
  why         text,
  passes      jsonb default '[]',
  fails       jsonb default '[]',
  bears       jsonb default '[]',
  sources     jsonb default '[]',
  extra       jsonb default '{}',
  unique (run_date, kind, code)
);

-- one row per stock per run: the full screen the analysis was based on
create table if not exists stock_snapshots (
  run_date    date not null references runs(run_date) on delete cascade,
  code        text not null,
  name        text,
  sector      text,
  industry    text,
  close       numeric,
  change_pct  numeric,
  volume      numeric,
  avg_vol_30d numeric,
  mcap        numeric,
  pe          numeric,
  pb          numeric,
  div_yield   numeric,
  roe         numeric,
  de          numeric,
  rev_growth  numeric,
  eps_growth  numeric,
  sma20       numeric,
  sma50       numeric,
  sma200      numeric,
  rsi         numeric,
  perf_w      numeric,
  perf_1m     numeric,
  perf_3m     numeric,
  atr         numeric,
  high_1m     numeric,
  low_1m      numeric,
  high_3m     numeric,
  primary key (run_date, code)
);

-- daily OHLCV for charts
create table if not exists price_bars (
  code   text not null,
  date   date not null,
  open   numeric,
  high   numeric,
  low    numeric,
  close  numeric,
  volume numeric,
  primary key (code, date)
);

create index if not exists candidates_code_idx on candidates(code);
create index if not exists snapshots_code_idx on stock_snapshots(code);

-- Read-only access for the website
alter table runs            enable row level security;
alter table sectors         enable row level security;
alter table catalysts       enable row level security;
alter table candidates      enable row level security;
alter table stock_snapshots enable row level security;
alter table price_bars      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['runs','sectors','catalysts','candidates','stock_snapshots','price_bars'] loop
    execute format('drop policy if exists "read all" on %I', t);
    execute format('create policy "read all" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;
