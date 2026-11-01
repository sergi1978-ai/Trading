// Candidate triage based on EXISTING scanner fields. NOT a port of Pine v5.15.
// Three provisional categories are intended for research, never confirmed trades.
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
export function classifyCandidate(x){
 const quality=num(x.operationalQuality)??num(x.entryQuality)??num(x.score)??num(x.radarScore);
 const anticipation=num(x.anticipationScore)??num(x.earlyScore)??num(x.radarScore);
 const vol=num(x.rvol)??num(x.rvol4h);
 const raw=String(x.pattern||x.patternName||x.earlyStage||x.status||'').toUpperCase();
 const isBreak=/BREAK|RUPT|EXPLOS|COMPRESS/.test(raw);
 const isRetest=/RETEST|PULLBACK|SUPORT|REBOT/.test(raw);
 const blocked=/INVALID|NO PERSEGUIR|SENSE DADES/.test(String(x.status||'').toUpperCase());
 const a=quality!==null&&anticipation!==null&&!blocked?Math.min(100,Math.round(.55*quality+.45*anticipation+(isRetest?8:0))):null;
 const c=quality!==null&&!blocked?Math.min(100,Math.round(quality+(isRetest?8:0)+(vol!==null&&vol>=1?5:0))):null;
 const e=quality!==null&&!blocked?Math.min(100,Math.round(.75*quality+.25*(anticipation??quality)+(isBreak?10:0)+(vol!==null&&vol>=1.5?8:0))):null;
 const candidates=[['A',a],['C',c],['E',e]].filter(([,v])=>v!==null).sort((p,q)=>q[1]-p[1]);
 return {version:'ACE-EXPLORATORI-0.1',verifiedPine:false,motors:{A:a,C:c,E:e},leadingMotor:candidates[0]?.[0]??null,leadingScore:candidates[0]?.[1]??null,reason:blocked?'Descartat pel motor existent':'Classificació experimental; no equival a les regles Pine v5.15'};
}
