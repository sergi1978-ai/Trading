#!/usr/bin/env node
// Fetch public Binance Spot OHLCV; never place orders and never use API keys.
// Confirm 1H -> 4H / 1D against exchange-native bars, export audit + CSV.
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {HOUR_MS,DURATION,toBar,auditBars,aggregateHourly,compareNative,toCsv} from "../lib/profit-ohlcv.mjs";

const args=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith("--") && x.includes("=")).map(x=>{
  const ix=x.indexOf("=");return [x.slice(2,ix),x.slice(ix+1)];
}));
function timestamp(x){
  const iso=/^\d{4}-\d\d-\d\d$/.test(x)?x+"T00:00:00Z":x;
  const n=Date.parse(iso); if(!Number.isFinite(n))throw Error("Invalid ISO/UTC date: "+x);
  return n;
}
const from=timestamp(args.from??"2026-07-01");
const to=timestamp(args.to??"2026-08-12");
const destination=resolve(args.out??"artifacts/profit-ohlcv");
const symbols=(args.symbols??"BTCUSDT,ETHUSDT,SOLUSDT").split(",").map(x=>x.trim());
if(from>=to || from%86400000 || to%86400000)throw Error("Expected UTC midnight range, half-open [from,to)");
if(to>Date.now()-HOUR_MS)throw Error("End date must be historical, not an open candle");
if(to-from < 30*86400000)throw Error("Require >=30 days for initial data QA");
if(symbols.length===0 || symbols.some(s=>!/^[A-Z0-9]{5,20}$/.test(s)))throw Error("Invalid symbols");
const hosts=[
 "https://data-api.binance.vision/api/v3/klines",
 "https://api.binance.com/api/v3/klines"
];
async function requestKlines(symbol,tf,cursor,end){
  const qp=new URLSearchParams({symbol,interval:tf,startTime:String(cursor),
     endTime:String(end-1),limit:"1000"});
  let failures=[];
  for(const host of hosts){
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(host+"?"+qp,{headers:{"Accept":"application/json"},
           signal:AbortSignal.timeout(20000)});
        if(!response.ok){throw Error("HTTP "+response.status+" "+(await response.text()).slice(0,140));}
        const data=await response.json();
        if(!Array.isArray(data)) throw Error("Non-array Binance API response");
        return data;
      }catch(err){
        failures.push(host+" attempt "+(attempt+1)+": "+String(err.message||err));
        await delay(350*(attempt+1)**2);
      }
    }
  }
  throw Error("Unable to fetch "+symbol+" "+tf+": "+failures.join("; "));
}
async function download(symbol,tf){
  const ms=DURATION[tf];let cursor=from,results=[],requests=0;
  while(cursor<to){
    const data=await requestKlines(symbol,tf,cursor,to);
    requests++;
    if(data.length===0)break;
    const parsed=data.map(toBar).filter(b=>b.t>=from && b.t<to);
    // Never let a look-ahead / developing candle into the historical archive.
    if(parsed.some(b=>b.closeTime>=Date.now()))throw Error("Open or future candle detected");
    results.push(...parsed);
    const newest=parsed.at(-1)?.t;
    if(newest===undefined || newest<cursor)throw Error("No progress in Binance pagination");
    cursor=newest+ms;
    if(requests>1000)throw Error("Runaway request loop");
    await delay(100);
  }
  return {bars:results,requests};
}
await mkdir(destination,{recursive:true});
const summary={source:"Binance Spot public market-data API",timeZone:"UTC",
  start:new Date(from).toISOString(),endExclusive:new Date(to).toISOString(),
  capturedAt:new Date().toISOString(),classification:"KNOWN HISTORICAL / RESEARCH; NOT BLIND OUT-OF-SAMPLE",
  note:"Do NOT claim Pine/Trading 2026 signal parity or profit from data QA",
  symbols:{},ok:true};
for(const symbol of symbols){
  const hours=await download(symbol,"1h");
  const native4=await download(symbol,"4h");
  const nativeDay=await download(symbol,"1d");
  const audit1=auditBars(hours.bars,"1h",{start:from,end:to});
  const audit4=auditBars(native4.bars,"4h",{start:from,end:to});
  const auditDay=auditBars(nativeDay.bars,"1d",{start:from,end:to});
  const derived4=aggregateHourly(hours.bars,"4h");
  const derivedDay=aggregateHourly(hours.bars,"1d");
  const comparison4=compareNative(derived4,native4.bars);
  const comparisonDay=compareNative(derivedDay,nativeDay.bars);
  // Exact coverage of the 1H sample is mandatory; no silent gaps or missing bars.
  const expectedHours=(to-from)/HOUR_MS;
  const symbolOK=audit1.ok && audit4.ok && auditDay.ok && hours.bars.length===expectedHours &&
    comparison4.ok && comparisonDay.ok &&
    derived4.length===Math.floor((to-from)/DURATION["4h"]) &&
    derivedDay.length===Math.floor((to-from)/DURATION["1d"]);
  const report={ok:symbolOK,expectedHours,
    requests:{h1:hours.requests,h4:native4.requests,day:nativeDay.requests},
    1:audit1,4:audit4,day:auditDay,
    comparison4,comparisonDay};
  summary.symbols[symbol]=report;
  summary.ok &&= symbolOK;
  await writeFile(resolve(destination,symbol+"_1h.csv"),toCsv(hours.bars));
  await writeFile(resolve(destination,symbol+"_4h.csv"),toCsv(derived4));
  await writeFile(resolve(destination,symbol+"_1d.csv"),toCsv(derivedDay));
  console.log(symbol,JSON.stringify({ok:symbolOK,hourly:hours.bars.length,
    fourHourMatches:comparison4.compared,dailyMatches:comparisonDay.compared}));
}
await writeFile(resolve(destination,"manifest.json"),JSON.stringify(summary,null,2)+"\n");
if(!summary.ok){
  console.error("FAILED: gaps, malformed bars, incomplete coverage or 4H/1D cross-check mismatches");
  process.exitCode=1;
}else{
  console.log("PASS: UTC 1H -> 4H -> 1D Binance native consistency");
}
