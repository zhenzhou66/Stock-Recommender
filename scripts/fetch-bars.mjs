// Fetches 2 years of daily prices from Yahoo Finance for every stock named in recent reports
// (early candidates, picks, already-ran) and saves them to Supabase price_bars.
// Usage: node scripts/fetch-bars.mjs            -> Supabase (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//        node scripts/fetch-bars.mjs --local    -> writes data/bars/<CODE>.json instead (for local testing)
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOCAL = process.argv.includes("--local");
const DATA = new URL("../data/", import.meta.url).pathname;
const RECENT_RUNS = 10;

const runFiles = readdirSync(join(DATA, "runs")).filter(f => f.endsWith(".json")).sort().slice(-RECENT_RUNS);
const symbols = new Map(); // code -> yahoo symbol
for (const f of runFiles) {
  const r = JSON.parse(readFileSync(join(DATA, "runs", f), "utf8"));
  for (const x of [...(r.early ?? []), ...(r.picks ?? []), ...(r.already_ran ?? [])]) {
    if (x.code && x.yahoo) symbols.set(x.code, x.yahoo);
  }
}
console.log(`fetching ${symbols.size} stocks`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function bars(yahoo) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?range=2y&interval=1d`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; klse-swing-desk/1.0)" } });
    if (res.ok) {
      const j = await res.json();
      const r = j.chart?.result?.[0];
      if (!r?.timestamp) return [];
      const q = r.indicators.quote[0];
      const tz = (r.meta?.gmtoffset ?? 28800) * 1000;
      return r.timestamp
        .map((t, i) => ({
          date: new Date(t * 1000 + tz).toISOString().slice(0, 10),
          open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] ?? 0,
        }))
        .filter(b => b.open != null && b.close != null && b.high != null && b.low != null)
        .map(b => ({ ...b, open: +b.open.toFixed(4), high: +b.high.toFixed(4), low: +b.low.toFixed(4), close: +b.close.toFixed(4) }));
    }
    console.warn(`  ${yahoo}: HTTP ${res.status}, retry ${attempt}`);
    await sleep(2000 * attempt);
  }
  return [];
}

const sb = LOCAL ? null : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
if (LOCAL) mkdirSync(join(DATA, "bars"), { recursive: true });

for (const [code, yahoo] of symbols) {
  const b = await bars(yahoo);
  if (!b.length) { console.warn(`  ${code}: no data`); continue; }
  if (LOCAL) {
    writeFileSync(join(DATA, "bars", `${code}.json`), JSON.stringify(b));
  } else {
    const rows = b.map(x => ({ code, ...x }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("price_bars").upsert(rows.slice(i, i + 500), { onConflict: "code,date" });
      if (error) throw new Error(`${code}: ${error.message}`);
    }
  }
  console.log(`  ${code} (${yahoo}): ${b.length} bars`);
  await sleep(500);
}
console.log("done");
