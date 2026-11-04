// Compare the independent web scanner and shared Pine-reference diagnostics.
// This is NOT an automatic comparison with live TradingView/Pine outputs.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const pct=(a,b)=>finite(a)&&finite(b)&&b!==0?100*(a-b)/Math.abs(b):null;
export function compareMotorDiagnostics(web,common,{priceTolerancePct=0.5}={}){
 if(!web||!common)return {status:'MISSING_DATA',verifiedTradingView:false,checks:[],discrepancies:['Missing web or common engine']};
 const checks=[];
 const add=(name,webValue,referenceValue,kind='text')=>{
  const delta=kind==='price'?pct(webValue,referenceValue):null;
  const comparable=kind==='price'?finite(delta):webValue!=null&&referenceValue!=null;
  const matches=comparable&&(kind==='price'?Math.abs(delta)<=priceTolerancePct:String(webValue)===String(referenceValue));
  checks.push({name,webValue:webValue??null,referenceValue:referenceValue??null,deltaPct:delta,comparable,matches});
 };
 add('Motor',web.pineReferenceRoute??web.pattern??null,common.selectedMotor);
 add('Entrada',web.pineReferenceEntry??web.trigger??null,common.risk?.entry??null,'price');
 add('Stop',web.pineReferenceStop??web.stop??null,common.risk?.stop??null,'price');
 add('Objectiu 1',web.pineReferenceTarget??web.tp1??web.target1??null,common.risk?.tp1??null,'price');
 add('Objectiu 2',web.tp2??web.target2??null,common.risk?.tp2??null,'price');
 const discrepancies=checks.filter(x=>x.comparable&&!x.matches).map(x=>x.name);
 return {status:checks.some(x=>x.comparable)?discrepancies.length?'DIFFERENCES':'WEB_REFERENCE_AGREES':'INSUFFICIENT_COMPARABLE_FIELDS',verifiedTradingView:false,referenceVersion:common.version,checks,discrepancies,
 warning:'Comparació automàtica entre dos càlculs web, NO contra resultats reals de TradingView. Motor i rutes tenen taxonomies diferents fins a homologació.'};
}
