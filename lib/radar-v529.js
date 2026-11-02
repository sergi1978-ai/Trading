// v5.29 · conservative diagnostics using only fields actually delivered by the API.
// No claim of parity with LONG AI SWING Pine v5.27.1.
const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
export function evaluateRisk(x,capital=10000,riskFraction=.005){
 const entry=n(x.trigger)??n(x.pineReferenceEntry);
 const stop=n(x.stop)??n(x.pineReferenceStop);
 const tp1=n(x.tp1)??n(x.pineReferenceTarget);
 const tp2=n(x.tp2);
 if(!(entry>0&&stop>0&&stop<entry))return {valid:false,reason:'Entrada o stop tecnic no verificables'};
 const risk=entry-stop,stopPct=100*risk/entry,rr1=tp1>entry?(tp1-entry)/risk:null,rr2=tp2>entry?(tp2-entry)/risk:null;
 const units=Math.floor(Math.min(capital/entry,capital*riskFraction/risk)*1e6)/1e6;
 const valid=stopPct<=10&&rr1!==null&&rr1>=1.3&&units>0;
 return {valid,entry,stop,tp1,tp2,stopPct,rr1,rr2,units,riskCash:units*risk,reason:valid?'Pla orientatiu; comprovar slippage, comissions i liquiditat':stopPct>10?'Stop massa ample':rr1===null?'TP1 no verificable':'Risc/benefici insuficient'};
}
export function classifyPattern(x){
 const pattern=String([x.pattern,x.patternName,x.earlyStage].filter(Boolean).join(' ')).toUpperCase();
 if(/COMPRESS|SQUEEZE|TRIANGLE|CONSOLID/.test(pattern))return 'COMPRESSIO';
 if(/RETEST|PULLBACK|RETROCES/.test(pattern))return 'PULLBACK';
 if(/BREAK|RUPT|EXPLOS/.test(pattern))return 'RUPTURA';
 if(/RECUPER|RECLAIM|REBOT/.test(pattern))return 'RECUPERACIO';
 return 'NO CLASSIFICAT';
}
export function volumeSignal(x){
 const r=n(x.rvol)??n(x.rvol4h);
 if(r===null)return {status:'NO VERIFICAT',reason:'Sense volum relatiu'};
 if(r<0||r>30)return {status:'ANOMALIA',reason:'Valor de volum no fiable'};
 return {status:r>=2?'ANOMAL':r>=1.2?'ELEVAT':'NORMAL',ratio:r,reason:'Comparacio relativa del proveidor; no ajustada per hora del dia'};
}
export function earlyDiagnosis(x){
 const type=classifyPattern(x),vol=volumeSignal(x),score=n(x.anticipationScore)??n(x.earlyScore);
 const valid=score!==null&&score>=60&&vol.status!=='ANOMALIA'&&vol.status!=='NO VERIFICAT';
 return {type,vol,early:valid&&type!=='NO CLASSIFICAT',score,reason:valid?'Configuracio exploratoria; falta confirmacio 1D/4H/1H':'Sense evidencia suficient'};
}
