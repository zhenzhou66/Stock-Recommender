import type { ReactNode } from "react";
import type { Check, Source } from "@/lib/data";

export const fx = (v: unknown, d = 2) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "–" : Number(v).toFixed(d);
export const pct = (v: unknown, d = 1) =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? "–" : `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(d)}%`;
export const cls = (v: unknown) => (Number(v) > 0 ? "up" : Number(v) < 0 ? "down" : "");
export const scoreCls = (s?: number | null) => ((s ?? 0) >= 70 ? "s-hi" : (s ?? 0) >= 50 ? "s-mid" : "s-lo");
export const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function Sources({ sources }: { sources?: Source[] }) {
  if (!sources?.length) return null;
  return (
    <details>
      <summary>{sources.length} source{sources.length > 1 ? "s" : ""}</summary>
      <ul>
        {sources.map(s => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>{" "}
            <span className="faint">· {s.publisher}{s.date ? ` · ${s.date}` : ""}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Checks({ items }: { items?: Check[] }) {
  if (!items?.length) return null;
  return (
    <ul className="checks">
      {items.map((c, i) => (
        <li key={i}><span className={c.ok ? "ok" : "no"}>{c.ok ? "✓" : "✗"}</span><span>{c.label}</span></li>
      ))}
    </ul>
  );
}

export function List({ items, ok }: { items?: string[]; ok: boolean }) {
  if (!items?.length) return null;
  return <Checks items={items.map(label => ({ ok, label }))} />;
}

/* ---------- trade levels: the numbers, and where each one comes from ---------- */

export type Levels = { price?: number | null; trigger?: number | null; stop?: number | null; tp1?: number | null; tp2?: number | null };

const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Everything the plan implies but doesn't spell out: the risk unit (1R) and each target as a multiple of it. */
export function planMath(p: Levels) {
  const price = num(p.price), trigger = num(p.trigger), stop = num(p.stop), tp1 = num(p.tp1), tp2 = num(p.tp2);
  const entry = trigger ?? price;                                            // risk is measured from where you actually get in
  const risk = entry !== null && stop !== null && entry > stop ? entry - stop : null;   // 1R, in RM per share
  const over = (tp: number | null) => (tp !== null && entry !== null ? tp - entry : null);
  const asR = (tp: number | null) => { const g = over(tp); return g !== null && risk ? g / risk : null; };
  const asPct = (tp: number | null) => { const g = over(tp); return g !== null && entry ? (g / entry) * 100 : null; };
  return {
    price, trigger, stop, tp1, tp2, entry, risk,
    triggerGapPct: price !== null && trigger !== null && price ? ((trigger - price) / price) * 100 : null,
    stopPct: risk !== null && entry ? -(risk / entry) * 100 : null,
    tp1R: asR(tp1), tp2R: asR(tp2), tp1Pct: asPct(tp1), tp2Pct: asPct(tp2),
  };
}

const rr = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)}R`);

/**
 * Explains each level in the plan rather than only printing it: what the number is,
 * how it was derived from the chart, and what you're meant to do at it.
 */
export function WhyLevels({ p, note, open = false }: { p: Levels; note?: string | null; open?: boolean }) {
  const m = planMath(p);
  if (m.entry === null || m.stop === null) return null;

  const rows: { title: string; value: number | null; cls: string; body: ReactNode }[] = [];

  if (m.trigger !== null) {
    rows.push({
      title: "Buy above", value: m.trigger, cls: "accent",
      body: <>
        The breakout level, {m.triggerGapPct !== null ? <>{pct(m.triggerGapPct)} above today&apos;s {fx(m.price, 3)}</> : "just above the base"}.
        Wait for a daily <b>close</b> above it on roughly 1.5–2× normal volume — don&apos;t buy at the current price. Until that close
        happens the stock is still coiled inside its range, and plenty of ranges break the other way. Buying the close instead of
        the guess is what keeps you out of the failures.
      </>,
    });
  } else {
    rows.push({
      title: "Entry", value: m.price, cls: "",
      body: <>This one has already cleared its trigger, so the plan is priced off the current level. Everything below is measured from here.</>,
    });
  }

  rows.push({
    title: "Stop-loss", value: m.stop, cls: "down",
    body: <>
      {m.risk !== null ? <>{fx(m.risk, 3)} per share below the entry ({pct(m.stopPct)})</> : "Below the base"}. This is the level that
      says you were wrong: it sits under the base, so a close down here means the setup has actually broken rather than just wobbled.
      It also sets your size — <b>shares = the ringgit you&apos;re willing to lose ÷ {fx(m.risk, 3)}</b>. Risking 1% of a RM 20,000
      account, for example, is RM 200 ÷ {fx(m.risk, 3)} ≈ {m.risk ? Math.floor(200 / m.risk).toLocaleString("en-MY") : "–"} shares.
    </>,
  });

  if (m.tp1 !== null) rows.push({
    title: `TP1 · ${rr(m.tp1R)}`, value: m.tp1, cls: "up",
    body: <>
      {pct(m.tp1Pct)} above the entry — {m.tp1R ? m.tp1R.toFixed(1) : "–"} ringgit made for every 1 risked. Usual practice is to sell
      half here and move the stop up to your entry, so the rest of the position can no longer cost you anything.
    </>,
  });

  if (m.tp2 !== null) rows.push({
    title: `TP2 · ${rr(m.tp2R)}`, value: m.tp2, cls: "up",
    body: <>
      {pct(m.tp2Pct)} above the entry, or {rr(m.tp2R)}. Where the rest comes off. If the move is still running strongly you can trail
      the stop under each higher low instead of selling the whole thing here.
    </>,
  });

  return (
    <details open={open}>
      <summary>Why these levels</summary>
      <div className="whylv">
        <p className="note" style={{ marginBottom: 2 }}>
          Levels are quoted in <b>R</b>. One R is the distance from the entry to the stop
          {m.risk !== null ? <> — {fx(m.risk, 3)} per share here</> : null} — so a 2R target simply means the reward is twice what you put at risk.
        </p>
        {rows.map(r => (
          <div className="row" key={r.title}>
            <div className="top">
              <span className="label">{r.title}</span>
              <span className={`v ${r.cls === "accent" ? "" : r.cls}`} style={r.cls === "accent" ? { color: "var(--accent)" } : undefined}>{fx(r.value, 3)}</span>
            </div>
            <p>{r.body}</p>
          </div>
        ))}
        {note && <p className="note"><b>This report adds:</b> {note}</p>}
      </div>
    </details>
  );
}
