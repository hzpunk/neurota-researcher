import type { Bar, Level, Params, PatternHit, Point, Trend } from "./types";

export function rollingExtremes(bars: Bar[], order: number): Point[] {
  const pts: Point[] = [];
  const n = bars.length;
  const o = Math.max(2, order);
  for (let i = o; i < n - o; i++) {
    let top = true;
    let bot = true;
    for (let k = i - o; k <= i + o; k++) {
      if (k === i) continue;
      if (bars[k].high >= bars[i].high) top = false;
      if (bars[k].low <= bars[i].low) bot = false;
    }
    if (top) pts.push({ i, price: bars[i].high, kind: "top" });
    else if (bot) pts.push({ i, price: bars[i].low, kind: "bottom" });
  }
  return pts;
}

export function directionalChange(bars: Bar[], sigma: number): Point[] {
  if (bars.length < 3) return [];
  const tops: Point[] = [];
  const bots: Point[] = [];
  let up = true;
  let tmpMax = bars[0].high;
  let tmpMin = bars[0].low;
  let tmpMaxI = 0;
  let tmpMinI = 0;
  const s = Math.max(0.002, sigma);
  for (let i = 0; i < bars.length; i++) {
    if (up) {
      if (bars[i].high > tmpMax) {
        tmpMax = bars[i].high;
        tmpMaxI = i;
      } else if (bars[i].close < tmpMax * (1 - s)) {
        tops.push({ i: tmpMaxI, price: tmpMax, kind: "top" });
        up = false;
        tmpMin = bars[i].low;
        tmpMinI = i;
      }
    } else if (bars[i].low < tmpMin) {
      tmpMin = bars[i].low;
      tmpMinI = i;
    } else if (bars[i].close > tmpMin * (1 + s)) {
      bots.push({ i: tmpMinI, price: tmpMin, kind: "bottom" });
      up = true;
      tmpMax = bars[i].high;
      tmpMaxI = i;
    }
  }
  return [...tops, ...bots].sort((a, b) => a.i - b.i);
}

export function perceptuallyImportant(bars: Bar[], count: number): Point[] {
  const n = bars.length;
  const k = Math.min(Math.max(4, count), Math.floor(n / 4));
  const xs = [0, n - 1];
  const ys = [bars[0].close, bars[n - 1].close];
  while (xs.length < k) {
    let best = -1;
    let bestD = -1;
    let insertAt = 1;
    for (let s = 0; s < xs.length - 1; s++) {
      const x1 = xs[s];
      const x2 = xs[s + 1];
      const y1 = ys[s];
      const y2 = ys[s + 1];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      for (let i = x1 + 1; i < x2; i++) {
        const d = Math.abs((y2 - y1) * i - (x2 - x1) * bars[i].close + x2 * y1 - y2 * x1) / len;
        if (d > bestD) {
          bestD = d;
          best = i;
          insertAt = s + 1;
        }
      }
    }
    if (best < 0) break;
    xs.splice(insertAt, 0, best);
    ys.splice(insertAt, 0, bars[best].close);
  }
  const pts: Point[] = [];
  for (let i = 1; i < xs.length - 1; i++) {
    const prev = ys[i - 1];
    const next = ys[i + 1];
    const kind = ys[i] >= prev && ys[i] >= next ? "top" : "bottom";
    pts.push({ i: xs[i], price: ys[i], kind });
  }
  return pts;
}

