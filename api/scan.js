import {momentumDiagnostic,weeklyDiagnostic,momentumPhase,momentumContext,earlyMomentumTurn} from './_momentum.js';

const ALPACA = 'https://data.alpaca.markets/v2/stocks/bars';
const providerCache=new Map();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function limitedAlpaca(url){
 const cached=providerCache.get(url);if(cached&&Date.now()-cached.at<120000)return cached.data;
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(url,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY||'','APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET||''}});
  if(response.status===429){if(attempt<2){await sleep(700*(attempt+1));continue;}throw new Error('Alpaca 429: límit de peticions; dades no actualitzades');}
  const body=await response.text();if(!response.ok)throw new Error('Alpaca '+response.status+': '+body.slice(0,220));
  const data=JSON.parse(body);providerCache.set(url,{at:Date.now(),data});if(providerCache.size>75)providerCache.delete(providerCache.keys().next().value);return data;
 }
}

const BENCHMARK = {
  ANET:'QQQ', CRDO:'SOXX', AAOI:'SOXX', CLS:'QQQ', MU:'SOXX', AVGO:'SOXX',
  VRT:'XLI', ETN:'XLI', GEV:'XLI', POWL:'XLI', NVT:'XLI', HUBB:'XLI', FIX:'XLI', STRL:'XLI', EME:'XLI', MOD:'XLI', CARR:'XLI',
  BE:'XLU', CEG:'XLU', VST:'XLU', CCJ:'URA', LEU:'URA', BWXT:'URA',
  PANW:'CIBR', CRWD:'CIBR', VRNS:'CIBR', ZS:'CIBR', QLYS:'CIBR',
  PLTR:'QQQ', SNOW:'IGV', NOW:'IGV', CRM:'IGV', NBIS:'QQQ',
  RKLB:'ITA', KTOS:'ITA', KRMN:'ITA', HWM:'ITA',
  LLY:'XLV', UNH:'XLV',
  SMH:'SPY', SOXX:'SPY', IGV:'SPY', CIBR:'SPY', ITA:'SPY', URA:'SPY', PAVE:'SPY', XLI:'SPY', XLU:'SPY', IWM:'SPY', QQQ:'SPY'
};


function ema(values, len) {
  if (!values?.length) return null;
  const k = 2/(len+1);
  let e = values[0];
  for (let i=1;i<values.length;i++) e = values[i]*k + e*(1-k);
  return e;
}
function emaSeries(values, len) {
  if (!values?.length) return [];
  const k=2/(len+1); let e=values[0]; const out=[e];
  for(let i=1;i<values.length;i++){e=values[i]*k+e*(1-k);out.push(e);}
  return out;
}
function atr(bars, len=14) {
  if (!bars || bars.length < 2) return null;
  const trs=[];
  for(let i=1;i<bars.length;i++){
    const h=bars[i].h,l=bars[i].l,pc=bars[i-1].c;
    trs.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));
  }
  const a = ema(trs, len);
  return a;
}
function rsi(values, len=14){
  if(!values || values.length < len+1) return null;
  let gains=[],losses=[];
  for(let i=1;i<values.length;i++){
    const d=values[i]-values[i-1];
    gains.push(Math.max(d,0)); losses.push(Math.max(-d,0));
  }
  const ag=ema(gains,len), al=ema(losses,len);
  if(al===0) return 100;
  const rs=ag/al;
  return 100-(100/(1+rs));
}
function pct(a,b){ return b ? ((a/b)-1)*100 : null; }
function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }
function last(arr){ return arr[arr.length-1]; }
function pivotLow(bars, len=3){
  if(!bars || bars.length < 2*len+1) return null;
  for(let i=bars.length-len-1;i>=len;i--){
    const v=bars[i].l; let ok=true;
    for(let j=i-len;j<=i+len;j++) if(j!==i && bars[j].l<=v){ok=false;break;}
    if(ok) return v;
  }
  return null;
}
function sma(values, len){
  if(!values || values.length < len) return null;
  const s = values.slice(-len).reduce((a,b)=>a+b,0);
  return s/len;
}
function returnPct(values, bars=20){
  if(!values || values.length < bars+1) return null;
  const a = values[values.length-bars-1], b = values[values.length-1];
  return a ? ((b/a)-1)*100 : null;
}
// Diagnostic only: compare completed hourly participation with the same NY clock-hour
// across prior sessions; partial IEX feed is not consolidated US market volume.
function hourlySlotRvol(bars){
 if(!Array.isArray(bars)||bars.length<20)return {ratio:null,samples:0,source:'IEX parcial'};
 const current=bars.at(-1),date=new Date(current.t);
 if(!Number.isFinite(date.getTime())||!(current.v>0))return {ratio:null,samples:0,source:'IEX parcial'};
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23',minute:'2-digit'});
 const slot=x=>fmt.format(new Date(x.t));
 const key=slot(current);
 const previous=bars.slice(0,-1).filter(b=>b.v>0&&slot(b)===key).slice(-15);
 if(previous.length<5)return {ratio:null,samples:previous.length,source:'IEX parcial'};
 const sorted=previous.map(b=>b.v).sort((a,b)=>a-b);
 const median=sorted[Math.floor(sorted.length/2)];
 return {ratio:median>0?Math.round(current.v/median*100)/100:null,samples:previous.length,source:'IEX parcial',nyHour:key};
}
function volumeReading(bars, support, atr4){
  // Compare completed 4H bars with previous completed 4H bars on the same feed.
  // IEX is a partial-market feed; this is relative participation, not total volume.
  if(bars.length<22) return {volumeScore:null,volumeLabel:'Sense dades suficients',volumeReason:'Calen 22 espelmes 4H completes',rvol4h:null};
  const current=last(bars), avg=sma(bars.slice(-21,-1).map(b=>b.v||0),20);
  if(!avg || !Number.isFinite(current.v)) return {volumeScore:null,volumeLabel:'Sense volum fiable',volumeReason:'El feed no ofereix volum suficient',rvol4h:null};
  const ratio=current.v/avg;
  // IEX partial-feed may report almost empty bars. Treat these as unavailable
  // instead of meaningful 0.0x volume or bearish/bullish confirmation.
  if(current.v<=0||ratio<0.05)return {volumeScore:null,volumeLabel:'Volum no fiable',volumeReason:'Espelma 4H amb volum nul o massa baix respecte de les anteriors (feed parcial)',rvol4h:null,volumeDirection:'SENSE DADES'};
  const near=Number.isFinite(support) && Number.isFinite(atr4) && Math.abs(current.l-support)<=atr4*0.65;
  const up=current.c>current.o, down=current.c<current.o;
  const bounce=near && up && current.c>support && ratio>=1.25;
  const selling=down && ratio>=1.5;
  const quietPullback=down && ratio<0.75;
  const score=clamp(Math.round(50+(bounce?25:0)+(quietPullback?10:0)+(up&&ratio>=1.5?15:0)-(selling?30:0)-(ratio<0.5&&up?10:0)),0,100);
  const reason=bounce?'Rebot prop del suport amb més volum':selling?'Baixada amb volum alt':quietPullback?'Retrocés amb menys volum':up&&ratio>=1.5?'Pujada amb volum alt':'Volum sense senyal clar';
  return {volumeScore:score,volumeLabel:score>=70?'Favorable':score<=35?'Desfavorable':'Mixt',volumeReason:reason,rvol4h:Math.round(ratio*100)/100,volumeDirection:ratio>=0.9&&up?'ALCISTA':ratio>=0.9&&down?'BAIXISTA':'NEUTRAL'};
}

