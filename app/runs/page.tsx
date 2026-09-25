import Link from "next/link";
import { listRuns } from "@/lib/data";
import { fmtDate, fx } from "@/components/ui";

export const revalidate = 300;

export default async function Runs() {
  const runs = await listRuns();
  return (
    <section className="section">
      <h2>All reports</h2>
      <div className="tablewrap"><table>
        <thead><tr><th>Date</th><th>Market</th><th className="r">KLCI</th><th className="r">Early</th><th className="r">Ready to buy</th><th>Notes</th></tr></thead>
        <tbody>{runs.map(r => (
          <tr key={r.run_date}>
            <td><Link href={`/runs/${r.run_date}`}>{fmtDate(r.run_date)}</Link></td>
            <td><span className={`chip ${r.market_pass ? "up" : "down"}`}>{r.verdict}{r.market_pass ? "" : " · stay out"}</span></td>
            <td className="r">{fx(r.klci_close)}</td>
            <td className="r">{r.counts?.early ?? "–"}</td><td className="r">{r.counts?.picks ?? 0}</td>
            <td style={{ whiteSpace: "normal", maxWidth: 420 }} className="muted">{(r.notes ?? "").slice(0, 140)}{(r.notes ?? "").length > 140 ? "…" : ""}</td>
          </tr>))}
        </tbody>
      </table></div>
    </section>
  );
}
