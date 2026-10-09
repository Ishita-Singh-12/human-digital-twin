/** Descriptive measurements, never health verdicts. UTC bucket boundaries. */
export const METRICS = ['bpm', 'steps', 'calories', 'sleep'];
export function validateReading(metric, body, now = Date.now()) {
  if (!METRICS.includes(metric)) throw new Error('Unknown metric');
  const value = body?.value;
  if (metric === 'sleep') {
    if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new Error('Sleep must be a short duration string');
  } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (metric === 'bpm' ? 300 : 1000000) || (metric === 'steps' && !Number.isInteger(value))) {
    throw new Error('Invalid numeric reading');
  }
  const receivedAt = new Date(now).toISOString();
  const observed = body.observedAt === undefined ? now : Date.parse(body.observedAt);
  if (!Number.isFinite(observed) || observed > now + 300000 || observed < now - 365 * 86400000) throw new Error('Invalid observation timestamp');
  return { metric, numericValue: metric === 'sleep' ? null : value, textValue: metric === 'sleep' ? value : null,
    observedAt: new Date(observed).toISOString(), receivedAt };
}
export function latest(records) {
  const result = { bpm: null, steps: null, calories: null, sleep: null, samples: {} };
  for (const metric of METRICS) {
    const row = records.filter(r => r.metric === metric).sort((a,b) => Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
    if (row) { result[metric] = metric === 'sleep' ? row.textValue : row.numericValue;
      result.samples[metric] = { observedAt: row.observedAt, receivedAt: row.receivedAt }; }
  }
  return result;
}
export function aggregate(records, { from, to, bucket }) {
  const size = bucket === 'hour' ? 3600000 : 86400000;
  const bins = new Map();
  for (const row of records) {
    const time = Date.parse(row.observedAt);
    if (time < from || time >= to || !Number.isFinite(row.numericValue) || row.metric === 'sleep') continue;
    const at = new Date(Math.floor(time/size)*size).toISOString();
    if (!bins.has(at)) bins.set(at, { at, metrics: {} });
    const bin = bins.get(at), metric = bin.metrics[row.metric] ?? { sum: 0, count: 0, min: Infinity, max: -Infinity };
    metric.sum += row.numericValue; metric.count++; metric.min = Math.min(metric.min,row.numericValue); metric.max = Math.max(metric.max,row.numericValue);
    bin.metrics[row.metric] = metric;
  }
  const buckets = [...bins.values()].sort((a,b)=>a.at.localeCompare(b.at)).map(bin=>({at:bin.at,metrics:Object.fromEntries(Object.entries(bin.metrics).map(([key,v])=>[key,{mean:v.sum/v.count,count:v.count,min:v.min,max:v.max}]))}));
  const trend = {};
  for (const metric of ['bpm','steps','calories']) {
    const values = buckets.filter(b=>b.metrics[metric]);
    trend[metric] = values.length > 1 ? { firstMean: values[0].metrics[metric].mean, lastMean: values.at(-1).metrics[metric].mean,
      delta: values.at(-1).metrics[metric].mean-values[0].metrics[metric].mean } : null;
  }
  return { bucket, timezone:'UTC', from:new Date(from).toISOString(), to:new Date(to).toISOString(), records:records.length, buckets, trend,
    note:'Sample-weighted descriptive averages. Steps and calories are reported cumulative values, not summed daily totals. Missing periods are not filled. Not a health assessment.' };
}
export function range(query={}, now=Date.now()) {
  const days = Number(query.days ?? 1);
  if (![1,7,30].includes(days)) throw new Error('days must be 1, 7 or 30');
  const bucket = query.bucket ?? (days === 1 ? 'hour' : 'day');
  if (!['hour','day'].includes(bucket)) throw new Error('bucket must be hour or day');
  return { from: now-days*86400000, to:now, bucket };
}
