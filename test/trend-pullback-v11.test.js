import test from 'node:test';
import assert from 'node:assert/strict';
import {trendPullbackV11,PULLBACK_V11} from '../lib/trend-pullback-v11.js';
import {simulateProfit} from '../lib/profit-simulator.js';
const START=Date.parse('2026-01-01T00:00:00Z'),H=3600000;
const bar=(i,step,p,vol)=>({
 t:new Date(START+i*step).toISOString(),
 endExclusive:new Date(START+(i+1)*step).toISOString(),
 o:p,h:p+.16,l:p-.16,c:p+.08,v:vol
});
function fixture(){
 const hourly=Array.from({length:24*150},(_,i)=>{
  const p=100+i*.005+Math.sin(i*.6)*.07;
  const b=bar(i,H,p,12000);
  b.o=p-.02;b.c=p+.02;b.h=p+.09;b.l=p-.09;
  return b;
 });
 const last=hourly.at(-1),p=100+(hourly.length-1)*.005;
 Object.assign(last,{o:p-.04,c:p+.12,h:p+.18,l:p-.10,v:30000});
 const fourHour=Array.from({length:6*150},(_,i)=>bar(i,4*H,100+i*.02,80000));
 const daily=Array.from({length:150},(_,i)=>bar(i,24*H,100+i*.12,240000));
 return {symbol:'BTC-USD',market:'CRYPTO',hourly,fourHour,daily,tickSize:.01,volumeApproved:true};
}
test('v1.1 does not emit signals when exchange volume is unverified',()=>{
 const r=trendPullbackV11({...fixture(),volumeApproved:false});
 assert.deepEqual(r.signals,[]);assert.equal(r.blocked,'VOLUME_NOT_APPROVED');
});
test('v1.1 always uses 4H/1D completed before 1H opening, never 1H closing',()=>{
 const r=trendPullbackV11(fixture());
 for(const x of r.traces){
  if(x.higherTimeframe.fourEnd)assert.ok(Date.parse(x.higherTimeframe.fourEnd)<=Date.parse(x.signalTime)-H);
  if(x.higherTimeframe.dayEnd)assert.ok(Date.parse(x.higherTimeframe.dayEnd)<=Date.parse(x.signalTime)-H);
 }
});
test('v1.1 uses only fixed risk and closed signals compatible with portfolio simulator',()=>{
 const f=fixture(),r=trendPullbackV11(f);
 for(const s of r.signals){
  assert.equal(s.strategyId,'TREND_PULLBACK');
  assert.equal(s.strategyVersion,PULLBACK_V11.version);
  assert.ok(s.entryTrigger>s.initialStop);
  assert.ok(f.hourly.some(x=>x.endExclusive===s.signalTime));
  assert.ok(Date.parse(s.closedContext.dayEnd)<Date.parse(s.signalTime));
 }
 const b=simulateProfit({barsBySymbol:{[f.symbol]:f.hourly},signals:r.signals});
 assert.ok(b.accepted.every(x=>x.riskBudget<=x.capitalAtEntry*.005+1e-7));
});
test('v1.1 is deterministic, with one terminal trace per candle',()=>{
 const f=fixture();const a=trendPullbackV11(f),b=trendPullbackV11(f);
 assert.deepEqual(a,b);assert.equal(a.traces.length,f.hourly.length);
 assert.equal(Object.values(a.gates).reduce((x,y)=>x+y,0),f.hourly.length);
});
test('v1.1 rejects malformed or overlapping hourly candles rather than filling gaps',()=>{
 const f=fixture();f.hourly[24]={...f.hourly[23]};
 assert.throws(()=>trendPullbackV11(f),/Invalid 1H candle/);
});
test('v1.1 never fires in structurally bearish daily regime',()=>{
 const f=fixture();
 for(let i=0;i<f.daily.length;i++){
  const p=180-i*.4;
  f.daily[i]={...f.daily[i],o:p,c:p-.05,h:p+.15,l:p-.15};
 }
 const r=trendPullbackV11(f);
 assert.equal(r.signals.length,0);
});
test('v1.1 new signals depend only on past data, not future appended candles',()=>{
 const f=fixture(),whole=trendPullbackV11(f);
 const truncated={...f,hourly:f.hourly.slice(0,-24),fourHour:f.fourHour.slice(0,-6),daily:f.daily.slice(0,-1)};
 const a=trendPullbackV11(truncated);
 assert.deepEqual(a.signals,whole.signals.filter(x=>Date.parse(x.signalTime)<=Date.parse(truncated.hourly.at(-1).endExclusive)));
});
