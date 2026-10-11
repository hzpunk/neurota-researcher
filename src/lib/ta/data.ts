import type { Bar } from "./types";

export function makeDemo(n = 420): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  let drift = 0.08;
  const start = Date.UTC(2025, 0, 2);
  for (let i = 0; i < n; i++) {
    if (i % 70 === 0) drift = (Math.sin(i / 18) > 0 ? 1 : -1) * (0.04 + (i % 5) * 0.02);
    const shock = Math.sin(i / 9) * 0.35 + Math.sin(i / 3.2) * 0.18;
    const open = price;
    const close = Math.max(1, open + drift + shock);
    const high = Math.max(open, close) + 0.15 + Math.abs(Math.sin(i * 1.7)) * 0.55;
    const low = Math.min(open, close) - 0.15 - Math.abs(Math.cos(i * 1.3)) * 0.45;
    const volume = 800 + Math.round(400 * Math.abs(Math.sin(i / 5)) + Math.abs(close - open) * 200);
    const d = new Date(start + i * 3600_000);
    bars.push({
      date: d.toISOString().slice(0, 16).replace("T", " "),
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume,
    });
    price = close;
  }
  return bars;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function parseCsv(text: string): Bar[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length < 3) throw new Error("Слишком мало строк в файле");
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/["']/g, ""));
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const iDate = idx(["date", "time", "datetime", "timestamp"]);
  const iOpen = idx(["open"]);
  const iHigh = idx(["high"]);
  const iLow = idx(["low"]);
  const iClose = idx(["close", "price"]);
  const iVol = idx(["volume", "vol"]);
  if (iClose < 0) throw new Error("Не найдена колонка close");
  const bars: Bar[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(sep).map((x) => x.trim().replace(/["']/g, ""));
    const close = num(c[iClose]);
    if (!Number.isFinite(close)) continue;
    const open = iOpen >= 0 ? num(c[iOpen]) : close;
    const high = iHigh >= 0 ? num(c[iHigh]) : Math.max(open, close);
    const low = iLow >= 0 ? num(c[iLow]) : Math.min(open, close);
    const volume = iVol >= 0 ? num(c[iVol]) : 0;
    const date = iDate >= 0 ? c[iDate] : String(bars.length);
    bars.push({ date, open, high, low, close, volume });
  }
  if (bars.length < 30) throw new Error("Нужно минимум 30 баров");
  return bars;
}

function num(s: string | undefined) {
  if (!s) return NaN;
  return Number(s.replace(/\s/g, "").replace(",", "."));
}
