"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  ColorType,
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

export default function PriceChart({
  bars,
  levels,
}: {
  bars: Bar[];
  levels: Level[];
}) {
  const ref = useRef<HTMLDivElement>(null);
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
      bars.map((b) => ({
        time: b.date,
        value: b.volume,
        color:
          b.close >= b.open ? "rgba(29,128,73,.35)" : "rgba(190,58,58,.35)",
      })),
    );
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
  return <div ref={ref} className="chartbox" style={{ height: 460 }} />;
}
