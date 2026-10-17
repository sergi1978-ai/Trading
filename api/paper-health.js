import {loadPaper} from './_paper-store.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(200).json({state:'NO_CONFIGURAT',lastRun:null});
  const s=await loadPaper(),lastRun=s.lastRun||null,age=lastRun?Date.now()-Date.parse(lastRun):null;
  const state=!lastRun?'SENSE_EXECUCIONS':!Number.isFinite(age)||age>36*3600000?'DESACTUALITZAT':'OPERATIU';
  const observations=Array.isArray(s.observations)?s.observations:[];
  return res.status(200).json({state,lastRun,checks:s.checks||0,
   sampled:observations.length,eligible:observations.filter(o=>o.signalApproved).length,
   rejected:observations.filter(o=>!o.signalApproved).length,
   open:(s.trades||[]).filter(t=>t.state==='OPEN').length,
   closed:(s.trades||[]).filter(t=>t.state==='CLOSED').length,
   errors:(s.issues||[]).length,
   explanation:'Mostres del servidor; no representen ordres reals ni seguiment continu.'});
 }catch(_){return res.status(200).json({state:'ERROR_LECTURA',lastRun:null,explanation:'No es pot verificar el registre del servidor'})}
}
