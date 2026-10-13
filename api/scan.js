
const ALPACA = 'https://data.alpaca.markets/v2/stocks/bars';
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
function volumeReading(bars, support, atr4){
  // Compare completed 4H bars with previous completed 4H bars on the same feed.
  // IEX is a partial-market feed; this is relative participation, not total volume.
  if(bars.length<22) return {volumeScore:null,volumeLabel:'Sense dades suficients',volumeReason:'Calen 22 espelmes 4H completes',rvol4h:null};
  const current=last(bars), avg=sma(bars.slice(-21,-1).map(b=>b.v||0),20);
  if(!avg || !Number.isFinite(current.v)) return {volumeScore:null,volumeLabel:'Sense volum fiable',volumeReason:'El feed no ofereix volum suficient',rvol4h:null};
  const ratio=current.v/avg;
  const near=Number.isFinite(support) && Number.isFinite(atr4) && Math.abs(current.l-support)<=atr4*0.65;
  const up=current.c>current.o, down=current.c<current.o;
  const bounce=near && up && current.c>support && ratio>=1.25;
  const selling=down && ratio>=1.5;
  const quietPullback=down && ratio<0.75;
  const score=clamp(Math.round(50+(bounce?25:0)+(quietPullback?10:0)+(up&&ratio>=1.5?15:0)-(selling?30:0)-(ratio<0.5&&up?10:0)),0,100);
  const reason=bounce?'Rebot prop del suport amb més volum':selling?'Baixada amb volum alt':quietPullback?'Retrocés amb menys volum':up&&ratio>=1.5?'Pujada amb volum alt':'Volum sense senyal clar';
  return {volumeScore:score,volumeLabel:score>=70?'Favorable':score<=35?'Desfavorable':'Mixt',volumeReason:reason,rvol4h:Math.round(ratio*100)/100};
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
  if(tf === '1Day') return bars;
  const now=Date.now();
  const mins=tf==='30Min'?30:tf==='1Hour'?60:tf==='4Hour'?240:60;
  const t=new Date(last(bars).t).getTime();
  if(now - t < mins*60*1000*0.9 && bars.length>1) return bars.slice(0,-1);
  return bars;
}
async function fetchBars(symbols, timeframe, start, limit=10000){
  // Alpaca aplica el límit al conjunt de símbols, no a cada ticker.
  // Amb 50 actius i 1H, una sola petició pot truncar la resposta.
  // Per això dividim el radar en lots petits i fusionem els resultats.
  const merged = {};
  const CHUNK = 7;

  for (let i = 0; i < symbols.length; i += CHUNK) {
    const batch = symbols.slice(i, i + CHUNK);
    const params = new URLSearchParams({
      symbols: batch.join(','),
      timeframe,
      start,
      limit: String(limit),
      adjustment: 'raw',
      feed: 'iex',
      sort: 'asc'
    });

    const r = await fetch(`${ALPACA}?${params}`, {
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
        'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || ''
      }
    });

    const body = await r.text();
    if (!r.ok) throw new Error(`Alpaca ${r.status}: ${body.slice(0,300)}`);
    const j = JSON.parse(body);

    for (const [sym, bars] of Object.entries(j.bars || {})) {
      merged[sym] = (merged[sym] || []).concat(bars || []);
    }
  }

  return merged;
}
function addDays(d,n){ const x=new Date(d); x.setUTCDate(x.getUTCDate()+n); return x.toISOString(); }

