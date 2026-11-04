import {indicatorSeries} from './indicators.js';
import {evaluatePatterns} from './pine-patterns.js';
import {pineSpec,selectConfirmedMotor,parityPrerequisites,riskPlan} from './pine-v5281-spec.js';

// Single diagnostic contract for equities and crypto. All bars must be CLOSED.
// Does not claim that a TradingView/Pine strategy has been reproduced.
export function commonMotor({market,daily,four,hour,source='unknown',volumeConsolidated=false,confirmedHigherTimeframes=false,benchmarksVerified=false,indicatorParityVerified=false}={}){
 const missing=[];
 const normalize=(bars,tf)=>{
  if(!Array.isArray(bars)||bars.length<55){missing.push(tf+': insufficient history');return [];}
  const sorted=bars.map(b=>{const raw=b.t;const t=typeof raw==='number'?(raw<1e11?raw*1000:raw):new Date(raw).getTime();return {...b,t};}).filter(b=>Number.isFinite(b.t)&&[b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)&&b.c>0&&b.h>=Math.max(b.o,b.c,b.l)&&b.l<=Math.min(b.o,b.c,b.h)&&b.v>=0).sort((a,b)=>a.t-b.t);
  if(sorted.length!==bars.length||sorted.length<55||sorted.some((b,i)=>i>0&&b.t<=sorted[i-1].t)){missing.push(tf+': invalid or duplicate candles');return [];}
  return sorted;
 };
 const D=normalize(daily,'1D'),H=normalize(four,'4H'),F=normalize(hour,'1H');
 const parity=parityPrerequisites({sourceVolumeConsolidated:volumeConsolidated,hasBenchmarks:benchmarksVerified,hasConfirmed4H:confirmedHigherTimeframes,hasConfirmed1D:confirmedHigherTimeframes,hasIndicatorParity:indicatorParityVerified});
 const providerAudit={market,source,sourceAuthenticated:false,independentCrossCheck:false,comparisonWithTradingView:false,notes:market==='crypto'?'Coinbase i Kraken són fonts públiques, però cal comparar espelmes coincidents del mateix parell i sessió.':'Alpaca és el feed d’anàlisi; Yahoo és una referència de cotització, no una prova de paritat OHLCV amb Pine.'};
 const base={providerAudit,version:pineSpec.version,market,source,parity:'NOT_VERIFIED',verifiedSignal:false,tradeAuthorized:false,priority:pineSpec.entryPriority,missing:[...missing,...parity.missing]};
 if(missing.length)return {...base,status:'INSUFFICIENT_DATA',selectedMotor:null,motors:{A:null,C:null,E:null,F:null}};
 const fi=indicatorSeries(F),di=indicatorSeries(D),hi=indicatorSeries(H);
 const patterns=evaluatePatterns(F,fi);
 const f=fi.at(-1),d=di.at(-1),h=hi.at(-1),bar=F.at(-1);
 const trend1D=D.at(-1).c>d.ema50;
 const trend4H=H.at(-1).c>h.ema50&&h.ema20>h.ema50;
 const prior=F.slice(-21,-1),avg=prior.reduce((sum,b)=>sum+b.v,0)/20;
 const rvol=avg>0?bar.v/avg:null;
 const volumeOK=volumeConsolidated&&Number.isFinite(rvol)&&rvol>=1.1;
 const candidates={
  A:!!patterns.motors.A?.pattern,
  C:!!patterns.motors.C?.pattern,
  E:!!(patterns.motors.E?.breakout&&patterns.motors.E?.recentCompression),
  F:!!(patterns.motors.F?.trendLocal&&patterns.motors.F?.pullbackRecent&&patterns.motors.F?.resumeTrend&&patterns.motors.F?.momentumUp)
 };
 const context=trend1D&&trend4H&&f.rsi14>=40&&f.rsi14<=75;
 const qualified=Object.fromEntries(pineSpec.entryPriority.map(k=>[k,candidates[k]&&context&&volumeOK]));
 const selectedMotor=selectConfirmedMotor(qualified);
 const proposedMotor=selectConfirmedMotor(candidates);
 const risk=riskPlan({close:bar.c,atr:f.atr14,priorLow:Math.min(...F.slice(-7,-1).map(b=>b.l)),isCrypto:market==='crypto',tick:market==='crypto'?0.00000001:0.01});
 return {...base,status:selectedMotor&&risk.valid?'RESEARCH_CANDIDATE':proposedMotor?'WATCH_PATTERN':'NO_PATTERN',selectedMotor:selectedMotor||null,proposedMotor:proposedMotor||null,
  motors:Object.fromEntries(pineSpec.entryPriority.map(k=>[k,{pattern:candidates[k],qualified:qualified[k],requiresVerifiedVolume:true}])),
  checks:{trend1D,trend4H,volumeOK,rvol1H:rvol,volumeConsolidated,closed1H:new Date(bar.t).toISOString(),riskValid:risk.valid},risk,
  patternStatus:patterns.status,missing:[...parity.missing,...(volumeConsolidated?[]:['volume qualification disabled'])],
  warning:'Shared research diagnostics only. TradingView parity and live trade authorization require independent candle-by-candle verification.'};
}