export function marketLevels(bars: Bar[], lookback: number): Level[] {
  const slice = bars.slice(Math.max(0, bars.length - lookback));
  if (slice.length < 20) return [];
  const logs = slice.map((b) => Math.log(b.close));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length;
  const bw = Math.sqrt(variance) * 0.35 || 0.01;
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  const bins = 90;
  const step = (max - min) / bins || 0.001;
  const pdf: number[] = [];
  for (let i = 0; i <= bins; i++) {
    const x = min + i * step;
    let s = 0;
    for (const v of logs) {
      const z = (x - v) / bw;
      s += Math.exp(-0.5 * z * z);
    }
    pdf.push(s);
  }
  const peakMax = Math.max(...pdf);
  const levels: Level[] = [];
  for (let i = 2; i < pdf.length - 2; i++) {
    if (pdf[i] > pdf[i - 1] && pdf[i] >= pdf[i + 1] && pdf[i] > peakMax * 0.45) {
      const left = Math.min(pdf[i - 2], pdf[i - 1]);
      const right = Math.min(pdf[i + 1], pdf[i + 2]);
      const prom = pdf[i] - Math.max(left, right);
      if (prom > peakMax * 0.08) {
        levels.push({ price: Math.exp(min + i * step), weight: pdf[i] / peakMax });
      }
    }
  }
  return levels.slice(0, 6);
}

export function fitTrend(bars: Bar[], lookback: number): Trend | null {
  const from = Math.max(0, bars.length - lookback);
  const slice = bars.slice(from);
  if (slice.length < 20) return null;
  const n = slice.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const y = Math.log(slice[i].close);
    sx += i;
    sy += y;
    sxx += i * i;
    sxy += i * y;
  }
  const den = n * sxx - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / den;
  const intercept = (sy - slope * sx) / n;
  let supportShift = Infinity;
  let resistShift = -Infinity;
  for (let i = 0; i < n; i++) {
    const base = intercept + slope * i;
    supportShift = Math.min(supportShift, Math.log(slice[i].low) - base);
    resistShift = Math.max(resistShift, Math.log(slice[i].high) - base);
  }
  return {
    slope,
    support0: Math.exp(intercept + supportShift),
    resist0: Math.exp(intercept + resistShift),
    from,
    to: bars.length - 1,
  };
}

export function trendPrice(trend: Trend, index: number, side: "support" | "resist") {
  const x = index - trend.from;
  const base = side === "support" ? Math.log(trend.support0) : Math.log(trend.resist0);
  return Math.exp(base + trend.slope * x);
}

const HARMONICS = [
  { name: "Gartley", ab: [0.618, 0.618], bc: [0.382, 0.886], cd: [1.13, 1.618], ad: [0.786, 0.786] },
  { name: "Bat", ab: [0.382, 0.5], bc: [0.382, 0.886], cd: [1.618, 2.618], ad: [0.886, 0.886] },
  { name: "Butterfly", ab: [0.786, 0.786], bc: [0.382, 0.886], cd: [1.618, 2.24], ad: [1.27, 1.41] },
  { name: "Crab", ab: [0.382, 0.618], bc: [0.382, 0.886], cd: [2.24, 3.618], ad: [1.618, 1.618] },
];

export function findHarmonics(pts: Point[], err: number): PatternHit[] {
  const hits: PatternHit[] = [];
  const alt = alternating(pts);
  for (let i = 0; i + 4 < alt.length; i++) {
    const seq = alt.slice(i, i + 5);
    const [X, A, B, C, D] = seq;
    const xa = Math.abs(A.price - X.price);
    if (xa < 1e-9) continue;
    const ab = Math.abs(B.price - A.price) / xa;
    const abLen = Math.abs(B.price - A.price);
    const bc = abLen ? Math.abs(C.price - B.price) / abLen : 0;
    const bcLen = Math.abs(C.price - B.price);
    const cd = bcLen ? Math.abs(D.price - C.price) / bcLen : 0;
    const ad = Math.abs(D.price - A.price) / xa;
    for (const p of HARMONICS) {
      if (inRange(ab, p.ab, err) && inRange(bc, p.bc, err) && inRange(cd, p.cd, err) && inRange(ad, p.ad, err)) {
        const bull = D.kind === "bottom";
        hits.push({
          name: p.name,
          side: bull ? "bull" : "bear",
          points: seq,
          note: p.name + (bull ? " bull" : " bear") + " AD " + ad.toFixed(2),
        });
        break;
      }
    }
  }
  return hits.slice(-8);
}

