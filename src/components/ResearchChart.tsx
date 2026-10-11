import { useEffect, useRef } from "react";
import type { Bar, Layers, Level, PatternHit, Point, Trend } from "@/lib/ta/types";
import { trendPrice } from "@/lib/ta/engine";

type Props = {
  bars: Bar[];
  from: number;
  layers: Layers;
  rolling: Point[];
  directional: Point[];
  pip: Point[];
  levels: Level[];
  trend: Trend | null;
  patterns: PatternHit[];
};

export function ResearchChart(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, w, h, props);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [props]);
  return <canvas ref={ref} className="block h-full w-full" />;
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, p: Props) {
  const { bars, from, layers, rolling, directional, pip, levels, trend, patterns } = p;
  const padL = 8, padR = 64, padT = 12, padB = 28;
  const view = bars.slice(from);
  ctx.fillStyle = "#0c0e12";
  ctx.fillRect(0, 0, w, h);
  if (view.length < 2) return;
  let min = Infinity, max = -Infinity;
  for (const b of view) { min = Math.min(min, b.low); max = Math.max(max, b.high); }
  const span = max - min || 1;
  min -= span * 0.06; max += span * 0.06;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const xAt = (i: number) => padL + ((i - from) / (view.length - 1)) * plotW;
  const yAt = (price: number) => padT + ((max - price) / (max - min)) * plotH;
  ctx.strokeStyle = "#1b2130";
  ctx.font = "11px IBM Plex Mono, monospace";
  ctx.fillStyle = "#8b93a7";
  for (let g = 0; g <= 4; g++) {
    const price = min + ((max - min) * g) / 4;
    const y = yAt(price);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(price.toFixed(2), w - padR + 6, y + 4);
  }
  if (layers.levels) {
    for (const lv of levels) {
      const y = yAt(lv.price);
      ctx.strokeStyle = "rgba(212,160,84," + (0.35 + lv.weight * 0.5) + ")";
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#d4a054";
      ctx.fillText(lv.price.toFixed(2), padL + 4, y - 4);
    }
  }
  if (layers.trend && trend) {
    drawTrend(ctx, trend, from, view.length, xAt, yAt, "support", "#3d9a78");
    drawTrend(ctx, trend, from, view.length, xAt, yAt, "resist", "#d45d5d");
  }
  const cw = Math.max(2, (plotW / view.length) * 0.62);
  view.forEach((b, idx) => {
    const i = from + idx;
    const x = xAt(i);
    const up = b.close >= b.open;
    ctx.strokeStyle = up ? "#3d9a78" : "#d45d5d";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.moveTo(x, yAt(b.high)); ctx.lineTo(x, yAt(b.low)); ctx.stroke();
    const y1 = yAt(Math.max(b.open, b.close));
    const y2 = yAt(Math.min(b.open, b.close));
    ctx.fillRect(x - cw / 2, y1, cw, Math.max(1, y2 - y1));
  });
  if (layers.rolling) dots(ctx, rolling, from, bars.length, xAt, yAt, "#6ea8d6");
  if (layers.directional) dots(ctx, directional, from, bars.length, xAt, yAt, "#e8eaef");
  if (layers.pip) dots(ctx, pip, from, bars.length, xAt, yAt, "#c084fc");
  for (const pat of patterns) {
    ctx.strokeStyle = pat.side === "bull" ? "#3d9a78" : "#d45d5d";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let started = false;
    for (const pt of pat.points) {
      if (pt.i < from || pt.i >= bars.length) continue;
      const x = xAt(pt.i), y = yAt(pt.price);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = "#8b93a7";
  ctx.fillText(view[0]?.date ?? "", padL, h - 8);
  ctx.fillText(view[view.length - 1]?.date ?? "", w - padR - 110, h - 8);
}

function drawTrend(ctx: CanvasRenderingContext2D, trend: Trend, from: number, len: number, xAt: (i: number) => number, yAt: (p: number) => number, side: "support" | "resist", color: string) {
  const a = Math.max(from, trend.from);
  const b = Math.min(from + len - 1, trend.to);
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(xAt(a), yAt(trendPrice(trend, a, side)));
  ctx.lineTo(xAt(b), yAt(trendPrice(trend, b, side)));
  ctx.stroke();
}

function dots(ctx: CanvasRenderingContext2D, pts: Point[], from: number, n: number, xAt: (i: number) => number, yAt: (p: number) => number, color: string) {
  ctx.fillStyle = color;
  for (const p of pts) {
    if (p.i < from || p.i >= n) continue;
    ctx.beginPath();
    ctx.arc(xAt(p.i), yAt(p.price), 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
