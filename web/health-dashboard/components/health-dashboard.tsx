"use client";
import { useEffect, useState } from "react";
import { ID } from "appwrite";
import { appwriteAccount } from "@/lib/appwrite";
import { Heart, Footprints, Moon, Flame, ArrowUpRight, Radio, Beaker, Settings2, Activity } from "lucide-react";

// Retained for the unused avatar component while the journal replaces its UI.
export interface HealthData { heartRate: number; steps: number; calories: number; sleep: string; activity: { minutes: number; intensity: number }; stress: number; }
type Reading = { bpm: number | null; steps: number | null; calories: number | null; sleep: string | null };
type Point = { at: number; bpm: number };
type Analytics = { buckets: { at: string; metrics: Record<string,{mean:number;min:number;max:number;count:number}> }[]; records:number; bucket:string; trend:Record<string,{delta:number}|null> };
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
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [signup,setSignup] = useState(false);
  const [session, setSession] = useState(false); const [accountStatus,setAccountStatus] = useState("");
  const [analytics,setAnalytics] = useState<Analytics|null>(null);
  const [historyStatus,setHistoryStatus] = useState("Sign in to view stored history.");
  useEffect(()=>{try { appwriteAccount().get().then(()=>setSession(true)).catch(()=>{}); } catch {}},[]);
  const login = async () => { setBusy(true);setAccountStatus(""); try {
    if(signup) await appwriteAccount().create({userId:ID.unique(),email,password});
    await appwriteAccount().createEmailPasswordSession({email,password});setPassword("");setSession(true);setTab("Trends");
  }catch(e){setAccountStatus(e instanceof Error?e.message:"Sign-in failed");}finally{setBusy(false);} };
  const logout = async()=>{await appwriteAccount().deleteSession({sessionId:"current"});setSession(false);setPoints([]);setAnalytics(null);setData({bpm:null,steps:null,calories:null,sleep:null});setUpdated(null);};

  useEffect(() => {
    if (demo || !session) { setStatus("Sign in under Settings to view your private stored readings."); return; }
    let active = true;
    const controller = new AbortController();
    const read = async () => {
      try {
        const jwt = (await appwriteAccount().createJWT()).jwt;
        const res = await fetch("/api/health-data", { signal: controller.signal, cache: "no-store",headers:{Authorization:`Bearer ${jwt}`} });
        const value = await res.json();
        if (!res.ok) throw new Error(value.error || "Data service unavailable");
        if (!active) return;
        const next = { bpm: numeric(value.bpm), steps: numeric(value.steps), calories: numeric(value.calories), sleep: typeof value.sleep === "string" && value.sleep.trim() ? value.sleep : null };
        setData(next); setUpdated(value.samples?.bpm?.observedAt ? Date.parse(value.samples.bpm.observedAt) : null);
        setStatus("Private Appwrite readings connected. Observation time shown below.");
        const history = await fetch(`/api/analytics?days=${range === "Today" ? 1 : range === "7 days" ? 7 : 30}`, {signal:controller.signal,cache:"no-store",headers:{Authorization:`Bearer ${jwt}`}});
        const stored = await history.json();if(!active)return;
        if(!history.ok){setAnalytics(null);setPoints([]);setHistoryStatus(stored.error || "Stored history unavailable");}
        else { setAnalytics(stored);setPoints(stored.buckets.filter((b:Analytics["buckets"][number])=>b.metrics.bpm).map((b:Analytics["buckets"][number])=>({at:Date.parse(b.at),bpm:b.metrics.bpm.mean})));setHistoryStatus(`${stored.records} stored observations · ${stored.bucket} averages · UTC`); }
      } catch (error) {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "Data service unavailable");
        setAnalytics(null);setPoints([]);setHistoryStatus("Stored history unavailable");
        setUpdated(null); setData({ bpm: null, steps: null, calories: null, sleep: null });
      }
    };
    read(); const interval = setInterval(read, 30000);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, [demo,session,range]);

  const shown = demo ? DEMO : data;
  const chartValues = demo ? (range === "Today" ? SAMPLE : range === "7 days" ? [72,75,71,77,74,76,73] : [72,73,71,77,75,74,76,73,72,75]) : points.map(p => p.bpm);
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
        <section className="heart-panel panel"><div className="panel-top"><div><div className="metric-label"><Heart size={16} /> Heart rate</div><div className="heart-value">{format(shown.bpm)}<span>bpm</span></div></div><span className="badge">{demo ? "Sample trend" : updated ? "Timestamped sample" : "No data"}</span></div>
          {chartValues.length >= 2 ? <><svg className="trend-chart" viewBox="0 0 336 154" role="img" aria-label={`${demo ? "Illustrative" : "Stored average"} heart rate trend, ${low} to ${high} BPM`}>
          {[0,.5,1].map(f=><g key={f}><line x1="0" x2="286" y1={115-f*95} y2={115-f*95} stroke="#eae9ea" /><text x="296" y={119-f*95}>{Math.round(low+(high-low)*f)}</text></g>)}
          <path d={path} fill="none" stroke="#73a89a" strokeWidth="3" strokeLinejoin="round" /><text x="0" y="149">{demo ? (range === "Today" ? "09:00" : "Day 1") : new Date(points[0].at).toLocaleDateString([], {month:"short",day:"numeric"})}</text><text x="248" y="149">{demo ? (range === "Today" ? "15:00" : range === "7 days" ? "Day 7" : "Day 30") : new Date(points[points.length-1].at).toLocaleDateString([], {month:"short",day:"numeric"})}</text></svg>
          <div className="chart-caption"><span>{demo ? `Illustrative ${range.toLowerCase()} averages` : historyStatus}</span><span>{demo ? "Illustrative" : "bpm"}</span></div></> : <div className="empty-chart"><Activity size={25} /><strong>{"No stored trend yet"}</strong><p>{`${historyStatus}. Missing periods are not fabricated.`}</p></div>}
        </section>
        <div className="side-metrics"><Metric icon={<Footprints size={17}/>} title="Movement" value={format(shown.steps)} unit="steps" detail={demo ? "Illustrative daily total" : "Latest reported total"} /><Metric icon={<Moon size={17}/>} title="Sleep" value={shown.sleep || "--"} unit="" detail={demo ? "Illustrative duration" : "Latest reported duration"} /></div>
        <section className="energy-panel panel"><h2>Stored-history summary</h2><div className="metric-detail"><span>{range} average BPM</span><strong>{demo ? "Illustrative" : points.length ? (analytics!.buckets.reduce((n,b)=>n+(b.metrics.bpm?.mean || 0)*(b.metrics.bpm?.count || 0),0)/analytics!.buckets.reduce((n,b)=>n+(b.metrics.bpm?.count||0),0)).toFixed(1) : "--"}</strong></div><div className="metric-detail"><span>First → last bucket</span><strong>{demo ? "Sample only" : analytics?.trend.bpm ? `${analytics.trend.bpm.delta.toFixed(1)} bpm` : "--"}</strong></div><p className="small muted">Sample-weighted averages, not health assessments. Steps/calories remain cumulative snapshots, not added totals.</p><div className="panel-top"><h2>Metric details</h2><Flame size={18}/></div><div className="metric-detail"><span>Energy</span><strong>{format(shown.calories)} kcal</strong></div><p className="small muted">{demo ? "Demo values. Switch to live mode for your data service." : "Missing metrics stay blank. No synthetic fallback values."}</p></section>
        <section className="research-panel"><div className="research-title"><Beaker size={17}/><h2>Stress model: research only</h2></div><p>EDA window validation: <strong>56.7%</strong> on 60 participants. The uncertainty interval is 49.2%-64.2%, including chance.</p><p>Requires skin-conductance (EDA) hardware. Your current watch sender does not provide this signal. Not a health diagnosis.</p><button className="text-button" onClick={()=>setTab("Model")}>Explore the model <ArrowUpRight size={14}/></button></section>
      </div>
    </>}
    {tab === "Model" && <section className="panel model-panel"><p className="eyebrow">Experimental model lab</p><h2>Real signals. Honest limits.</h2><p>This model estimates controlled relax/stress phases using EDA windows, not mental-health status. ECG-derived HRV was tested but did not improve performance.</p><dl className="model-facts"><div><dt>Full usable cohort</dt><dd>60 people · 120 records</dd></div><div><dt>Balanced accuracy</dt><dd>56.7%</dd></div><div><dt>95% bootstrap interval</dt><dd>49.2%-64.2%</dd></div><div><dt>Validation</dt><dd>Nested participant-disjoint folds</dd></div></dl><p className="small muted">The interval includes chance and is conditional on this evaluation. Controlled lab data are not daily-life validation.</p><div className="notice"><strong>EDA hardware required</strong><p>The current Wear OS sender has BPM, steps, calories and sleep only. Those cannot replace skin-conductance measurements or beat-to-beat RR intervals.</p></div><label htmlFor="eda-window">Import a research EDA window</label><p className="small muted">Paste a JSON array of valid readings in microsiemens from one comparable resting window, about 2 minutes. Not demo BPM values.</p><textarea id="eda-window" value={eda} onChange={e=>setEda(e.target.value)} placeholder="[ ...valid EDA readings... ]" rows={4}/><button className="primary-button" onClick={evaluate} disabled={busy || !eda.trim()}>{busy ? "Running..." : "Run research model"}</button>{modelResult && <p className="notice" role="status">{modelResult}</p>}<a className="source-link" href="https://physionet.org/content/qol-stress/1.0.0/" target="_blank" rel="noreferrer">QoL_Stress dataset · CC BY 4.0 <ArrowUpRight size={14}/></a></section>}
    {tab === "Settings" && <section className="panel model-panel"><Settings2 size={23}/><h2>Connection settings</h2><div className="notice"><strong>Your private readings</strong>{session ? <><p>Signed in. Only this account's stored measurements are shown.</p><button className="primary-button" onClick={logout}>Sign out</button></> : <form onSubmit={e=>{e.preventDefault();login();}}><label htmlFor="account-email">Appwrite email</label><input id="account-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/><label htmlFor="account-password">Password</label><input id="account-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary-button" disabled={busy}>{signup ? "Create private dashboard account" : "Sign in"}</button><button type="button" className="text-button" onClick={()=>setSignup(!signup)}>{signup ? "Already registered? Sign in" : "New here? Create a dashboard account"}</button><p className="small muted">This app-user account is separate from your Appwrite cloud-console login.</p></form>}{accountStatus && <p role="alert">{accountStatus}</p>}</div><p>Set <code>GET_HEALTH_URL</code> on the server to your own Appwrite endpoint ending in <code>/get-health-data</code>. No secrets belong in this dashboard.</p><p>The app checks signed-in readings and stored history every 30 seconds. Appwrite stores per-user, timestamped records. Hourly/daily buckets use UTC. The watch must obtain an Appwrite session; unauthenticated posts are rejected. Physical-device integration still needs testing.</p><p>Model setup: install Python dependencies and train the trusted local artifact with <code>python ml/stress_model.py train</code>. EDA collection needs separate supported hardware and a sender/storage upgrade.</p><button className="primary-button" onClick={()=>{setDemo(!demo);setTab("Trends");}}>{demo ? "Return to live mode" : "Explore labeled demo"}</button></section>}
    <footer className="journal-footer"><span>Human digital twin</span><span>{demo ? "Demo · not personal readings" : updated ? `Observed ${new Date(updated).toLocaleString()}` : "Awaiting connection"}</span></footer>
  </div>;
}
function Metric({icon,title,value,unit,detail}:{icon:React.ReactNode;title:string;value:string;unit:string;detail:string}) { return <section className="panel metric-panel"><div className="metric-label">{icon}{title}</div><div className="metric-value">{value} {unit && <span>{unit}</span>}</div><p className="small muted">{detail}</p></section>; }