function pivotHigh(bars, len=3){
  if(!bars || bars.length < 2*len+1) return null;
  for(let i=bars.length-len-1;i>=len;i--){
    const v=bars[i].h; let ok=true;
    for(let j=i-len;j<=i+len;j++) if(j!==i && bars[j].h>=v){ok=false;break;}
    if(ok) return v;
  }
  return null;
}
function latestCompleted(bars, tf){
  // API may include current incomplete bar. For intraday, drop the last if very recent.
  if(!bars?.length) return bars||[];
  if(tf === '1Day') { const now=Date.now(); const t=new Date(last(bars).t).getTime(); return now-t<20*60*60*1000&&bars.length>1?bars.slice(0,-1):bars; }
  const now=Date.now();
  const mins=tf==='30Min'?30:tf==='1Hour'?60:tf==='4Hour'?240:60;
  const t=new Date(last(bars).t).getTime();
  if(now - t < mins*60*1000*0.9 && bars.length>1) return bars.slice(0,-1);
  return bars;
}
async function chooseHistoricalFeed(){
 const cutoff=new Date(Date.now()-20*60*1000).toISOString();
 const start=new Date(Date.now()-8*86400000).toISOString();
 const params=new URLSearchParams({symbols:'SPY',timeframe:'1Day',start,end:cutoff,limit:'15',feed:'sip',adjustment:'raw'});
 try{
  const response=await fetch(ALPACA+'?'+params,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY||'','APCA-API-SECRET-KEY':process.env.ALPACA_API_SECRET||''}});
  if(response.ok){const data=await response.json();if((data.bars?.SPY||[]).length)return {feed:'sip',cutoff,fallback:false};}
  return {feed:'iex',cutoff,fallback:true,reason:'SIP no disponible amb les credencials actuals'};
 }catch(e){return {feed:'iex',cutoff,fallback:true,reason:'Error comprovant SIP: '+String(e.message||e)};}
}
async function fetchBars(symbols,timeframe,start,limit=10000,historyFeed='iex',historyCutoff=null){
 const merged={},CHUNK=7;
 for(let i=0;i<symbols.length;i+=CHUNK){
  const batch=symbols.slice(i,i+CHUNK);
  let pageToken=null,page=0;
  do{
   const params=new URLSearchParams({symbols:batch.join(','),timeframe,start,limit:String(limit),adjustment:'split',feed:historyFeed,sort:'asc'});
   if(historyFeed==='sip'&&historyCutoff)params.set('end',historyCutoff);
   if(pageToken)params.set('page_token',pageToken);
   const j=await limitedAlpaca(`${ALPACA}?${params}`);
   for(const [sym,bars] of Object.entries(j.bars||{}))merged[sym]=(merged[sym]||[]).concat(bars||[]);
   pageToken=j.next_page_token||null;
   page++;
  }while(pageToken&&page<8);
  // A cap avoids unbounded serverless execution. Missing symbols remain diagnosable.
 }
 for(const sym of Object.keys(merged)){
  const byTime=new Map(merged[sym].map(x=>[x.t,x]));
  merged[sym]=[...byTime.values()].sort((a,b)=>new Date(a.t)-new Date(b.t));
 }
 return merged;
}
function addDays(d,n){ const x=new Date(d); x.setUTCDate(x.getUTCDate()+n); return x.toISOString(); }

