// LONG AI RADAR · exploratory triage aligned with v5.27.1 concepts.
// NOT a Pine v5.27.1 port: API data cannot reproduce exact 1D/4H/1H signals.
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const cap=v=>Math.max(0,Math.min(100,Math.round(v)));
export function classifyCandidate(x){
 const quality=num(x.operationalQuality)??num(x.entryQuality)??num(x.score)??num(x.radarScore);
 const anticipation=num(x.anticipationScore)??num(x.earlyScore)??num(x.radarScore);
 const vol=num(x.rvol)??num(x.rvol4h);
 const price=num(x.analysisPrice)??num(x.price);
 const ema20=num(x.ema20),ema50=num(x.ema50),atr=num(x.atr14)??num(x.atr);
 const raw=String([x.pattern,x.patternName,x.earlyStage,x.status,x.primaryBlocker].filter(Boolean).join(' ')).toUpperCase();
 const isBreak=/BREAK|RUPT|EXPLOS|COMPRESS/.test(raw);
 const isRetest=/RETEST|PULLBACK|SUPORT|REBOT|RECUPER/.test(raw);
 const blocked=/INVALID|NO PERSEGUIR|SENSE DADES|DESCARTAR/.test(String(x.status||'').toUpperCase());
 const stretch=price!==null&&ema20!==null&&atr!==null&&atr>0?(price-ema20)/atr:null;
 const chasing=stretch!==null&&stretch>2.2;
 const strongVolume=vol!==null&&vol>=1.2;
 const a=quality!==null&&anticipation!==null&&!blocked?cap(.55*quality+.45*anticipation+(isRetest?8:0)):null;
 const c=quality!==null&&!blocked?cap(quality+(isRetest?8:0)+(vol!==null&&vol>=1?5:0)):null;
 const e=quality!==null&&!blocked?cap(.75*quality+.25*(anticipation??quality)+(isBreak?10:0)+(vol!==null&&vol>=1.5?8:0)):null;
 const f=quality!==null&&!blocked?cap(.65*quality+.35*(anticipation??quality)+(ema20!==null&&ema50!==null&&ema20>ema50?10:0)+(isRetest?6:0)):null;
 const motors={A:a,C:c,E:e,F:f};
 const candidates=Object.entries(motors).filter(([,v])=>v!==null).sort((p,q)=>q[1]-p[1]);
 const confluence=candidates.filter(([,v])=>v>=70).length;
 const early=anticipation!==null&&anticipation>=60&&(isRetest||isBreak||strongVolume);
 const preImpulse=early&&!chasing&&!blocked;
 const initialBreak=isBreak&&strongVolume&&!chasing&&!blocked;
 const reasons=[];
 if(blocked)reasons.push('Motor web: bloqueig o invalidació');
 if(chasing)reasons.push('Possible entrada tardana: preu allunyat de l’EMA20 (>2,2 ATR)');
 if(vol===null)reasons.push('Volum relatiu no disponible');
 if(ema20===null||atr===null)reasons.push('Distància EMA20/ATR no verificable');
 if(!reasons.length)reasons.push('Cal confirmar tendència 1D/4H i trigger 1H amb Pine');
 return {version:'RADAR-5271-EXPLORATORI',verifiedPine:false,motors,leadingMotor:candidates[0]?.[0]??null,leadingScore:candidates[0]?.[1]??null,confluence,preImpulse,initialBreak,chasing,stretchATR:stretch,reason:reasons.join(' · ')};
}

// Two distinct exploratory metrics. Neither is a calibrated return forecast.
export function evaluateOpportunity(x){
 const base=classifyCandidate(x);
 const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const cap=v=>Math.max(0,Math.min(100,Math.round(v)));
 const anticipation=numeric(x.anticipationScore)??numeric(x.earlyScore);
 const relative=numeric(x.relativeStrength)??numeric(x.rsPercent);
 const vol=numeric(x.rvol)??numeric(x.rvol4h);
 const q=numeric(x.operationalQuality)??numeric(x.entryQuality)??numeric(x.score);
 const raw=String([x.pattern,x.patternName,x.earlyStage,x.status].filter(Boolean).join(' ')).toUpperCase();
 const pattern=/BREAK|RUPT|RETEST|PULLBACK|COMPRESS|RECUPER|EXPLOS/.test(raw);
 const potential=anticipation===null&&relative===null&&base.leadingScore===null?null:cap(.55*(anticipation??base.leadingScore??50)+.30*(base.leadingScore??anticipation??50)+.15*(relative===null?50:cap(50+relative*2))+(pattern?5:0));
 let entry=q===null?null:cap(q);
 const reasons=[];
 if(base.chasing){if(entry!==null)entry=cap(entry-35);reasons.push('Preu massa estes');}
 if(vol!==null&&vol<0.7){if(entry!==null)entry=cap(entry-15);reasons.push('Volum feble');}
 if(vol===null)reasons.push('Volum no verificable');
 if(/INVALID|DESCARTAR|NO PERSEGUIR/i.test(String(x.status||''))){if(entry!==null)entry=cap(entry-25);reasons.push('Estat desfavorable');}
 const candidate=base.initialBreak?'RUPTURA INICIAL':base.preImpulse?'PRE-IMPULS':(anticipation!==null&&anticipation>=60&&!base.chasing?'WATCH':'ESPERAR');
 return {...base,potentialScore:potential,entryScore:entry,earlyState:candidate,entryReasons:reasons,scoreMethod:'heuristica no calibrada',potentialIsForecast:false};
}
// Track only observations actually received, never reconstruct past states.
export function appendObservation(history,kind,x,observedAt){
 const analysisTime=x.technicalBarTime||x.volumeBarClosedAt||x.quoteTime||x.updatedAt;
 const t=Date.parse(analysisTime||'');
 if(!Number.isFinite(t))return history;
 const now=Date.parse(observedAt);
 if(!Number.isFinite(now)||t>now+60000)return history;
 const v=evaluateOpportunity(x),price=num(x.analysisPrice)??num(x.price);
 if(price===null||price<=0)return history;
 const key=kind+':'+String(x.symbol||'').toUpperCase();
 const old=Array.isArray(history)?history:[];
 const duplicate=old.some(y=>y.key===key&&y.barTime===new Date(t).toISOString());
 if(duplicate)return old;
 return [...old,{key,barTime:new Date(t).toISOString(),observedAt:new Date(now).toISOString(),price,earlyState:v.earlyState,potential:v.potentialScore,entry:v.entryScore}].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).slice(-1500);
}
