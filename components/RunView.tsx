import Link from "next/link";
import type { RunFull, Candidate } from "@/lib/data";
import { Checks, List, Sources, cls, fmtDate, fx, pct, scoreCls } from "./ui";

function Market({ r }: { r: RunFull }) {
  const m = r.market, k = m.klci ?? {};
  const tone = m.pass ? (m.verdict === "Sideways" ? "warn" : "up") : "down";
  return (
    <section className="card two">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="label">Step 1 · Market check (FBM KLCI)</div>
        <span className={`badge chip ${tone}`} style={{ alignSelf: "flex-start" }}>
          {m.verdict} · {m.pass ? "go" : "stay out"}
        </span>
        <p>{m.summary}</p>
        <div className="kv">
          <div><span className="label">KLCI</span><span className="v">{fx(k.last)}</span><span className={`num ${cls(k.chg_pct)}`}>{pct(k.chg_pct, 2)}</span></div>
          <div><span className="label">10-month MA</span><span className="v">{fx(k.monthly_ma10, 1)}</span></div>
          <div><span className="label">50-day MA</span><span className="v">{fx(k.ma50, 1)}</span></div>
          <div><span className="label">200-day MA</span><span className="v">{fx(k.ma200, 1)}</span></div>
        </div>
        <Sources sources={m.sources} />
      </div>
      <div><div className="label" style={{ marginBottom: 8 }}>Checks</div><Checks items={m.checks} /></div>
    </section>
  );
}