function aggregateFourHourFromHourly(hourly){
 const valid=latestCompleted(hourly,'1Hour');
 const buckets=new Map();
 for(const b of valid){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(b.t));
  if(!buckets.has(day))buckets.set(day,[]);
  buckets.get(day).push(b);
 }
 const out=[];
 for(const group of buckets.values()){
  group.sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  // Group by four completed hourly candles within the same NY trading date.
  for(let i=0;i+4<=group.length;i+=4){
   const x=group.slice(i,i+4);
   out.push({t:x[0].t,o:x[0].o,h:Math.max(...x.map(v=>v.h)),l:Math.min(...x.map(v=>v.l)),c:x[3].c,v:x.reduce((a,v)=>a+(v.v||0),0)});
  }
 }
 return out.sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
}
function compute(symbol, dBarsRaw, h4BarsRaw, h1BarsRaw, benchH1Raw=[], m30Raw=[]){
  const dBars=latestCompleted(dBarsRaw,'1Day');
  let h4Bars=latestCompleted(h4BarsRaw,'4Hour');
  const rebuilt=aggregateFourHourFromHourly(h1BarsRaw);
  const reconstructed4H=h4Bars.length<25&&rebuilt.length>=25;
  if(reconstructed4H)h4Bars=rebuilt;
  const h1Bars=latestCompleted(h1BarsRaw,'1Hour');
  const m30=latestCompleted(m30Raw,'30Min');
  // RSI 1W uses completed historical weeks only; today's partial week is excluded.
  const weeklyCloses=[];
  const weeklyKeys=[];
  for(const bar of dBars){
    const t=new Date(bar.t);if(!Number.isFinite(t.getTime()))continue;
    const day=t.getUTCDay(),monday=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()-(day+6)%7)).toISOString().slice(0,10);
    if(weeklyKeys.at(-1)===monday)weeklyCloses[weeklyCloses.length-1]=bar.c;
    else {weeklyKeys.push(monday);weeklyCloses.push(bar.c)}
  }
  // The ongoing week is not a closed weekly candle.
  const now=new Date(),todayDay=now.getUTCDay(),thisMonday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-(todayDay+6)%7)).toISOString().slice(0,10);
  if(weeklyKeys.at(-1)===thisMonday)weeklyCloses.pop();
  const dailyCloses=dBars.map(b=>b.c);
  const rsiDaily=rsi(dailyCloses,14),rsiDailyPrev=rsi(dailyCloses.slice(0,-1),14);
  const rsiWeekly=rsi(weeklyCloses,14),rsiWeeklyPrev=rsi(weeklyCloses.slice(0,-1),14);
  const recentDailyOversold=Number.isFinite(rsiDaily)&&Number.isFinite(rsiDailyPrev)&&Math.min(rsiDaily,rsiDailyPrev)<35;
  const recovering=recentDailyOversold&&rsiDaily>rsiDailyPrev&&rsiDaily>=30;
  const oversold=Number.isFinite(rsiDaily)&&rsiDaily<30;
  const weeklyOversold=Number.isFinite(rsiWeekly)&&rsiWeekly<40;
  const overbought=Number.isFinite(rsiDaily)&&rsiDaily>=70;
  const weeklyOverbought=Number.isFinite(rsiWeekly)&&rsiWeekly>=70;
  const rsiState=overbought&&weeklyOverbought?'SOBRECOMPRA 1D+1W':overbought?'SOBRECOMPRA 1D':weeklyOverbought?'SOBRECOMPRA 1W':recovering?'RECOVERY PRE-WATCH':oversold?'RECOVERY WATCH':weeklyOversold?'RECOVERY 1W WATCH':'NEUTRE';
  const rsiDiagnostic={daily:rsiDaily,weekly:rsiWeekly,dailyPrevious:rsiDailyPrev,weeklyPrevious:rsiWeeklyPrev,state:rsiState,oversold,weeklyOversold,overbought,weeklyOverbought,recovering,warning:overbought||weeklyOverbought?'RSI elevat: risc de correcció, no senyal de venda automàtic':null};
  const momentumIndicators={week:weeklyDiagnostic(dBars,'stock'),day:momentumDiagnostic(dBars,'stock'),four:momentumDiagnostic(h4Bars,'stock'),hour:momentumDiagnostic(h1Bars,'stock')};
 for(const tf of ['week','day','four','hour'])momentumIndicators[tf].phase=momentumPhase(momentumIndicators[tf]);
 momentumIndicators.context=momentumContext(momentumIndicators);
 momentumIndicators.earlyTurn=earlyMomentumTurn(momentumIndicators,'stock');
  if(dBars.length<25 || h4Bars.length<25 || h1Bars.length<25) return {symbol,status:'SENSE DADES',error:`Històric insuficient (1D ${dBars.length} · 4H ${h4Bars.length} · 1H ${h1Bars.length})`};

  const dc=dBars.map(x=>x.c), c4=h4Bars.map(x=>x.c), c1=h1Bars.map(x=>x.c);
  const d=last(dBars), h4=last(h4Bars), h1=last(h1Bars);
  const d20=ema(dc,20), d50=ema(dc,50), h420=ema(c4,20), h450=ema(c4,50), h120=ema(c1,20), h150=ema(c1,50);
  const a4=atr(h4Bars,14)||Math.max(h4.c*0.01,0.01), a1=atr(h1Bars,14)||Math.max(h1.c*0.007,0.01);
  const rsi1=rsi(c1,14), rsi4=rsi(c4,14);
  const vols1=h1Bars.map(x=>x.v||0);
  const avgVol20=vols1.length>=21 ? vols1.slice(-21,-1).reduce((a,b)=>a+b,0)/20 : null;
  const rvol=avgVol20 ? last(vols1)/avgVol20 : null;
  const rs20=returnPct(c1,20);
  const benchBars=latestCompleted(benchH1Raw,'1Hour');
  const benchRet20=returnPct(benchBars.map(x=>x.c),20);
  const rsMarket=(Number.isFinite(rs20)&&Number.isFinite(benchRet20)) ? rs20-benchRet20 : null;
  const pLow=pivotLow(h4Bars,3), pHigh=pivotHigh(h4Bars,3);

  let trend=0;
  if(d.c>d20) trend+=20;
  if(d20>d50) trend+=20;
  if(h4.c>h420) trend+=18;
  if(h420>h450) trend+=18;
  if(h1.c>h150) trend+=12;
  if((rsi4??50)>=50) trend+=6;
  if((rsi1??50)>=50) trend+=6;
  trend=clamp(Math.round(trend),0,100);

  const candidates=[
    {type:'EMA20 4H',v:h420},
    {type:'EMA50 4H',v:h450},
    ...(pLow?[{type:'Swing low 4H',v:pLow}]:[])
  ].filter(x=>Number.isFinite(x.v));
  candidates.sort((a,b)=>Math.abs(h4.c-a.v)-Math.abs(h4.c-b.v));
  const support=candidates[0];
  const volume=volumeReading(h4Bars,support.v,a4);
  const hourlyVolume=hourlySlotRvol(h1Bars);
  let conf=0;
  for(const x of candidates) if(Math.abs(x.v-support.v)<=a4*0.45) conf++;
  const supportDist=Math.abs(h4.c-support.v)/a4;
  const supportSetup = h4.c>h450 && supportDist<=1.15;

  const recentHigh=Math.max(...h1Bars.slice(-8).map(x=>x.h));
  const prevHigh=Math.max(...h1Bars.slice(-9,-1).map(x=>x.h));
  const bullishCandle=h1.c>h1.o;
  const reclaim=h1.l <= support.v + a4*0.35 && h1.c > support.v && bullishCandle;
  const engulf=h1Bars.length>2 && h1.c>h1.o && h1Bars[h1Bars.length-2].c<h1Bars[h1Bars.length-2].o && h1.c>=h1Bars[h1Bars.length-2].o && h1.o<=h1Bars[h1Bars.length-2].c;
  const momentum=(rsi1??50)>52 && h1.c>h120;
  const h1Confirm = reclaim || engulf || (momentum && h1.c>prevHigh*0.995);

  const zoneMid=supportSetup ? support.v : h420;
  const zoneLow=zoneMid-a4*0.30, zoneHigh=zoneMid+a4*0.35;
  let trigger=Math.max(prevHigh, zoneHigh + a1*0.10);
  if(!Number.isFinite(trigger)) trigger=h1.c+a1*0.5;
  const stop=Math.min(zoneLow-a4*0.35, (pLow||zoneLow)-a4*0.25);
  const risk=Math.max(trigger-stop, a1*0.8);
  const target1=trigger+risk*2;
  const target2=trigger+risk*3;
  const rr=2.0;

  let quality=0;
  quality += trend>=80?18:trend>=70?15:trend>=60?11:trend>=50?7:3;
  quality += supportSetup ? (conf>=2?24:20) : (h4.c>h420?10:4);
  quality += h1Confirm ? 28 : momentum ? 17 : h1.c>h150 ? 9 : 2;
  const distToTrigger=pct(trigger,h1.c);
  quality += distToTrigger<=0?12:distToTrigger<=1?10:distToTrigger<=2?7:distToTrigger<=4?3:0;
  if((rsi1??50)>72) quality-=8;
  if(h1.c>h120+a1*2.2) quality-=8;
  if(trend<45) quality-=12;
  quality=clamp(Math.round(quality),0,100);

  const extensionAtr = a1 ? (h1.c - h120) / a1 : 0;
  const zoneDistanceAtr = a4 ? (h4.c - zoneHigh) / a4 : 0;
  const tooExtended = extensionAtr > 2.2 || zoneDistanceAtr > 1.8;

  // Jerarquia v2.3:
  // NO SETUP → WATCH → PRE → READY → A → A+
  // INVALIDAT queda reservat per una ruptura estructural real.
  let status='WATCH', auth='NO';

  const structuralInvalidation =
    (Number.isFinite(stop) && (h1.c < stop || h4.c < stop));

  const noValidPlan =
    !Number.isFinite(stop) || !Number.isFinite(trigger) || stop >= trigger;

  const weakStructure =
    trend < 45 || h4.c < h450;

  if(structuralInvalidation) {
    status='INVALIDAT';
  } else if(noValidPlan) {
    status='NO SETUP';
  } else if(h1.c>=trigger && h1Confirm && quality>=88) {
    status='A+';
    auth='SÍ';
  } else if(h1.c>=trigger && h1Confirm && quality>=74) {
    status='A';
    auth='SÍ';
  } else if(weakStructure) {
    // Una estructura dèbil no és una invalidació:
    // simplement encara no hi ha prou qualitat per activar el setup.
    status = (quality >= 35 && distToTrigger <= 3.0) ? 'WATCH' : 'NO SETUP';
  } else if(quality>=65 && distToTrigger<=2.5) {
    status='READY';
  } else if(quality>=50 && distToTrigger<=4.0) {
    status='PRE';
  } else {
    status='WATCH';
  }

  const statusWeight = {'A+':30,'A':26,'READY':22,'PRE':15,'WATCH':8,'NO SETUP':2,'INVALIDAT':0}[status] ?? 0;
  let radarScore = 0;
  radarScore += statusWeight;
  radarScore += (quality/100)*28;
  radarScore += (trend/100)*18;
  if(Number.isFinite(distToTrigger)){
    radarScore += distToTrigger<=0 ? 12 : distToTrigger<=1 ? 11 : distToTrigger<=2 ? 9 : distToTrigger<=4 ? 5 : 1;
  }
  if(Number.isFinite(rvol)) radarScore += rvol>=1.8 ? 6 : rvol>=1.3 ? 4 : rvol>=1 ? 2 : 0;
  if(Number.isFinite(rsMarket)) radarScore += rsMarket>=3 ? 6 : rsMarket>=1 ? 4 : rsMarket>=0 ? 2 : 0;
  if(tooExtended) radarScore -= 14;
  radarScore = clamp(Math.round(radarScore),0,100);

  // Conservative execution-quality filter. This is NOT a historical win probability.
  const recentResistance=Math.max(...h4Bars.slice(-40,-1).map(b=>b.h));
  const stopDistancePct=trigger>stop?100*(trigger-stop)/trigger:null;
  const rrToResistance=recentResistance>trigger&&trigger>stop?(recentResistance-trigger)/(trigger-stop):null;
  const dollarVolume20=sma(dBars.slice(-20).map(b=>(b.c||0)*(b.v||0)),20);
  const liquidityKnown=Number.isFinite(dollarVolume20)&&dollarVolume20>0;
  const qualityChecks=[
    {name:'Tendència 4H',pass:!weakStructure},
    {name:'Confirmació 1H',pass:h1Confirm},
    {name:'Força relativa',pass:Number.isFinite(rsMarket)&&rsMarket>=0},
    {name:'Volum de suport',pass:Number.isFinite(rvol)&&rvol>=1},
    {name:'Risc stop 1–8%',pass:Number.isFinite(stopDistancePct)&&stopDistancePct>=1&&stopDistancePct<=8},
    {name:'Resistència no immediata',pass:rrToResistance===null||rrToResistance>=1.5},
    {name:'Sense sobreextensió',pass:!tooExtended}
  ];
  const confidenceGrade=qualityChecks.filter(x=>x.pass).length;
  const riskBlocked=tooExtended||!Number.isFinite(stopDistancePct)||stopDistancePct<1||stopDistancePct>8||(rrToResistance!==null&&rrToResistance<1.5);
  if(riskBlocked){
    auth='NO';
    if(['A','A+','READY'].includes(status))status='PRE';
    radarScore=clamp(radarScore-20,0,100); // risk-adjusted ranking may be zero; never a missing-data placeholder
  }
  const estimatedSuccessProbability=null; // No calibrated probability until historical walk-forward validation.
  const thirty=m30.length>=22?m30.at(-1):null;
  const thirtyPrev=m30.length>=22?m30.slice(-9,-1):[];
  const thirtyVolumeAvg=m30.length>=22?sma(m30.slice(-21,-1).map(x=>x.v||0),20):null;
  const thirtyRvol=thirty&&thirtyVolumeAvg>0?thirty.v/thirtyVolumeAvg:null;
  const thirtyResistance=thirtyPrev.length?Math.max(...thirtyPrev.map(x=>x.h)):null;
  const thirtyConfirm=!!(thirty&&thirty.c>thirty.o&&thirty.c>ema(m30.map(x=>x.c),20)&&Number.isFinite(thirtyRvol)&&thirtyRvol>=1.05);
  const volumeSupport4H=Number.isFinite(volume.rvol4h)&&volume.rvol4h>=1.2&&Number.isFinite(support.v)&&Math.abs(h4.l-support.v)<=a4*0.7&&h4.c>support.v&&h4.c>=h4.o;
  const technicalConfidence=confidenceGrade+(thirtyConfirm?1:0)+(volumeSupport4H?1:0);
  // Confirmation 30m refines entry timing but never overrides a higher-timeframe risk block.
  if(!riskBlocked&&thirty&&['READY','PRE'].includes(status)&&thirtyConfirm&&confidenceGrade>=5)radarScore=clamp(radarScore+4,0,100);
  let actionNow='ESPERA';
  if(status==='INVALIDAT') actionNow='INVALIDAT';
  else if(status==='NO SETUP') actionNow='NO SETUP';
  else if(riskBlocked) actionNow='RISC/RESISTÈNCIA · ESPERAR';
  else if((status==='A+'||status==='A') && distToTrigger<=0) actionNow='TRIGGER SUPERAT';
  else if(status==='READY' && distToTrigger<=1.25) actionNow="PROP D'ENTRADA";
  else if((status==='READY'||status==='PRE') && distToTrigger<=2.5) actionNow='VIGILA';
  else if(status==='WATCH' && distToTrigger<=2) actionNow='VIGILA';

  let age=0;
  // Approximate age: consecutive 1H bars that remain in a viable setup.
  for(let i=h1Bars.length-1;i>=Math.max(0,h1Bars.length-20);i--){
    const b=h1Bars[i];
    if(b.c>h150 && b.c>stop){age++;} else break;
  }
  const ageLabel=age<=3?'Nou':age<=6?'Madur':age<=10?'Envellit':'Antic';
  if(age>=11) radarScore=clamp(radarScore-10,0,100);
  else if(age>=7) radarScore=clamp(radarScore-6,0,100);
  else if(age>=4) radarScore=clamp(radarScore-2,0,100);
  // v6.6.18 comparison: only completed context candles; keep historical state web-only.
  // TradingView indicator uses security(1D/4H, close[1] etc.), not live 1D/4H.
  const ctxD=dBars,ctx4=h4Bars; // latestCompleted already removes open intraday bar
  const dRef=ctxD.at(-1),dPrev=ctxD.at(-2),four=ctx4.at(-1);
  const emaPine=(values,n)=>{
    if(values.length<n)return null;
    let v=values.slice(0,n).reduce((a,b)=>a+b,0)/n;
    for(let i=n;i<values.length;i++)v+=2/(n+1)*(values[i]-v);
    return v;
  };
  const rmaPine=(values,n)=>{
    if(values.length<n)return null;
    let v=values.slice(0,n).reduce((a,b)=>a+b,0)/n;
    for(let i=n;i<values.length;i++)v=(v*(n-1)+values[i])/n;
    return v;
  };
  const trueRanges=ctx4.map((b,i)=>i?Math.max(b.h-b.l,Math.abs(b.h-ctx4[i-1].c),Math.abs(b.l-ctx4[i-1].c)):b.h-b.l);
  const pineAtr4=rmaPine(trueRanges,14);
  const pineE20=emaPine(ctx4.map(b=>b.c),20),pineE50=emaPine(ctx4.map(b=>b.c),50);
  const pineD50=emaPine(ctxD.map(b=>b.c),50);
  const pineD50Prev=emaPine(ctxD.slice(0,-1).map(b=>b.c),50);
  const pineTurn=ctxD.length>=20?ctxD.slice(-20).reduce((n,b)=>n+b.c*b.v,0)/20:null;
  const pineResistance=ctxD.length>=60?Math.max(...ctxD.slice(-60).map(b=>b.h)):null;
  const pineBase=ctx4.slice(-8),wide=ctx4.slice(-24);
  const pineBaseHigh=pineBase.length===8?Math.max(...pineBase.map(b=>b.h)):null;
  const pineBaseLow=pineBase.length===8?Math.min(...pineBase.map(b=>b.l)):null;
  const pineWideRange=wide.length===24?Math.max(...wide.map(b=>b.h))-Math.min(...wide.map(b=>b.l)):null;
  const pineBaseOK=Number.isFinite(pineBaseHigh)&&Number.isFinite(pineAtr4)&&pineAtr4>0&&pineBaseHigh-pineBaseLow<=4*pineAtr4&&pineBaseHigh-pineBaseLow<=pineWideRange*.75;
  const pineDailyOK=Number.isFinite(pineD50Prev)&&dRef.c>pineD50&&pineD50>=pineD50Prev;
  const pineTrendOK=Number.isFinite(pineE50)&&four.c>pineE50&&pineE20>pineE50;
  const pineExtensionOK=Number.isFinite(pineAtr4)&&h1.c<=pineE20+2*pineAtr4;
  const pineLiquidityOK=Number.isFinite(pineTurn)&&pineTurn>=1e6;
  const pineTick=h1.c>=1?.01:.0001; // approximate tick; broker-specific increments need reference data
  const pineBreakEntry=Number.isFinite(pineBaseHigh)?pineBaseHigh+pineTick:null;
  const pineLow6=ctx4.length>=6?Math.min(...ctx4.slice(-6).map(b=>b.l)):null;
  const pineBreakStop=Number.isFinite(pineLow6)&&Number.isFinite(pineAtr4)?pineLow6-.2*pineAtr4:null;
  const pinePullEntry=Math.max(h1Bars.at(-2).h+pineTick,pineE20||0);
  const pineRecentLow=Math.min(...h1Bars.slice(-3).map(b=>b.l));
  const pinePullStop=Number.isFinite(pineAtr4)?pineRecentLow-.2*pineAtr4:null;
  const pinePullLocation=Number.isFinite(pineAtr4)&&pineRecentLow<=pineE20+.25*pineAtr4&&pineRecentLow>=pineE50-.5*pineAtr4;
  const pinePlan=(entry,sl)=>{
    const risk=entry-sl,cost=entry*.004;
    const target=Number.isFinite(pineResistance)&&Number.isFinite(risk)&&risk>0?Math.min(entry+2.5*risk,pineResistance>entry+pineTick?pineResistance:entry+2.5*risk):null;
    const netRR=Number.isFinite(target)&&risk>0?(target-entry-cost)/(risk+cost):null;
    return {entry,stop:sl,target,netRR,valid:Number.isFinite(entry)&&Number.isFinite(sl)&&risk>pineTick&&sl>0&&risk/entry<=.10&&netRR>=2};
  };
  const pineB=pinePlan(pineBreakEntry,pineBreakStop),pineP=pinePlan(pinePullEntry,pinePullStop);
  const pineContextOK=pineDailyOK&&pineTrendOK&&pineExtensionOK&&pineLiquidityOK;
  const pineBreakReady=pineContextOK&&pineBaseOK&&pineB.valid;
  const pinePullReady=pineContextOK&&pinePullLocation&&pineP.valid;
  const pineBreakEvent=Number.isFinite(pineBreakEntry)&&h1.c>pineBreakEntry&&h1Bars.at(-2).c<=pineBreakEntry&&h1.c>h1.o&&Number.isFinite(rvol)&&rvol>=1.1;
  const pinePullEvent=h1.c>pinePullEntry&&h1.c>h1.o&&Number.isFinite(rvol)&&rvol>=.8;
  const pineConfirmedRoute=pineBreakReady&&pineBreakEvent?'RUPTURA':pinePullReady&&pinePullEvent?'RETROCES':null;
  const pineReferenceRoute=pineConfirmedRoute||(pineBreakReady?'RUPTURA':pinePullReady?'RETROCES':null);
  const pineReferenceState=pineConfirmedRoute?'CANDIDAT CONFIRMAT':pineReferenceRoute?'PLA PREPARAT':'SENSE PLA VALID';
  const pineReferencePlan=pineReferenceRoute==='RUPTURA'?pineB:pineReferenceRoute==='RETROCES'?pineP:null;
  const pineEntryConfirmed=!!pineConfirmedRoute;
  const pinePlanValid=!!pineReferencePlan?.valid;
  const pineBlockedReason=!pinePlanValid?'Cap pla executable amb R:R net mínim 2':!pineEntryConfirmed?'Falta confirmació de ruptura/retrocés i volum 1H':null;
  // Do not infer TV CONFIRMED from an independent, delayed consolidated feed.
  const pineParity='APROXIMACIÓ · ESPELMES I SESSIÓ NO VERIFICADES';
  const pineChecks=[
    {name:'Tendència diària 1D',pass:pineDailyOK},
    {name:'Tendència i base 4H',pass:pineTrendOK&&(pineBaseOK||pinePullLocation)},
    {name:'Confirmació 1H',pass:pineEntryConfirmed},
    {name:'Volum 1H',pass:Number.isFinite(rvol)&&rvol>=(pineConfirmedRoute==='RETROCES'?.8:1.1)},
    {name:'Benefici/risc net >=2',pass:pinePlanValid}
  ];
  // REVIEW status requires verified plan and confirmation. All web-only grades remain provisional.
  if(['A+','A','READY'].includes(status)){
    if(!pinePlanValid){
      status='WATCH';auth='NO';actionNow='SENSE PLA EXECUTABLE · VIGILAR';radarScore=clamp(radarScore-24,0,100);
    }else if(!pineEntryConfirmed&&['A+','A'].includes(status)){
      status='PRE';auth='NO';actionNow='FALTA CONFIRMACIÓ 1H · ESPERAR';radarScore=clamp(radarScore-16,0,100);
    }
  }
  // Early-watch only: volatility contraction and near-breakout location.
  // No execution authorization or guarantee of future price movement.
  const window4=h4Bars.slice(-24),recent4=h4Bars.slice(-6);
  const rangePct=b=>b.length&&last(b).c>0?(Math.max(...b.map(x=>x.h))-Math.min(...b.map(x=>x.l)))/last(b).c*100:null;
  const recentRange=rangePct(recent4),baselineRange=rangePct(window4);
  const compressionRatio=Number.isFinite(recentRange)&&Number.isFinite(baselineRange)&&baselineRange>0?recentRange/baselineRange:null;
  const compression=Number.isFinite(compressionRatio)&&compressionRatio<0.48;
  const preBreakoutLevel=Math.max(...h4Bars.slice(-13,-1).map(b=>b.h));
  const preBreakoutDistance=preBreakoutLevel>0?(preBreakoutLevel/h4.c-1)*100:null;
  const nearBreakout=Number.isFinite(preBreakoutDistance)&&preBreakoutDistance>=0&&preBreakoutDistance<=3;
  const priorVol=h4Bars.slice(-21,-6).map(b=>b.v||0);
  const lastVol=recent4.map(b=>b.v||0);
  const avgPrior=priorVol.length?priorVol.reduce((a,b)=>a+b,0)/priorVol.length:0;
  const avgRecent=lastVol.length?lastVol.reduce((a,b)=>a+b,0)/lastVol.length:0;
  const volumeBuild=avgPrior>0?avgRecent/avgPrior:null;
  const positiveVolume=Number.isFinite(volumeBuild)&&volumeBuild>=1.15;
  // Gradual anticipation diagnostic: avoid artificial zero clusters from four binary thresholds.
  // This affects discovery ranking only, never READY / authorization.
  const trendPoints=Number.isFinite(trend)?25*clamp(trend/100,0,1):0;
  const compressionPoints=Number.isFinite(compressionRatio)?30*clamp((1.2-compressionRatio)/1.2,0,1):0;
  const breakoutPoints=Number.isFinite(preBreakoutDistance)&&preBreakoutDistance>=0?25*clamp(1-preBreakoutDistance/8,0,1):0;
  const volumePoints=Number.isFinite(volumeBuild)?20*clamp((volumeBuild-0.6)/1,0,1):0;
  const earlyScore=Math.round(trendPoints+compressionPoints+breakoutPoints+volumePoints);
  const earlyState=trend<45?'SENSE TENDÈNCIA':compression&&nearBreakout&&positiveVolume?'PRE-RUPTURA':compression&&nearBreakout?'COMPRESSIÓ PROP RUPTURA':compression?'COMPRESSIÓ':nearBreakout?'VIGILAR RESISTÈNCIA':'SENSE PATRÓ';
  // Decision-grade diagnostic: a setup score alone is not an entry authorization.
  const incompleteChecks=pineChecks.filter(c=>!c.pass).map(c=>c.name);
  const barTimestamp=Date.parse(h1.t);
  const h1AgeHours=Number.isFinite(barTimestamp)?Math.max(0,(Date.now()-barTimestamp)/3600000):null;
  const vol1hReliable=Number.isFinite(rvol)&&rvol>=0.05&&rvol<=30;
  const fourHourVolumeReliable=Number.isFinite(volume.rvol4h)&&volume.rvol4h>=0.05&&volume.rvol4h<=30;
  const outlier1h=Number.isFinite(rvol)&&rvol>30;
  const entryCautions=[
   ...(!vol1hReliable?['Volum 1H no fiable']:[]),
   ...(!fourHourVolumeReliable?['Volum 4H no fiable']:[]),
   ...(outlier1h?['Volum 1H extrem, revisar feed']:[]),
   ...(reconstructed4H?['4H reconstruït, comparar amb TradingView']:[])
  ];
  const entryDataReliable=vol1hReliable&&fourHourVolumeReliable&&!outlier1h;
  const dayChange=pct(d.c, dBars[dBars.length-2].c);

  return {
    symbol,momentum:momentumIndicators,
    pineEntryConfirmed,pinePlanValid,pineBlockedReason,pineParity,pineChecks,entryCautions,entryDataReliable,incompleteChecks,h1AgeHours,
    pineReferenceVersion:'6.6.18',pineReferenceState,pineReferenceRoute,pineReferenceEntry:pineReferencePlan?.entry??null,pineReferenceStop:pineReferencePlan?.stop??null,pineReferenceTarget:pineReferencePlan?.target??null,pineReferenceNetRR:pineReferencePlan?.netRR??null,
    rsiDiagnostic,earlyScore,earlyState,compressionRatio,preBreakoutLevel,preBreakoutDistance,volumeBuild,
    fourHourSource:reconstructed4H?'1H agregades (aproximació)':'4H Alpaca',
    hourlySlotRvol:hourlyVolume.ratio,hourlySlotSamples:hourlyVolume.samples,hourlySlotSource:hourlyVolume.source,hourlySlotNY:hourlyVolume.nyHour||null,
    technicalPrice:h1.c,
    price:h1.c,
    dayChange,
    trendScore:trend,
    entryQuality:quality,
    status,
    authorization:auth,
    structureState: structuralInvalidation ? 'Trencada' : (weakStructure ? 'Feble / recuperar' : 'Vàlida'),
    supportType:support.type,
    support:support.v,
    supportStrength:conf>=3?'Fort':conf===2?'Moderat':'Feble',
    zoneLow,zoneHigh,trigger,distToTrigger,
    stop,stopPct:Math.abs(pct(stop,trigger)),
    rr,target1,target2,
    ageHours:age,ageLabel,
    rsi1h:rsi1,rsi4h:rsi4,
    thirtyConfirm,thirtyRvol,thirtyResistance,volumeSupport4H,technicalConfidence,thirtyCoverage:m30.length,rvol,rsMarket,radarScore,actionNow,tooExtended,extensionAtr,confidenceGrade,confidenceChecks:qualityChecks,estimatedSuccessProbability,riskBlocked,rrToResistance,stopDistancePct,dollarVolume20,liquidityKnown,...volume,
    benchmark:BENCHMARK[symbol]||'QQQ',
    priceBasis:'SPLIT_ADJUSTED',technicalBarTime:h1.t,dailyBarTime:d.t,dailyClose:d.c,technicalFeed:'ALPACA_'+(reconstructed4H?'1H_DERIVED':'4H_NATIVE'),
    updatedAt:h1.t
  };
}

