export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Point = { i: number; price: number; kind: "top" | "bottom" };

export type Level = { price: number; weight: number };

export type Trend = {
  slope: number;
  support0: number;
  resist0: number;
  from: number;
  to: number;
};

export type PatternHit = {
  name: string;
  side: "bull" | "bear";
  points: Point[];
  note: string;
};

export type Layers = {
  rolling: boolean;
  directional: boolean;
  pip: boolean;
  levels: boolean;
  trend: boolean;
  harmonics: boolean;
  hs: boolean;
  flags: boolean;
};

export type Params = {
  order: number;
  sigma: number;
  pips: number;
  lookback: number;
  err: number;
};

export const defaultLayers: Layers = {
  rolling: false,
  directional: true,
  pip: false,
  levels: true,
  trend: true,
  harmonics: false,
  hs: false,
  flags: false,
};

export const defaultParams: Params = {
  order: 6,
  sigma: 0.015,
  pips: 8,
  lookback: 120,
  err: 0.12,
};