export function findHeadShoulders(pts: Point[]): PatternHit[] {
  const hits: PatternHit[] = [];
  const alt = alternating(pts);
  for (let i = 0; i + 4 < alt.length; i++) {
    const seq = alt.slice(i, i + 5);
    const kinds = seq.map((p) => p.kind).join("");
    if (kinds === "topbottomtopbottomtop") {
      const [ls, la, head, ra, rs] = seq;
      if (head.price > ls.price && head.price > rs.price && Math.abs(ls.price - rs.price) / head.price < 0.08) {
        hits.push({ name: "Head & Shoulders", side: "bear", points: seq, note: "neck " + ((la.price + ra.price) / 2).toFixed(2) });
      }
    }
    if (kinds === "bottomtopbottomtopbottom") {
      const [ls, la, head, ra, rs] = seq;
      if (head.price < ls.price && head.price < rs.price && Math.abs(ls.price - rs.price) / head.price < 0.08) {
        hits.push({ name: "Inv. H&S", side: "bull", points: seq, note: "neck " + ((la.price + ra.price) / 2).toFixed(2) });
      }
    }
  }
  return hits.slice(-6);
}

export function findFlags(bars: Bar[], pts: Point[]): PatternHit[] {
  const hits: PatternHit[] = [];
  const alt = alternating(pts);
  for (let i = 1; i < alt.length - 2; i++) {
    const a = alt[i - 1];
    const b = alt[i];
    const pole = Math.abs(b.price - a.price) / a.price;
    const span = b.i - a.i;
    if (pole < 0.03 || span < 4 || span > 40) continue;
    const after = bars.slice(b.i, Math.min(bars.length, b.i + 12));
    if (after.length < 6) continue;
    const hi = Math.max(...after.map((x) => x.high));
    const lo = Math.min(...after.map((x) => x.low));
    const tight = (hi - lo) / b.price;
    if (tight < pole * 0.55) {
      const bull = b.price > a.price;
      hits.push({
        name: bull ? "Bull flag" : "Bear flag",
        side: bull ? "bull" : "bear",
        points: [a, b, { i: b.i + after.length - 1, price: bull ? hi : lo, kind: bull ? "top" : "bottom" }],
        note: "impulse " + (pole * 100).toFixed(1) + "% range " + (tight * 100).toFixed(1) + "%",
      });
    }
  }
  return hits.slice(-6);
}

export function levelReactions(bars: Bar[], levels: Level[]) {
  let touches = 0;
  let bounces = 0;
  for (const lv of levels) {
    for (let i = 2; i < bars.length - 3; i++) {
      const near = Math.min(Math.abs(bars[i].low - lv.price), Math.abs(bars[i].high - lv.price)) / lv.price < 0.004;
      if (!near) continue;
      touches++;
      const before = bars[i - 1].close;
      const after = bars[i + 2].close;
      if ((before < lv.price && after > bars[i].close) || (before > lv.price && after < bars[i].close)) bounces++;
    }
  }
  return { touches, bounces };
}

function alternating(pts: Point[]) {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(p);
      continue;
    }
    if (last.kind === p.kind) {
      if ((p.kind === "top" && p.price > last.price) || (p.kind === "bottom" && p.price < last.price)) out[out.length - 1] = p;
    } else out.push(p);
  }
  return out;
}

function inRange(v: number, range: number[], err: number) {
  return v >= range[0] * (1 - err) && v <= range[1] * (1 + err);
}

export function analyze(bars: Bar[], params: Params) {
  const rolling = rollingExtremes(bars, params.order);
  const directional = directionalChange(bars, params.sigma);
  const pip = perceptuallyImportant(bars, params.pips);
  const levels = marketLevels(bars, params.lookback);
  const trend = fitTrend(bars, params.lookback);
  const base = directional.length > 4 ? directional : rolling;
  return {
    rolling,
    directional,
    pip,
    levels,
    trend,
    harmonics: findHarmonics(base, params.err),
    hs: findHeadShoulders(base),
    flags: findFlags(bars, base),
    reactions: levelReactions(bars, levels),
  };
}