function Early({ list, marketPass }: { list: Candidate[]; marketPass: boolean }) {
  if (!list.length) return null;
  return (
    <section className="section">
      <div>
        <div className="label">Early candidates · the next potential movers</div>
        <h2>Setting up, not yet run</h2>
        <p className="muted" style={{ maxWidth: 760 }}>
          Act only on a close above the buy trigger with strong volume{marketPass ? "" : ", and only once the market check passes"}. Tap a stock for its chart and full plan.
        </p>
      </div>
      <div className="grid">
        {list.map(p => (
          <article className="card" key={p.code}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className={`score ${scoreCls(p.readiness)}`}>{p.readiness}</span>
              <div>
                <h3><Link href={`/stocks/${encodeURIComponent(p.code)}`}>{p.code}</Link> <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>{p.name}</span></h3>
                <div className="chips"><span className={`chip ${/Breaking/.test(p.setup ?? "") ? "up" : /Near/.test(p.setup ?? "") ? "warn" : ""}`}>{p.setup}</span><span className="chip">{p.theme}</span></div>
              </div>
            </div>
            <div className="levels">
              <div><span className="label">Now</span><span className="v">{fx(p.price, 3)}</span></div>
              <div><span className="label">Buy above</span><span className="v" style={{ color: "var(--accent)" }}>{fx(p.trigger, 3)}</span></div>
              <div><span className="label">Stop</span><span className="v down">{fx(p.stop, 3)}</span></div>
              <div><span className="label">TP1</span><span className="v up">{fx(p.tp1, 3)}</span></div>
            </div>
            <p style={{ fontSize: 14 }}>{p.why}</p>
            <List items={p.passes} ok />
            <List items={p.fails} ok={false} />
            <Link href={`/stocks/${encodeURIComponent(p.code)}`} style={{ fontWeight: 600, fontSize: 14 }}>Chart, bearish reasons &amp; plan →</Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function Ran({ list }: { list: Candidate[] }) {
  if (!list.length) return null;
  return (
    <section className="section">
      <div><div className="label">Already ran · don&apos;t chase</div><h2>Wait for a pullback</h2></div>
      <div className="tablewrap"><table>
        <thead><tr><th>Stock</th><th>Theme</th><th className="r">Price</th><th className="r">1 week</th><th className="r">1 month</th><th className="r">RSI</th><th className="r">vs 50-day MA</th><th>Pullback zone</th></tr></thead>
        <tbody>{list.map(r => (
          <tr key={r.code}>
            <td><Link href={`/stocks/${encodeURIComponent(r.code)}`} className="num">{r.code}</Link> {r.name}</td>
            <td>{r.theme}</td><td className="r">{fx(r.price, 3)}</td>
            <td className="r up">{pct(r.extra?.perf_w)}</td><td className="r up">{pct(r.extra?.perf_1m)}</td>
            <td className="r">{fx(r.extra?.rsi, 0)}</td><td className="r">{pct(r.extra?.ext50)}</td><td>{r.extra?.zone}</td>
          </tr>))}
        </tbody>
      </table></div>
    </section>
  );
}

export default function RunView({ r }: { r: RunFull }) {
  const early = r.candidates.filter(c => c.kind === "early").sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0));
  const picks = r.candidates.filter(c => c.kind === "pick");
  const ran = r.candidates.filter(c => c.kind === "ran");
  return (
    <>
      <div className="label">Report · {fmtDate(r.run_date)}</div>
      <Market r={r} />

      {picks.length > 0 && (
        <section className="section"><h2>Ready to buy</h2>
          <div className="grid">{picks.map(p => (
            <article className="card" key={p.code}><h3><Link href={`/stocks/${p.code}`}>{p.code}</Link> {p.name}</h3>
              <div className="levels"><div><span className="label">Entry</span><span className="v">{fx(p.price, 3)}</span></div><div><span className="label">Stop</span><span className="v down">{fx(p.stop, 3)}</span></div><div><span className="label">TP1</span><span className="v up">{fx(p.tp1, 3)}</span></div><div><span className="label">TP2</span><span className="v up">{fx(p.tp2, 3)}</span></div></div>
            </article>))}</div>
        </section>
      )}

      {r.catalysts.length > 0 && (
        <section className="section">
          <div><div className="label">Catalyst radar</div><h2>Coming up in the next 1–3 months</h2></div>
          <div className="grid">{r.catalysts.map(c => (
            <article className="card" key={c.title}>
              <h3>{c.title}</h3>
              <div className="chips"><span className="chip warn">{c.when_text}</span>{c.theme && <span className="chip">{c.theme}</span>}</div>
              <p style={{ fontSize: 14 }}>{c.detail}</p>
              {c.beneficiaries.length > 0 && <p style={{ fontSize: 14 }}><b>Who could benefit:</b> {c.beneficiaries.join(", ")}</p>}
              <Sources sources={c.sources} />
            </article>))}</div>
        </section>
      )}

      <Early list={early} marketPass={r.market_pass} />
      <Ran list={ran} />

      {r.sectors.length > 0 && (
        <section className="section">
          <div><div className="label">Industries</div><h2>Hot industries and themes</h2></div>
          <div className="grid">{r.sectors.map(s => (
            <article className="card" key={s.name} style={{ opacity: s.pass ? 1 : 0.75 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><h3>{s.name}</h3><span className="num faint">#{s.rank}</span></div>
              <div className="chips"><span className={`chip ${s.pass ? "up" : "down"}`}>{s.pass ? "Qualifies" : "Doesn't qualify"}</span><span className="chip">{s.trend}</span>{s.volume_trend && <span className="chip">Volume {s.volume_trend.toLowerCase()}</span>}</div>
              <div style={{ display: "flex", gap: 18, fontSize: 13 }}>
                <div><span className="label">1 month</span><div className={`num ${cls(s.perf_1m)}`}>{pct(s.perf_1m)}</div></div>
                <div><span className="label">3 months</span><div className={`num ${cls(s.perf_3m)}`}>{pct(s.perf_3m)}</div></div>
              </div>
              {s.hot_reason && <p style={{ fontSize: 14 }}><b>Why:</b> {s.hot_reason}</p>}
              {s.earnings_outlook && <p style={{ fontSize: 14 }}><b>Earnings:</b> {s.earnings_outlook}</p>}
              <Checks items={s.checks} />
              <Sources sources={s.sources} />
            </article>))}</div>
        </section>
      )}

      {r.notes && <section><div className="label">Analyst notes</div><p style={{ maxWidth: 760, marginTop: 4 }}>{r.notes}</p></section>}
    </>
  );
}
