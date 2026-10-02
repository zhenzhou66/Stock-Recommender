"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  createTextWatermark,
  BaselineSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  ColorType,
  type AutoscaleInfo,
  type IChartApi,
} from "lightweight-charts";
import type { Bar } from "@/lib/data";

type Level = { price: number; title: string; color: string };

function sma(bars: Bar[], n: number) {
  const out: { time: string; value: number }[] = [];
  let sum = 0;
  bars.forEach((b, i) => {
    sum += b.close;
    if (i >= n) sum -= bars[i - n].close;
    if (i >= n - 1) out.push({ time: b.date, value: +(sum / n).toFixed(4) });
  });
  return out;
}

// Chaikin Money Flow: volume-weighted average of where each day closed in its
// range over the last n days (+1 = every close at the high, -1 = at the low)
function cmf(bars: Bar[], n: number) {
  const flow = bars.map((b) =>
    b.high > b.low
      ? ((2 * b.close - b.high - b.low) / (b.high - b.low)) * b.volume
      : 0,
  );
  const out: { time: string; value: number }[] = [];
  let mf = 0;
  let vol = 0;
  bars.forEach((b, i) => {
    mf += flow[i];
    vol += b.volume;
    if (i >= n) {
      mf -= flow[i - n];
      vol -= bars[i - n].volume;
    }
    if (i >= n - 1 && vol > 0)
      out.push({ time: b.date, value: +(mf / vol).toFixed(3) });
  });
  return out;
}

export default function PriceChart({
  bars,
  levels,
}: {
  bars: Bar[];
  levels: Level[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!ref.current || !bars.length) return;
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim();
    const chart: IChartApi = createChart(ref.current, {
      autoSize: true,
      localization: { locale: "en-MY" },
      layout: {
        background: { type: ColorType.Solid, color: v("--surface") },
        textColor: v("--muted"),
        fontFamily: "IBM Plex Mono, monospace",
        panes: { separatorColor: v("--line") },
      },
      grid: {
        vertLines: { color: v("--surface-2") },
        horzLines: { color: v("--surface-2") },
      },
      rightPriceScale: { borderColor: v("--line") },
      timeScale: { borderColor: v("--line") },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: v("--up"),
      downColor: v("--down"),
      borderVisible: false,
      wickUpColor: v("--up"),
      wickDownColor: v("--down"),
    });
    candles.setData(
      bars.map((b) => ({
        time: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    chart
      .addSeries(LineSeries, {
        color: "#f5a524",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "MA9",
      })
      .setData(sma(bars, 9));
    chart
      .addSeries(LineSeries, {
        color: "#6e8efb",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "MA90",
      })
      .setData(sma(bars, 90));
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(140,150,170,.4)",
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(
      bars.map((b, i) => {
        // Yellow when volume is at least double the previous day's
        const prev = i > 0 ? bars[i - 1].volume : 0;
        const doubled = prev > 0 && b.volume >= 2 * prev;
        return {
          time: b.date,
          value: b.volume,
          color: doubled
            ? "rgba(245,197,24,.9)"
            : b.close >= b.open ? "rgba(29,128,73,.35)" : "rgba(190,58,58,.35)",
        };
      }),
    );
    // Money flow in its own pane under the price chart
    const flow = chart.addSeries(
      BaselineSeries,
      {
        baseValue: { type: "price", price: 0 },
        topLineColor: v("--up"),
        topFillColor1: "rgba(29,128,73,.35)",
        topFillColor2: "rgba(29,128,73,.05)",
        bottomLineColor: v("--down"),
        bottomFillColor1: "rgba(190,58,58,.05)",
        bottomFillColor2: "rgba(190,58,58,.35)",
        lineWidth: 1,
        priceLineVisible: false,
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        // Always keep the zero line in view
        autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
          const r = original();
          if (r?.priceRange) {
            r.priceRange.minValue = Math.min(r.priceRange.minValue, 0);
            r.priceRange.maxValue = Math.max(r.priceRange.maxValue, 0);
          }
          return r;
        },
      },
      1,
    );
    flow.setData(cmf(bars, 20));
    flow.createPriceLine({
      price: 0,
      color: v("--line"),
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
    });
    // Label in the pane's top-left corner, clear of the latest readings
    createTextWatermark(chart.panes()[1], {
      horzAlign: "left",
      vertAlign: "top",
      lines: [
        {
          text: "Money flow (20d)",
          color: v("--muted"),
          fontSize: 11,
          lineHeight: 20,
          fontFamily: "IBM Plex Mono, monospace",
        },
      ],
    });
    // Price pane gets 4/5 of the height, money flow 1/5
    chart.panes()[0].setStretchFactor(4);
    chart.panes()[1].setStretchFactor(1);
    levels
      .filter((l) => l.price > 0)
      .forEach((l) =>
        candles.createPriceLine({
          price: l.price,
          color: l.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: l.title,
        }),
      );
    chart
      .timeScale()
      .setVisibleLogicalRange({
        from: Math.max(0, bars.length - 180),
        to: bars.length + 5,
      });
    return () => chart.remove();
  }, [bars, levels]);
  // While enlarged: Esc or leaving full screen shrinks it, and the page behind
  // stops scrolling
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.body.style.overflow = "";
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [expanded]);
  const toggle = () => {
    // Take the whole screen where the browser allows it (iPhone doesn't); the
    // expanded class fills the window either way
    if (!expanded) wrap.current?.requestFullscreen?.().catch(() => {});
    setExpanded(!expanded);
  };
  if (!bars.length)
    return (
      <div
        className="chartbox"
        style={{ display: "grid", placeItems: "center" }}
      >
        <p className="muted">
          No price history saved for this stock yet. It will appear after the
          next run.
        </p>
      </div>
    );
  return (
    <div ref={wrap} className={expanded ? "chartwrap expanded" : "chartwrap"}>
      <div className="chartframe">
        <div ref={ref} className="chartbox" />
        <button
          type="button"
          className="chartexpand"
          onClick={toggle}
          aria-label={expanded ? "Shrink chart" : "Enlarge chart"}
          title={expanded ? "Shrink chart (Esc)" : "Enlarge chart"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              d={
                expanded
                  ? "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"
                  : "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
              }
            />
          </svg>
        </button>
      </div>
      <p className="note">
        Bottom panel: money flow over 20 trading days (Chaikin). Green above
        zero means volume has been heavier on days that closed near their high
        (buying pressure); red below zero means heavier on days that closed
        near their low (selling pressure).
      </p>
    </div>
  );
}