function compute(symbol, dBarsRaw, h4BarsRaw, h1BarsRaw, benchH1Raw=[], m30Raw=[]){
  const dBars=latestCompleted(dBarsRaw,'1Day');
  const h4Bars=latestCompleted(h4BarsRaw,'4Hour');
  const h1Bars=latestCompleted(h1BarsRaw,'1Hour');
  const m30=latestCompleted(m30Raw,'30Min');
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
    radarScore=clamp(radarScore-20,0,100);
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
  const dayChange=pct(d.c, dBars[dBars.length-2].c);

  return {
    symbol,
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
    const startDay=addDays(new Date(),-130);
    const startIntraday=addDays(new Date(),-60);
    const benchSymbols=[...new Set(raw.map(s=>BENCHMARK[s]||'QQQ'))];

    // v2.6.1: benchmarks per separat.
    // Alpaca aplica el límit al conjunt de símbols i, amb ETFs, podia
    // truncar la resposta i deixar RS buit. Els demanem individualment.
    const [d,h4,h1] = await Promise.all([
      fetchBars(raw,'1Day',startDay,10000),
      fetchBars(raw,'4Hour',startIntraday,10000),
      fetchBars(raw,'1Hour',startIntraday,10000)
    ]);

    const bh1 = {};
    await Promise.all(benchSymbols.map(async (b) => {
      try {
        const one = await fetchBars([b],'1Hour',startIntraday,10000);
        bh1[b] = one[b] || [];
      } catch (_) {
        bh1[b] = [];
      }
    }));

    // Fallback: si el benchmark específic té poca cobertura IEX
    // (p. ex. algun ETF sectorial), fem servir QQQ.
    if ((bh1.QQQ?.length || 0) < 21) {
      try {
        const q = await fetchBars(['QQQ'],'1Hour',startIntraday,10000);
        bh1.QQQ = q.QQQ || [];
      } catch (_) {}
    }
    // Fallback v2.2: Alpaca/IEX de vegades omet un símbol dins d'una petició múltiple.
    // Si un actiu arriba amb historial insuficient, el repetim individualment abans de marcar-lo SENSE DADES.
    async function retryMissing(symbol, tf, start, current, minBars){
      if((current?.length||0) >= minBars) return current || [];
      try{
        const one = await fetchBars([symbol], tf, start, 10000);
        return one[symbol] || current || [];
      }catch(err){
        return current || [];
      }
    }

    for(const s of raw){
      d[s]  = await retryMissing(s,'1Day', startDay,      d[s],  25);
      h4[s] = await retryMissing(s,'4Hour',startIntraday,h4[s], 25);
      h1[s] = await retryMissing(s,'1Hour',startIntraday,h1[s], 25);
    }

    // Limit extra provider requests: 30m confirmation only for leading 20 candidates.
    const top30=raw.map(symbol=>({symbol,pre:compute(symbol,d[symbol]||[],h4[symbol]||[],h1[symbol]||[],bh1[BENCHMARK[symbol]||'QQQ']||bh1.QQQ||[])})).filter(x=>Number.isFinite(x.pre.radarScore)).sort((a,b)=>b.pre.radarScore-a.pre.radarScore).slice(0,20).map(x=>x.symbol);
    let m30={};
    try{m30=await fetchBars(top30,'30Min',addDays(new Date(),-14),5000)}catch(_){m30={}}
    const out=raw.map(s=>{
      const preferred = BENCHMARK[s] || 'QQQ';
      const benchBars = (bh1[preferred]?.length || 0) >= 21 ? bh1[preferred] : (bh1.QQQ || []);
      const r=compute(s,d[s]||[],h4[s]||[],h1[s]||[],benchBars,m30[s]||[]);
      if(r.status==='SENSE DADES'){
        const counts={d:(d[s]||[]).length,h4:(h4[s]||[]).length,h1:(h1[s]||[]).length};
        r.dataCounts=counts;
        r.dataState = counts.d>=25 && (counts.h4<25 || counts.h1<25)
          ? 'DADES 1D OK · intradia IEX insuficient'
          : 'HISTÒRIC INSUFICIENT';
      }
      return r;
    });
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({generatedAt:new Date().toISOString(),engine:'Trading 2026 v3.3 · 30m + suport-volum',results:out});
  }catch(e){
    return res.status(500).json({error:e.message||String(e)});
  }
}
