"use client";
import { useEffect, useState } from "react";
import { Heart, Footprints, Moon, Flame, ArrowUpRight, Radio, Beaker, Settings2, Activity } from "lucide-react";

// Retained for the unused avatar component while the journal replaces its UI.
export interface HealthData { heartRate: number; steps: number; calories: number; sleep: string; activity: { minutes: number; intensity: number }; stress: number; }
type Reading = { bpm: number | null; steps: number | null; calories: number | null; sleep: string | null };
type Point = { at: number; bpm: number };
const DEMO: Reading = { bpm: 72, steps: 8432, calories: 1850, sleep: "7.2 hours" };
const SAMPLE = [72,74,71,79,76,83,80,76,81,79,75,78,71,75,78,73,74,72];
const numeric = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const format = (v: number | null) => v === null ? "--" : v.toLocaleString();

export function HealthDashboard() {
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState<Reading>({ bpm: null, steps: null, calories: null, sleep: null });
  const [points, setPoints] = useState<Point[]>([]);
  const [status, setStatus] = useState("Connecting to your data...");
  const [updated, setUpdated] = useState<number | null>(null);
  const [range, setRange] = useState("Today");
  const [tab, setTab] = useState("Trends");
  const [eda, setEda] = useState("");
  const [modelResult, setModelResult] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    let active = true;
    const controller = new AbortController();
    const read = async () => {
      try {
        const res = await fetch("/api/health-data", { signal: controller.signal, cache: "no-store" });
        const value = await res.json();
        if (!res.ok) throw new Error(value.error || "Data service unavailable");
        if (!active) return;
        const next = { bpm: numeric(value.bpm), steps: numeric(value.steps), calories: numeric(value.calories), sleep: typeof value.sleep === "string" && value.sleep.trim() ? value.sleep : null };
        setData(next); setUpdated(Date.now()); setStatus("Data service connected. Sample age is not supplied by the current backend.");
        if (next.bpm !== null) setPoints(previous => [...previous.slice(-119), { at: Date.now(), bpm: next.bpm! }]);
      } catch (error) {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "Data service unavailable");
        setUpdated(null); setData({ bpm: null, steps: null, calories: null, sleep: null });
      }
    };
    read(); const interval = setInterval(read, 30000);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, [demo]);

  const shown = demo ? DEMO : data;
  const chartValues = demo && range === "Today" ? SAMPLE : !demo && range === "Today" ? points.map(p => p.bpm) : [];
  const low = chartValues.length ? Math.floor((Math.min(...chartValues) - 5) / 5) * 5 : 50;
  const high = chartValues.length ? Math.ceil((Math.max(...chartValues) + 5) / 5) * 5 : 100;
  const path = chartValues.map((v, i) => `${i ? "L" : "M"}${i * 282 / Math.max(chartValues.length - 1, 1)} ${115 - (v-low)/(high-low)*95}`).join(" ");
  const labelTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const evaluate = async () => {
    setBusy(true); setModelResult("");
    try {
      const parsed = JSON.parse(eda);
      if (!Array.isArray(parsed) || parsed.length < 10 || parsed.length > 20000 || parsed.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)) throw new Error("Enter a JSON array of 10-20000 valid EDA readings, in microsiemens.");
      const res = await fetch("/api/run-model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "eda_window", eda_readings: parsed }) });
      const value = await res.json();
      if (!res.ok || !value.success) throw new Error(value.error || "Model unavailable");
      setModelResult(`${value.result.stress_state} experimental phase estimate. Not a diagnosis or reliable personal prediction.`);
    } catch (error) { setModelResult(error instanceof Error ? error.message : "Could not run model"); }
    finally { setBusy(false); }
  };

  return <div className="journal">
    <header className="journal-header"><span className="brand"><Activity size={17} aria-hidden="true" /> Human digital twin</span><button className="mode-toggle" onClick={() => setDemo(!demo)} aria-pressed={demo}>{demo ? "Demo mode · switch to live" : "Live mode · view demo"}</button></header>
    <div className="intro"><p className="eyebrow">Your signal journal</p><h1>A day in signals</h1><p>Wearable data, with room to see the whole picture.</p></div>
    <div className={`connection ${demo ? "demo" : ""}`} role="status"><Radio size={15} aria-hidden="true" /><span>{demo ? "Illustrative demo data. These are not your live readings." : status}</span></div>
    <nav className="journal-tabs" aria-label="Dashboard sections">{["Trends","Model","Settings"].map(name=><button key={name} onClick={()=>setTab(name)} aria-current={tab===name ? "page" : undefined}>{name}</button>)}</nav>
    {tab === "Trends" && <>
      <div className="periods" role="group" aria-label="Trend period">{["Today","7 days","30 days"].map(name=><button key={name} onClick={()=>setRange(name)} aria-pressed={range===name}>{name}</button>)}</div>
      <div className="dashboard-grid">
        <section className="heart-panel panel"><div className="panel-top"><div><div className="metric-label"><Heart size={16} /> Heart rate</div><div className="heart-value">{format(shown.bpm)}<span>bpm</span></div></div><span className="badge">{demo ? "Sample trend" : updated ? "Latest fetch" : "No data"}</span></div>
          {chartValues.length >= 2 ? <><svg className="trend-chart" viewBox="0 0 336 154" role="img" aria-label={`${demo ? "Illustrative" : "This-session fetched"} heart rate trend, ${low} to ${high} BPM`}>
          {[0,.5,1].map(f=><g key={f}><line x1="0" x2="286" y1={115-f*95} y2={115-f*95} stroke="#eae9ea" /><text x="296" y={119-f*95}>{Math.round(low+(high-low)*f)}</text></g>)}
          <path d={path} fill="none" stroke="#73a89a" strokeWidth="3" strokeLinejoin="round" /><text x="0" y="149">{demo ? "09:00" : labelTime(points[0].at)}</text><text x="248" y="149">{demo ? "15:00" : labelTime(points[points.length-1].at)}</text></svg>
          <div className="chart-caption"><span>{demo ? "Sample day, 09:00-15:00" : "Fetched during this session"}</span><span>{demo ? "Illustrative" : "bpm"}</span></div></> : <div className="empty-chart"><Activity size={25} /><strong>{range !== "Today" ? "History isn't available yet" : "Waiting for a trend"}</strong><p>{range !== "Today" ? "The current backend only returns the latest metrics. No week or month history is fabricated." : "Two readings are needed to draw a chart. Connect your data service or switch to the clearly labeled demo."}</p></div>}
        </section>
        <div className="side-metrics"><Metric icon={<Footprints size={17}/>} title="Movement" value={format(shown.steps)} unit="steps" detail={demo ? "Illustrative daily total" : "Latest reported total"} /><Metric icon={<Moon size={17}/>} title="Sleep" value={shown.sleep || "--"} unit="" detail={demo ? "Illustrative duration" : "Latest reported duration"} /></div>
        <section className="energy-panel panel"><div className="panel-top"><h2>Metric details</h2><Flame size={18}/></div><div className="metric-detail"><span>Energy</span><strong>{format(shown.calories)} kcal</strong></div><p className="small muted">{demo ? "Demo values. Switch to live mode for your data service." : "Missing metrics stay blank. No synthetic fallback values."}</p></section>
        <section className="research-panel"><div className="research-title"><Beaker size={17}/><h2>Stress model: research only</h2></div><p>EDA window validation: <strong>56.7%</strong> on 60 participants. The uncertainty interval is 49.2%-64.2%, including chance.</p><p>Requires skin-conductance (EDA) hardware. Your current watch sender does not provide this signal. Not a health diagnosis.</p><button className="text-button" onClick={()=>setTab("Model")}>Explore the model <ArrowUpRight size={14}/></button></section>
      </div>
    </>}
    {tab === "Model" && <section className="panel model-panel"><p className="eyebrow">Experimental model lab</p><h2>Real signals. Honest limits.</h2><p>This model estimates controlled relax/stress phases using EDA windows, not mental-health status. ECG-derived HRV was tested but did not improve performance.</p><dl className="model-facts"><div><dt>Full usable cohort</dt><dd>60 people · 120 records</dd></div><div><dt>Balanced accuracy</dt><dd>56.7%</dd></div><div><dt>95% bootstrap interval</dt><dd>49.2%-64.2%</dd></div><div><dt>Validation</dt><dd>Nested participant-disjoint folds</dd></div></dl><p className="small muted">The interval includes chance and is conditional on this evaluation. Controlled lab data are not daily-life validation.</p><div className="notice"><strong>EDA hardware required</strong><p>The current Wear OS sender has BPM, steps, calories and sleep only. Those cannot replace skin-conductance measurements or beat-to-beat RR intervals.</p></div><label htmlFor="eda-window">Import a research EDA window</label><p className="small muted">Paste a JSON array of valid readings in microsiemens from one comparable resting window, about 2 minutes. Not demo BPM values.</p><textarea id="eda-window" value={eda} onChange={e=>setEda(e.target.value)} placeholder="[ ...valid EDA readings... ]" rows={4}/><button className="primary-button" onClick={evaluate} disabled={busy || !eda.trim()}>{busy ? "Running..." : "Run research model"}</button>{modelResult && <p className="notice" role="status">{modelResult}</p>}<a className="source-link" href="https://physionet.org/content/qol-stress/1.0.0/" target="_blank" rel="noreferrer">QoL_Stress dataset · CC BY 4.0 <ArrowUpRight size={14}/></a></section>}
    {tab === "Settings" && <section className="panel model-panel"><Settings2 size={23}/><h2>Connection settings</h2><p>Set <code>GET_HEALTH_URL</code> on the server to your own Appwrite endpoint ending in <code>/get-health-data</code>. No secrets belong in this dashboard.</p><p>The app checks the data service every 30 seconds. The current backend does not provide sample timestamps, durable history or per-user storage. Live watch and Appwrite integration remain unverified.</p><p>Model setup: install Python dependencies and train the trusted local artifact with <code>python ml/stress_model.py train</code>. EDA collection needs separate supported hardware and a sender/storage upgrade.</p><button className="primary-button" onClick={()=>{setDemo(!demo);setTab("Trends");}}>{demo ? "Return to live mode" : "Explore labeled demo"}</button></section>}
    <footer className="journal-footer"><span>Human digital twin</span><span>{demo ? "Demo · not personal readings" : updated ? `Fetched at ${labelTime(updated)}` : "Awaiting connection"}</span></footer>
  </div>;
}
function Metric({icon,title,value,unit,detail}:{icon:React.ReactNode;title:string;value:string;unit:string;detail:string}) { return <section className="panel metric-panel"><div className="metric-label">{icon}{title}</div><div className="metric-value">{value} {unit && <span>{unit}</span>}</div><p className="small muted">{detail}</p></section>; }
