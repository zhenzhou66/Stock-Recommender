import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Source = { title: string; publisher?: string; date?: string; url: string };
export type Check = { ok: boolean; label: string };
export type Market = {
  pass: boolean; verdict?: string; summary?: string; checks?: Check[]; sources?: Source[];
  klci?: { last?: number; chg_pct?: number; ma50?: number; ma200?: number; monthly_ma10?: number; ret_1m?: number };
};
export type Sector = {
  name: string; rank?: number | null; pass: boolean; trend?: string | null; perf_1m?: number | null; perf_3m?: number | null;
  volume_trend?: string | null; hot_reason?: string | null; earnings_outlook?: string | null; checks: Check[]; sources: Source[];
};
export type Catalyst = { title: string; when_text?: string | null; theme?: string | null; detail?: string | null; beneficiaries: string[]; sources: Source[] };
export type Candidate = {
  kind: "early" | "pick" | "ran"; code: string; name?: string | null; theme?: string | null; price?: number | null; chg_pct?: number | null;
  readiness?: number | null; setup?: string | null; trigger?: number | null; stop?: number | null; tp1?: number | null; tp2?: number | null;
  pe?: number | null; roe?: number | null; eps_growth?: number | null; de?: number | null; mcap_rm_m?: number | null;
  why?: string | null; passes: string[]; fails: string[]; bears: string[]; sources: Source[]; extra: Record<string, any>;
};
export type Run = {
  run_date: string; market_pass: boolean; verdict?: string | null; klci_close?: number | null; market: Market;
  counts?: Record<string, number> | null; notes?: string | null;
};
export type RunFull = Run & { sectors: Sector[]; catalysts: Catalyst[]; candidates: Candidate[] };
export type Snapshot = Record<string, any> & { run_date: string; code: string };
export type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number };

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let sb: SupabaseClient | null = null;
function client() {
  if (!URL_ || !KEY) return null;
  sb ??= createClient(URL_, KEY, { auth: { persistSession: false } });
  return sb;
}
export const usingLocalData = () => !client();

/* ---------- local fallback (reads the repo's data/ folder; used when Supabase env vars are not set) ---------- */
const DATA = join(process.cwd(), "data");
const rj = (p: string) => JSON.parse(readFileSync(p, "utf8"));
function localRunDates(): string[] {
  const d = join(DATA, "runs");
  return existsSync(d) ? readdirSync(d).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).sort().reverse() : [];
}
function localRun(date: string): RunFull | null {
  const p = join(DATA, "runs", `${date}.json`);
  if (!existsSync(p)) return null;
  const r = rj(p);
  const cand = (kind: Candidate["kind"], x: any): Candidate => ({
    kind, code: x.code, name: x.name, theme: x.theme ?? x.sector, price: x.price, chg_pct: x.chg_pct,
    readiness: x.readiness ?? x.score, setup: x.setup, trigger: x.trigger, stop: x.stop, tp1: x.tp1, tp2: x.tp2,
    pe: x.pe, roe: x.roe, eps_growth: x.eps_growth, de: x.de, mcap_rm_m: x.mcap_rm_m, why: x.why,
    passes: x.passes ?? [], fails: x.fails ?? [], bears: x.bears ?? [], sources: x.sources ?? [], extra: x,
  });
  return {
    run_date: date, market_pass: !!r.market?.pass, verdict: r.market?.verdict, klci_close: r.market?.klci?.last,
    market: r.market, counts: r.counts, notes: r.notes,
    sectors: (r.sectors ?? []).map((s: any) => ({ ...s, checks: s.checks ?? [], sources: s.sources ?? [] })),
    catalysts: (r.catalysts ?? []).map((c: any) => ({ ...c, when_text: c.when, beneficiaries: c.beneficiaries ?? [], sources: c.sources ?? [] })),
    candidates: [...(r.early ?? []).map((x: any) => cand("early", x)), ...(r.picks ?? []).map((x: any) => cand("pick", x)), ...(r.already_ran ?? []).map((x: any) => cand("ran", x))],
  };
}

/* ---------- queries ---------- */
export async function listRuns(): Promise<Run[]> {
  const c = client();
  if (!c) return localRunDates().map(d => localRun(d)!).filter(Boolean);
  const { data, error } = await c.from("runs").select("*").order("run_date", { ascending: false }).limit(200);
  if (error) throw error;
  return data as Run[];
}

export async function getRun(date?: string): Promise<RunFull | null> {
  const c = client();
  if (!c) {
    const d = date ?? localRunDates()[0];
    return d ? localRun(d) : null;
  }
  let q = c.from("runs").select("*");
  q = date ? q.eq("run_date", date) : q.order("run_date", { ascending: false }).limit(1);
  const { data: runs, error } = await q;
  if (error) throw error;
  const run = runs?.[0] as Run | undefined;
  if (!run) return null;
  const [s, k, cand] = await Promise.all([
    c.from("sectors").select("*").eq("run_date", run.run_date).order("rank"),
    c.from("catalysts").select("*").eq("run_date", run.run_date).order("id"),
    c.from("candidates").select("*").eq("run_date", run.run_date).order("readiness", { ascending: false }),
  ]);
  for (const r of [s, k, cand]) if (r.error) throw r.error;
  return { ...run, sectors: s.data as Sector[], catalysts: k.data as Catalyst[], candidates: cand.data as Candidate[] };
}

export async function getStock(code: string) {
  const c = client();
  if (!c) {
    const barsPath = join(DATA, "bars", `${code}.json`);
    const bars: Bar[] = existsSync(barsPath) ? rj(barsPath) : [];
    const snaps: Snapshot[] = [];
    const appearances: (Candidate & { run_date: string })[] = [];
    for (const d of localRunDates()) {
      const sp = join(DATA, "snapshots", `${d}.json`);
      if (existsSync(sp)) { const s = (rj(sp) as any[]).find(x => x.code === code); if (s) snaps.push({ run_date: d, ...s }); }
      const r = localRun(d);
      r?.candidates.filter(x => x.code === code).forEach(x => appearances.push({ ...x, run_date: d }));
    }
    return { bars, snaps, appearances };
  }
  const [b, s, a] = await Promise.all([
    c.from("price_bars").select("date,open,high,low,close,volume").eq("code", code).order("date").limit(1000),
    c.from("stock_snapshots").select("*").eq("code", code).order("run_date", { ascending: false }).limit(120),
    c.from("candidates").select("*").eq("code", code).order("run_date", { ascending: false }).limit(60),
  ]);
  for (const r of [b, s, a]) if (r.error) throw r.error;
  return { bars: (b.data ?? []) as Bar[], snaps: (s.data ?? []) as Snapshot[], appearances: (a.data ?? []) as (Candidate & { run_date: string })[] };
}
