import test from "node:test";
import assert from "node:assert/strict";
import {HOUR_MS,FOUR_H_MS,DAY_MS,auditBars,aggregateHourly,compareNative,toCsv} from "../lib/profit-ohlcv.mjs";
const H=HOUR_MS,D=DAY_MS;
function bar(t,n=0){
  const p=100+n;
  return {t,o:p,h:p+2,l:p-1,c:p+1,v:10+n,closeTime:t+H-1};
}
const hours=Array.from({length:48},(_,i)=>bar(Date.UTC(2026,6,1)+H*i,i));
test("canonical Binance 1H integrity: no gaps, invalid bars, duplicate or time offsets",()=>{
  const a=auditBars(hours,"1h",{start:hours[0].t,end:hours[0].t+48*H});
  assert.equal(a.ok,true);
  assert.equal(a.count,48);
  for(const metric of ["gaps","duplicates","misplaced","invalid","outOfRange","incomplete"])assert.equal(a[metric],0);
});
test("resampling uses ONLY closed complete UTC 4h and 1d groups",()=>{
  const four=aggregateHourly(hours,"4h"),days=aggregateHourly(hours,"1d");
  assert.equal(four.length,12);assert.equal(days.length,2);
  assert.equal(four[0].o,100);
  assert.equal(four[0].h,105);
  assert.equal(four[0].l,99);
  assert.equal(four[0].c,104);
  assert.equal(four[0].v,10+11+12+13);
  assert.equal(days[0].t,hours[0].t);
  assert.equal(days[1].t,hours[24].t);
  assert.equal(days[0].closeTime,days[0].t+D-1);
});
test("drops incomplete 4h or 1d groups; missing 1h causes gap finding",()=>{
  const data=hours.filter((_,i)=>i!==7);
  const a=auditBars(data,"1h");
  assert.equal(a.ok,false);assert.equal(a.gaps,1);
  assert.equal(aggregateHourly(data,"4h").length,11);
  assert.equal(aggregateHourly(data,"1d").length,1);
});
test("native comparison refuses OHLC/volume mismatches and missing groups",()=>{
  const orig=aggregateHourly(hours,"4h"),native=orig.map(x=>({...x}));
  assert.equal(compareNative(orig,native).ok,true);
  native[0].h+=.01;
  assert.equal(compareNative(orig,native).mismatches,1);
  assert.equal(compareNative(orig,native.slice(1)).ok,false);
});
test("native comparison tolerates negligible floating summation drift",()=>{
  const d=aggregateHourly(hours,"1d"),target=d.map(x=>({...x,v:x.v+1e-9}));
  assert.equal(compareNative(d,target).ok,true);
});
test("OHLC price invariants, incorrect close times and duplicated bar fail loudly",()=>{
  assert.equal(auditBars([{...hours[0],h:0}],"1h").ok,false);
  assert.equal(auditBars([{...hours[0],closeTime:hours[0].closeTime+1000}],"1h").ok,false);
  assert.equal(auditBars([hours[0],hours[0]],"1h").ok,false);
});
test("CSV explicit UTC and complete ordered header",()=>{
  const csv=toCsv(hours.slice(0,2));
  assert.ok(csv.startsWith("time,open,high,low,close,volume\n2026-07-01T00:00:00.000Z,100,102,99,101,10\n"));
});
