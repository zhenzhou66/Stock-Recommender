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
