import Link from "next/link";
import PriceChart from "@/components/PriceChart";
import { getStock } from "@/lib/data";
import { List, Sources, WhyLevels, fmtDate, fx, pct, planMath } from "@/components/ui";

export const revalidate = 300;

export default async function StockPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).toUpperCase();
  const { bars, snaps, appearances } = await getStock(code);
  const latest = appearances[0];
  const snap = snaps[0];
  const m = planMath(latest ?? {});
  const levels = latest ? [
    { price: Number(latest.trigger), title: "Buy above", color: "#0C6A80" },
    { price: Number(latest.stop), title: "Stop", color: "#BE3A3A" },
    { price: Number(latest.tp1), title: "TP1", color: "#1D8049" },
    { price: Number(latest.tp2), title: "TP2", color: "#1D8049" },
  ] : [];
  return (
    <>
      <div>
        <div className="label">{latest?.theme ?? snap?.industry ?? ""}</div>
        <h2 style={{ fontSize: 26 }}><span className="num">{code}</span> {latest?.name ?? snap?.name ?? ""}</h2>
        {snap && <p className="muted">RM {fx(snap.close, 3)} <span className={Number(snap.change_pct) >= 0 ? "up" : "down"}>{pct(snap.change_pct)}</span> · data as of {fmtDate(snap.run_date)}</p>}
      </div>

      <PriceChart bars={bars} levels={levels} />

      {latest && (
        <section className="two">
          <div className="card">
            <h3>Plan from the {fmtDate(latest.run_date)} report</h3>
            <div className="levels">
              <div><span className="label">Buy above</span><span className="v" style={{ color: "var(--accent)" }}>{fx(latest.trigger, 3)}</span></div>
              <div><span className="label">Stop-loss</span><span className="v down">{fx(latest.stop, 3)}</span></div>
              <div><span className="label">TP1{m.tp1R ? ` (${m.tp1R.toFixed(1)}R)` : ""}</span><span className="v up">{fx(latest.tp1, 3)}</span></div>
              <div><span className="label">TP2{m.tp2R ? ` (${m.tp2R.toFixed(1)}R)` : ""}</span><span className="v up">{fx(latest.tp2, 3)}</span></div>
            </div>
            <WhyLevels p={latest} note={latest.extra?.plan_note} open />
            <p style={{ fontSize: 14 }}>{latest.why}</p>
            <List items={latest.passes} ok /><List items={latest.fails} ok={false} />
          </div>
          <div className="card">
            <h3>Bearish reasons</h3>
            <ol className="bears">{latest.bears.map((b, i) => <li key={i}>{b}</li>)}</ol>
            <h3 style={{ marginTop: 8 }}>Fundamentals</h3>
            <table><tbody>
              <tr><td>P/E</td><td className="r">{fx(latest.pe, 1)}</td></tr>
              <tr><td>ROE</td><td className="r">{fx(latest.roe, 1)}%</td></tr>
              <tr><td>Earnings growth (YoY)</td><td className="r">{pct(latest.eps_growth)}</td></tr>
              <tr><td>Debt/equity</td><td className="r">{fx(latest.de, 0)}%</td></tr>
              <tr><td>Market cap</td><td className="r">RM {Number(latest.mcap_rm_m ?? 0).toLocaleString("en-MY")}m</td></tr>
            </tbody></table>
            <Sources sources={latest.sources} />
          </div>
        </section>
      )}

      {appearances.length > 0 && (
        <section className="section"><h3>Appearances in reports</h3>
          <div className="tablewrap"><table>
            <thead><tr><th>Report</th><th>List</th><th className="r">Price</th><th className="r">Readiness</th><th className="r">Buy above</th><th className="r">Stop</th><th className="r">TP1</th></tr></thead>
            <tbody>{appearances.map(a => (
              <tr key={a.run_date + a.kind}>
                <td><Link href={`/runs/${a.run_date}`}>{fmtDate(a.run_date)}</Link></td>
                <td>{a.kind === "early" ? "Early candidate" : a.kind === "pick" ? "Ready to buy" : "Already ran"}</td>
                <td className="r">{fx(a.price, 3)}</td><td className="r">{a.readiness ?? "–"}</td>
                <td className="r">{fx(a.trigger, 3)}</td><td className="r">{fx(a.stop, 3)}</td><td className="r">{fx(a.tp1, 3)}</td>
              </tr>))}
            </tbody>
          </table></div>
        </section>
      )}

      {snaps.length > 0 && (
        <section className="section"><h3>Snapshot history</h3>
          <div className="tablewrap"><table>
            <thead><tr><th>Date</th><th className="r">Close</th><th className="r">RSI</th><th className="r">MA50</th><th className="r">MA200</th><th className="r">P/E</th><th className="r">ROE %</th><th className="r">1M</th><th className="r">3M</th></tr></thead>
            <tbody>{snaps.map(s => (
              <tr key={s.run_date}><td>{fmtDate(s.run_date)}</td><td className="r">{fx(s.close, 3)}</td><td className="r">{fx(s.rsi, 0)}</td><td className="r">{fx(s.sma50, 3)}</td><td className="r">{fx(s.sma200, 3)}</td><td className="r">{fx(s.pe, 1)}</td><td className="r">{fx(s.roe, 1)}</td><td className="r">{pct(s.perf_1m)}</td><td className="r">{pct(s.perf_3m)}</td></tr>))}
            </tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