export { compute, volumeReading };

export default async function handler(req,res){
  try{
    if(!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET){
      return res.status(500).json({error:'Falten ALPACA_API_KEY / ALPACA_API_SECRET a Vercel'});
    }
    const raw=(req.query.symbols||'').toUpperCase().split(',').map(s=>s.trim()).filter(Boolean).slice(0,60);
    if(!raw.length) return res.status(400).json({error:'Cal indicar ?symbols=PLTR,CRM,...'});
    const feedInfo=await chooseHistoricalFeed();
    const startDay=addDays(new Date(),-450); // ~64 closed weeks; weekly EMA50 research context
    const startIntraday=addDays(new Date(),-60);
    const benchSymbols=[...new Set(raw.map(s=>BENCHMARK[s]||'QQQ'))];

    // v2.6.1: benchmarks per separat.
    // Alpaca aplica el límit al conjunt de símbols i, amb ETFs, podia
    // truncar la resposta i deixar RS buit. Els demanem individualment.
    const [d,h4,h1] = await Promise.all([
      fetchBars(raw,'1Day',startDay,10000,feedInfo.feed,feedInfo.cutoff),
      fetchBars(raw,'4Hour',startIntraday,10000,feedInfo.feed,feedInfo.cutoff),
      fetchBars(raw,'1Hour',startIntraday,10000,feedInfo.feed,feedInfo.cutoff)
    ]);

    const bh1 = {};
    for(const b of benchSymbols){
      try {
        const one = await fetchBars([b],'1Hour',startIntraday,10000,feedInfo.feed,feedInfo.cutoff);
        bh1[b] = one[b] || [];
      } catch (_) {
        bh1[b] = [];
      }
    }

    // Fallback: si el benchmark específic té poca cobertura IEX
    // (p. ex. algun ETF sectorial), fem servir QQQ.
    if ((bh1.QQQ?.length || 0) < 21) {
      try {
        const q = await fetchBars(['QQQ'],'1Hour',startIntraday,10000,feedInfo.feed,feedInfo.cutoff);
        bh1.QQQ = q.QQQ || [];
      } catch (_) {}
    }
    // Retry only genuinely missing symbols, in bounded parallel batches.
    // Previous version performed up to 210 sequential API calls for 70 stocks.
    const retryTasks=[];
    for(const sym of raw){
      for(const [tf,start,collection] of [['1Day',startDay,d],['4Hour',startIntraday,h4],['1Hour',startIntraday,h1]]){
        if((collection[sym]?.length||0)<25)retryTasks.push({sym,tf,start,collection});
      }
    }
    const retryErrors=[];
    for(let i=0;i<Math.min(retryTasks.length,12);i+=2){
      await Promise.all(retryTasks.slice(i,i+2).map(async t=>{
        try{
          const result=await fetchBars([t.sym],t.tf,addDays(new Date(),t.tf==='1Day'?-240:-160),10000,feedInfo.feed,feedInfo.cutoff);
          if((result[t.sym]?.length||0)>(t.collection[t.sym]?.length||0))t.collection[t.sym]=result[t.sym];
        }catch(e){retryErrors.push(t.sym+' '+t.tf+': '+String(e.message||e).slice(0,80))}
      }));
    }
    if(retryTasks.length>12)retryErrors.push((retryTasks.length-12)+' intents addicionals ajornats per limitar peticions');
    // Limit extra provider requests: 30m confirmation only for leading 20 candidates.
    const top30=raw.map(symbol=>({symbol,pre:compute(symbol,d[symbol]||[],h4[symbol]||[],h1[symbol]||[],bh1[BENCHMARK[symbol]||'QQQ']||bh1.QQQ||[])})).filter(x=>Number.isFinite(x.pre.radarScore)).sort((a,b)=>b.pre.radarScore-a.pre.radarScore).slice(0,20).map(x=>x.symbol);
    let m30={};
    try{m30=await fetchBars(top30,'30Min',addDays(new Date(),-14),5000,feedInfo.feed,feedInfo.cutoff)}catch(_){m30={}}
    const out=raw.map(s=>{
      const preferred = BENCHMARK[s] || 'QQQ';
      const benchBars = (bh1[preferred]?.length || 0) >= 21 ? bh1[preferred] : (bh1.QQQ || []);
      const r=compute(s,d[s]||[],h4[s]||[],h1[s]||[],benchBars,m30[s]||[]);
      r.dataCounts={d:(d[s]||[]).length,h4:(h4[s]||[]).length,h1:(h1[s]||[]).length};
      r.historicalFeed=feedInfo.feed;
      r.dataCompleteness=[r.dataCounts.d,r.dataCounts.h4,r.dataCounts.h1].every(n=>n>=25)?'COBERTURA BÀSICA':'COBERTURA PARCIAL';
      if(r.status==='SENSE DADES'){
        const counts={d:(d[s]||[]).length,h4:(h4[s]||[]).length,h1:(h1[s]||[]).length};
        r.dataCounts=counts;
        r.dataState='Històric insuficient: 1D '+counts.d+' · 4H '+counts.h4+' · 1H '+counts.h1+' (mínim 25; si 4H manca, prova reconstrucció 1H)';

      }
      return r;
    });
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({generatedAt:new Date().toISOString(),engine:'Trading 2026 v3.5 · SIP retardat amb alternativa IEX',coverage:{historicalFeed:feedInfo.feed,sipAvailable:feedInfo.feed==='sip',feedReason:feedInfo.reason||null,requested:raw.length,analyzed:out.filter(x=>x.status!=='SENSE DADES').length,missing:out.filter(x=>x.status==='SENSE DADES').length,retryRequests:retryTasks.length,retryErrors:retryErrors.slice(0,12)},results:out});
  }catch(e){
    return res.status(500).json({error:e.message||String(e)});
  }
}
