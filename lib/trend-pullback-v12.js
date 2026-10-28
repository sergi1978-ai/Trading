// LONG AI PROFIT v1.2 — registered hypothesis, NOT a production signal.
// Retains v1.1 parameters and its closed-bar gate. Adds one explicit
// 1D/4H follow-through regime check to avoid fragile countertrend rebounds.
// No data snooping, threshold search or read of unclosed higher-timeframe bars.
import {trendPullbackV11} from './trend-pullback-v11.js';
import {pineEma} from './pine-v6627-parity.js';

export const V12_REGIME=Object.freeze({
 version:'1.2.0-research',
 dailyCloseAboveEma20:true,
 fourCloseAboveEma20:true,
 fourCloseAbovePrevious:true,
 note:'Compare with v1.1 on fixed historical windows; no promise of improved returns'
});
export function trendPullbackV12(args={}){
 const old=trendPullbackV11(args);
 if(old.blocked)return {...old,version:V12_REGIME.version};
 const f=args.fourHour,d=args.daily;
 const end=b=>Date.parse(b.endExclusive);
 let fi=0,di=0,rejectedRegime=0;
 const signals=[];
 const diagnostics=[];
 // Consume only the history that was fully closed at the OPEN of the signal 1H.
 for(const s of old.signals){
   const start=Date.parse(s.signalTime)-3600000;
   while(fi<f.length&&end(f[fi])<=start)fi++;
   while(di<d.length&&end(d[di])<=start)di++;
   const four=f.slice(0,fi),daily=d.slice(0,di);
   const lastF=four.at(-1),prevF=four.at(-2),lastD=daily.at(-1);
   const daily20=daily.length>=20?pineEma(daily.map(x=>x.c),20):null;
   const four20=four.length>=20?pineEma(four.map(x=>x.c),20):null;
   const passed=lastD&&lastF&&prevF&&
      Number.isFinite(daily20)&&Number.isFinite(four20)&&
      lastD.c>daily20&&lastF.c>four20&&lastF.c>prevF.c;
   diagnostics.push({symbol:s.symbol,signalTime:s.signalTime,
     result:passed?'ACCEPTED':'REGIME_NOT_CONFIRMED',
     lastClosed4H:lastF?.endExclusive??null,lastClosed1D:lastD?.endExclusive??null});
   if(passed)signals.push({...s,strategyVersion:V12_REGIME.version,
     diagnostic:{...s.diagnostic,v12Regime:'DAILY_AND_4H_FOLLOW_THROUGH'}});
   else rejectedRegime++;
 }
 return {...old,signals,version:V12_REGIME.version,
  v12Diagnostics:diagnostics,v12Filtered:rejectedRegime,
  baselineSignals:old.signals.length,
  // No v1.1 trace is discarded. Only the regime candidate list is narrowed.
  gates:{...old.gates,REGIME_FILTERED:rejectedRegime}};
}
