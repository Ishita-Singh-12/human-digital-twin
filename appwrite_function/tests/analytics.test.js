import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReading,latest,aggregate,range } from '../analytics.js';
const now=Date.parse('2026-10-09T15:00:00Z');
test('rejects invalid values and timestamps',()=>{
 for (const v of [-1,NaN,Infinity,'72',301]) assert.throws(()=>validateReading('bpm',{value:v},now));
 assert.throws(()=>validateReading('steps',{value:1.5},now));
 assert.throws(()=>validateReading('sleep',{value:''},now));
 assert.throws(()=>validateReading('bpm',{value:72,observedAt:'wrong'},now));
});
test('records received and observed time',()=>{const r=validateReading('bpm',{value:72},now);assert.equal(r.observedAt,r.receivedAt);});
test('latest is independent for each metric and observation order',()=>{
 const rows=[validateReading('bpm',{value:72},now),validateReading('bpm',{value:65,observedAt:'2026-10-09T14:00:00Z'},now),validateReading('steps',{value:500},now)];
 assert.equal(latest(rows).bpm,72);assert.equal(latest(rows).steps,500);assert.equal(latest(rows).sleep,null);
});
test('UTC buckets average samples and leave gaps blank; cumulative values not summed',()=>{
 const rows=[validateReading('bpm',{value:60},now-7200000),validateReading('bpm',{value:80},now-7190000),validateReading('bpm',{value:75},now-1000),validateReading('steps',{value:100},now-1000),validateReading('steps',{value:200},now-500)];
 const a=aggregate(rows,{from:now-86400000,to:now,bucket:'hour'});
 assert.equal(a.buckets.length,2);assert.equal(a.buckets[0].metrics.bpm.mean,70);assert.equal(a.buckets[1].metrics.steps.mean,150);assert.equal(a.trend.bpm.delta,5);
});
test('range validation',()=>{assert.throws(()=>range({days:90},now));assert.equal(range({days:7},now).bucket,'day');});
