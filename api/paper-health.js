import {loadPaper} from './_paper-store.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(200).json({state:'NO_CONFIGURAT',lastRun:null});
  const s=await loadPaper(),lastRun=s.lastRun||null,age=lastRun?Date.now()-Date.parse(lastRun):null;
  const stale=!lastRun||!Number.isFinite(age)||age>36*3600000;
  const state=!lastRun?'SENSE_EXECUCIONS':stale?'DESACTUALITZAT':s.lastRunHealth==='OK'?'OPERATIU':'DEGRADAT';
  const observations=Array.isArray(s.observations)?s.observations:[];
  const recent=observations.filter(o=>Number.isFinite(Date.parse(o.at))&&Date.now()-Date.parse(o.at)<=7*86400000);
  const byMarket={crypto:recent.filter(o=>o.market==='crypto').length,stocks:recent.filter(o=>o.market==='stocks').length};
  const byPhase={};for(const o of recent){const k=o.phase||'NO INDICAT';byPhase[k]=(byPhase[k]||0)+1;}
  const recentTrades=(s.trades||[]).filter(t=>t.state==='CLOSED'&&Number.isFinite(t.netPct));
  const averageNetPct=recentTrades.length?Math.round(recentTrades.reduce((a,t)=>a+t.netPct,0)/recentTrades.length*100)/100:null;
  return res.status(200).json({state,lastRun,lastRunHealth:s.lastRunHealth||null,lastCoverage:s.lastCoverage||null,issues:s.issues||[],cronExpected:'0 19 * * * UTC',checks:s.checks||0,
   sampled:observations.length,recent7d:recent.length,byMarket7d:byMarket,byPhase7d:byPhase,accumulationObservations7d:recent.filter(o=>o.accumulationWatch===true).length,sustainedVolumeObservations7d:recent.filter(o=>o.strongVolumeWatch===true).length,
   eligible:observations.filter(o=>o.signalApproved).length,
   rejected:observations.filter(o=>!o.signalApproved).length,
   open:(s.trades||[]).filter(t=>t.state==='OPEN').length,
   closed:(s.trades||[]).filter(t=>t.state==='CLOSED').length,
   errors:(s.issues||[]).length,issues:(s.issues||[]).slice(0,8),lastCoverage:s.lastCoverage||null,lastRunHealth:s.lastRunHealth||null,cronExpected:'0 19 * * *',averageClosedNetPct:averageNetPct,
   explanation:'Mostres del servidor; no representen ordres reals ni seguiment continu.'});
 }catch(_){return res.status(200).json({state:'ERROR_LECTURA',lastRun:null,explanation:'No es pot verificar el registre del servidor'})}
}
