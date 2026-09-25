// Loads everything under data/ into Supabase. Safe to re-run: each run date is replaced as a whole.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (set as GitHub Actions secrets; never commit them).
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const DATA = new URL("../data/", import.meta.url).pathname;
const readJson = p => JSON.parse(readFileSync(p, "utf8"));
const list = dir => (existsSync(join(DATA, dir)) ? readdirSync(join(DATA, dir)).filter(f => f.endsWith(".json")).sort() : []);

async function must(res, what) {
  const { error } = await res;
  if (error) throw new Error(`${what}: ${error.message}`);
}
async function chunked(table, rows, opts = {}) {
  for (let i = 0; i < rows.length; i += 500) {
    await must(sb.from(table).upsert(rows.slice(i, i + 500), opts), `${table} upsert`);
  }
}

const onlyDates = process.argv.slice(2); // optional: node sync.mjs 2026-09-25

for (const f of list("runs")) {
  const date = f.replace(".json", "");
  if (onlyDates.length && !onlyDates.includes(date)) continue;
  const r = readJson(join(DATA, "runs", f));
  console.log(`run ${date}`);

  await must(sb.from("runs").upsert({
    run_date: date,
    created_at: r.createdAt ?? new Date().toISOString(),
    market_pass: !!r.market?.pass,
    verdict: r.market?.verdict ?? null,
    klci_close: r.market?.klci?.last ?? null,
    market: r.market ?? {},
    counts: r.counts ?? null,
    notes: r.notes ?? null,
  }), "runs upsert");

  for (const t of ["sectors", "catalysts", "candidates"]) {
    await must(sb.from(t).delete().eq("run_date", date), `${t} clear`);
  }

  const sectors = (r.sectors ?? []).map(s => ({
    run_date: date, name: s.name, rank: s.rank ?? null, pass: !!s.pass, trend: s.trend ?? null,
    perf_1m: s.perf_1m ?? null, perf_3m: s.perf_3m ?? null, volume_trend: s.volume_trend ?? null,
    hot_reason: s.hot_reason ?? null, earnings_outlook: s.earnings_outlook ?? null,
    checks: s.checks ?? [], sources: s.sources ?? [],
  }));
  if (sectors.length) await must(sb.from("sectors").insert(sectors), "sectors insert");

  const catalysts = (r.catalysts ?? []).map(c => ({
    run_date: date, title: c.title, when_text: c.when ?? null, theme: c.theme ?? null, detail: c.detail ?? null,
    beneficiaries: c.beneficiaries ?? [], sources: c.sources ?? [],
  }));
  if (catalysts.length) await must(sb.from("catalysts").insert(catalysts), "catalysts insert");

  const cand = (kind, p) => ({
    run_date: date, kind, code: p.code, name: p.name ?? null, theme: p.theme ?? p.sector ?? null,
    price: p.price ?? null, chg_pct: p.chg_pct ?? null, readiness: p.readiness ?? p.score ?? null,
    setup: p.setup ?? null, trigger: p.trigger ?? null, stop: p.stop ?? null, tp1: p.tp1 ?? null, tp2: p.tp2 ?? null,
    pe: p.pe ?? null, roe: p.roe ?? null, eps_growth: p.eps_growth ?? null, de: p.de ?? null, mcap_rm_m: p.mcap_rm_m ?? null,
    why: p.why ?? null, passes: p.passes ?? [], fails: p.fails ?? [], bears: p.bears ?? [], sources: p.sources ?? [],
    extra: Object.fromEntries(Object.entries(p).filter(([k]) => ["perf_w", "perf_1m", "rsi", "ext50", "zone", "valuation_note", "plan_note", "breakdown", "stop_basis", "yahoo"].includes(k))),
  });
  const candidates = [
    ...(r.early ?? []).map(p => cand("early", p)),
    ...(r.picks ?? []).map(p => cand("pick", p)),
    ...(r.already_ran ?? []).map(p => cand("ran", p)),
  ];
  if (candidates.length) await must(sb.from("candidates").insert(candidates), "candidates insert");

  const snapPath = join(DATA, "snapshots", f);
  if (existsSync(snapPath)) {
    const rows = readJson(snapPath).map(s => ({ run_date: date, ...s }));
    await chunked("stock_snapshots", rows, { onConflict: "run_date,code" });
    console.log(`  ${rows.length} stock snapshots`);
  }
}

for (const f of list("bars")) {
  const code = f.replace(".json", "");
  const rows = readJson(join(DATA, "bars", f)).map(b => ({ code, ...b }));
  await chunked("price_bars", rows, { onConflict: "code,date" });
  console.log(`bars ${code}: ${rows.length}`);
}
console.log("done");
