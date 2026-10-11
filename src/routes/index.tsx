import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ResearchChart } from "@/components/ResearchChart";
import { makeDemo, parseCsv } from "@/lib/ta/data";
import { analyze } from "@/lib/ta/engine";
import { defaultLayers, defaultParams, type Layers, type Params } from "@/lib/ta/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [name, setName] = useState("SYNTH-H1");
  const [bars, setBars] = useState(() => makeDemo());
  const [error, setError] = useState("");
  const [layers, setLayers] = useState<Layers>(defaultLayers);
  const [params, setParams] = useState<Params>(defaultParams);
  const [windowSize, setWindowSize] = useState(180);
  const [offset, setOffset] = useState(0);
  const result = useMemo(() => analyze(bars, params), [bars, params]);
  const maxOff = Math.max(0, bars.length - windowSize);
  const from = Math.max(0, bars.length - windowSize - offset);
  const last = bars[bars.length - 1];
  const patterns = [
    ...(layers.harmonics ? result.harmonics : []),
    ...(layers.hs ? result.hs : []),
    ...(layers.flags ? result.flags : []),
  ];
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = parseCsv(await file.text());
      setBars(next);
      setName(file.name.replace(/\.csv$/i, ""));
      setOffset(0);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV error");
    }
  };
  return (
    <main className="flex h-full min-h-screen flex-col bg-bg text-fg md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-line bg-surface p-4 md:h-screen md:w-80 md:overflow-y-auto md:border-r md:border-b-0">
        <div>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">NeuroTA</p>
          <h1 className="mt-1 text-xl font-semibold">Researcher</h1>
          <p className="mt-1 text-sm text-muted">Market structure layers on one chart. Demo series is already loaded.</p>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">CSV: date, open, high, low, close, volume</span>
          <input type="file" accept=".csv,text/csv" className="block w-full text-sm" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg" onClick={() => { setBars(makeDemo()); setName("SYNTH-H1"); setError(""); setOffset(0); }}>Reset demo</button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <section className="grid gap-1">
          <Toggle label="Directional Change" on={layers.directional} set={(v) => setLayers({ ...layers, directional: v })} />
          <Toggle label="Rolling Window" on={layers.rolling} set={(v) => setLayers({ ...layers, rolling: v })} />
          <Toggle label="PIP" on={layers.pip} set={(v) => setLayers({ ...layers, pip: v })} />
          <Toggle label="Market Profile levels" on={layers.levels} set={(v) => setLayers({ ...layers, levels: v })} />
          <Toggle label="Trend channel" on={layers.trend} set={(v) => setLayers({ ...layers, trend: v })} />
          <Toggle label="Harmonics" on={layers.harmonics} set={(v) => setLayers({ ...layers, harmonics: v })} />
          <Toggle label="Head and Shoulders" on={layers.hs} set={(v) => setLayers({ ...layers, hs: v })} />
          <Toggle label="Flags" on={layers.flags} set={(v) => setLayers({ ...layers, flags: v })} />
        </section>
        <section className="grid gap-3 text-sm">
          <Slider label="Sigma DC" min={0.005} max={0.06} step={0.001} value={params.sigma} fmt={(v) => (v * 100).toFixed(1) + "%"} onChange={(sigma) => setParams({ ...params, sigma })} />
          <Slider label="Extreme window" min={3} max={20} step={1} value={params.order} fmt={String} onChange={(order) => setParams({ ...params, order })} />
          <Slider label="Level lookback" min={40} max={400} step={10} value={params.lookback} fmt={String} onChange={(lookback) => setParams({ ...params, lookback })} />
          <Slider label="Harmonic tolerance" min={0.05} max={0.25} step={0.01} value={params.err} fmt={(v) => v.toFixed(2)} onChange={(err) => setParams({ ...params, err })} />
          <Slider label="Visible bars" min={60} max={Math.min(500, bars.length)} step={10} value={windowSize} fmt={String} onChange={(v) => { setWindowSize(v); setOffset(0); }} />
          <Slider label="Shift back" min={0} max={maxOff} step={1} value={Math.min(offset, maxOff)} fmt={String} onChange={setOffset} />
        </section>
      </aside>
      <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="font-mono text-xs text-muted">{name}</p>
            <p className="font-mono text-2xl">{last ? last.close.toFixed(2) : "-"}</p>
          </div>
          <p className="font-mono text-xs text-muted">bars {bars.length} · DC {result.directional.length} · levels {result.levels.length} · reactions {result.reactions.bounces}/{result.reactions.touches}</p>
        </header>
        <div className="min-h-[420px] flex-1">
          <ResearchChart bars={bars} from={from} layers={layers} rolling={result.rolling} directional={result.directional} pip={result.pip} levels={result.levels} trend={result.trend} patterns={patterns} />
        </div>
        <div className="grid gap-2 border-t border-line p-4 sm:grid-cols-3">
          <List title="Harmonics" items={result.harmonics.map((x) => x.note)} />
          <List title="Head and Shoulders" items={result.hs.map((x) => x.name + " " + x.note)} />
          <List title="Flags" items={result.flags.map((x) => x.name + ": " + x.note)} />
        </div>
      </section>
    </main>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => set(!on)} className={"flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm " + (on ? "border-accent bg-surface-2 text-fg" : "border-line text-muted")}>
      <span>{label}</span><span className="font-mono text-xs">{on ? "ON" : "OFF"}</span>
    </button>
  );
}

function Slider({ label, min, max, step, value, fmt, onChange }: { label: string; min: number; max: number; step: number; value: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-muted"><span>{label}</span><span className="font-mono text-fg">{fmt(value)}</span></span>
      <input className="w-full accent-accent" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {items.length === 0 ? <p className="text-sm text-muted">none</p> : <ul className="space-y-1 text-sm text-muted">{items.slice(-4).map((item) => <li key={item}>{item}</li>)}</ul>}
    </div>
  );
}
