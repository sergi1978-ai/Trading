// Crypto details add-on. Loads after the main radar and does not change trade authorization.
(() => {
  const safeText = value => String(value ?? 'Sense dades');
  const fmtValue = (v, decimals=2) => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('ca-ES',{maximumFractionDigits:decimals}) : 'Sense dades';
  const style = document.createElement('style');
  style.textContent = '.crypto-info{font:inherit;color:#b9dcff;background:transparent;border:0;text-decoration:underline;cursor:pointer;font-weight:800;padding:5px}.coin-overlay[hidden]{display:none}.coin-overlay{position:fixed;inset:0;z-index:1000;background:#030914d8;display:grid;place-items:center;padding:15px}.coin-panel{width:min(560px,100%);max-height:90vh;overflow:auto;background:#14243d;border:1px solid #486080;border-radius:16px;padding:20px;color:#eef5ff}.coin-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.coin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.coin-tile{padding:12px;background:#21334e;border-radius:10px;overflow-wrap:anywhere}.coin-tile small{display:block;font-size:11px;color:#bdd0e5;margin-bottom:5px}.coin-note{color:#b6cbe2;font-size:12px;line-height:1.5}.coin-tile.positive{background:#153a33;border:1px solid #27745c}.coin-tile.positive strong{color:#8af3c2}.coin-tile.negative{background:#432631;border:1px solid #98505f}.coin-tile.negative strong{color:#ffb5c1}.coin-tile.neutral{background:#21334e;border:1px solid #354a68}.coin-summary{padding:13px;border-radius:12px;background:#1c3048;border:1px solid #3c5978;margin-top:16px}.coin-summary strong{display:block;margin-bottom:7px}.coin-summary p{margin:5px 0;font-size:12px;line-height:1.4}.coin-summary .up{color:#8af3c2}.coin-summary .down{color:#ffb5c1}.coin-summary .flat{color:#c7d5e8}';
  style.textContent += '.coin-overview{display:grid;gap:12px;margin-top:14px}.coin-headline,.coin-brief-reasons{padding:13px;background:#20354e;border-radius:12px;border:1px solid #41617e}.coin-headline p,.coin-brief-reasons p{font-size:13px;line-height:1.4;color:#c7d7e9;margin:7px 0 0}.coin-brief-tf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.coin-brief-chip{padding:10px;border-radius:9px;font-size:12px;background:#23354c}.coin-brief-chip.positive{color:#9bf0bf}.coin-brief-chip.negative{color:#ffc0c9}.coin-all-details{margin-top:15px;border:1px solid #486080;border-radius:12px;padding:12px}.coin-all-details summary{font-weight:700;cursor:pointer}.coin-all-details .coin-grid{margin-bottom:10px}';document.head.append(style);
  const overlay=document.createElement('div');
  overlay.id='cryptoDetailModal';overlay.className='coin-overlay';overlay.hidden=true;
  overlay.innerHTML='<section class="coin-panel" role="dialog" aria-modal="true" aria-labelledby="coinHeading"><div class="coin-head"><h2 id="coinHeading">Anàlisi avançada</h2><button type="button" class="btn" id="coinDismiss">✕ Tancar</button></div><div id="coinMetrics"></div></section>';
  document.body.append(overlay);
  const close=()=>{overlay.hidden=true;};
  document.getElementById('coinDismiss').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});
  function openCoin(sym) {
    const a=typeof cryptoSignals!=='undefined' ? cryptoSignals[sym] : null;
    if(!a)return;
    document.getElementById('coinHeading').textContent=sym+' · Anàlisi web avançada';
    const metric=(label,value,tone='neutral')=>{
      const el=document.createElement('div');el.className='coin-tile '+tone;
      const k=document.createElement('small');k.textContent=label;
      const v=document.createElement('strong');v.textContent=safeText(value);
      el.append(k,v);return el;
    };
    const grid=document.createElement('div');grid.className='coin-grid';
    const st=a.historicalAccumulation||{};
    const vwapTone=a.priceAboveVwap===true?'positive':a.priceAboveVwap===false?'negative':'neutral';
    const relativeTone=Number.isFinite(a.relativeStrengthBTC)?a.relativeStrengthBTC>1?'positive':a.relativeStrengthBTC< -1?'negative':'neutral':'neutral';
    const volumeTone=Number.isFinite(a.rvol)&&Number.isFinite(a.rvol4h)?a.rvol>=1.3&&a.rvol4h>=1.15&&a.volumeCandleDirection==='ALCISTA'?'positive':a.volumeCandleDirection==='BAIXISTA'&&a.rvol>=1.3?'negative':'neutral':'neutral';
    const signalValue=a.pineState||a.status||'Sense dades';
    const noPlan=!a.planAvailable;
    const vals=[
      ['Preu 1H',fmtValue(a.price,5)+' $','neutral'],
      ['RVOL 1H / 4H',fmtValue(a.rvol)+'× / '+fmtValue(a.rvol4h)+'×',volumeTone],
      ['VWAP mòbil 24H',fmtValue(a.vwap24h,5)+' $','neutral'],
      ['Preu vs VWAP',a.priceAboveVwap===true?'Per sobre':a.priceAboveVwap===false?'Per sota':'Sense dades',vwapTone],
      ['Força vs BTC 24H',Number.isFinite(a.relativeStrengthBTC)?fmtValue(a.relativeStrengthBTC)+' punts percentuals':'Sense dades',relativeTone],
      ['Liquiditat',a.liquidityTier||'Sense dades',a.liquidityTier==='PETITA'?'negative':'neutral'],
      ['Volum diari mitjà',Number.isFinite(a.dollarVolumeDay)?fmtValue(a.dollarVolumeDay,0)+' $':'Sense dades','neutral'],
      ['OBV / acumulació',a.accumulationWatch?'Indicis · vigilar':'No detectada',a.accumulationWatch?'positive':'neutral'],
      ['Volum sostingut',a.strongVolumeWatch?'Detectat':'No detectat',a.strongVolumeWatch?'positive':'neutral'],
      ['Senyal',signalValue,signalValue.includes('NO PERSEGUIR')?'negative':'neutral'],
      ['Proveïdors',a.providerConsistency||'Sense dades',a.providerConsistency==='MIXTA'?'neutral':'neutral'],
      ['Pla executable',a.planAvailable?'Validar al Pine':'Sense pla',noPlan?'negative':'neutral'],
      ['Tendència 1W',a.momentum?.week?.available?a.momentum.week.weeklyTrend:'Històric insuficient',a.momentum?.week?.weeklyTrend==='ALCISTA'?'positive':a.momentum?.week?.weeklyTrend==='BAIXISTA'?'negative':'neutral'],
      ['EMA 200 · 1D',a.momentum?.day?.ema200Available?fmtValue(a.momentum.day.ema200,5):'Històric insuficient',a.momentum?.day?.emaAligned?'positive':'neutral'],
      ['Creuament EMA 20/50 · 4H',a.momentum?.four?.emaCross5||'Sense dades',a.momentum?.four?.emaCross5==='ALCISTA'?'positive':a.momentum?.four?.emaCross5==='BAIXISTA'?'negative':'neutral'],
      ['MACD · 1H',!a.momentum?.hour?.available?'Sense dades':(a.momentum.hour.macdHistogram>=0?'Positiu':'Negatiu')+' · '+(a.momentum.hour.macdCross==='CAP RECENT'?'Sense creuament recent':a.momentum.hour.macdCross)+' · Hist. '+fmtValue(a.momentum.hour.macdHistogram,4),a.momentum?.hour?.macdTone||'neutral'],
      ['RSI · 1H',Number.isFinite(a.momentum?.hour?.rsi14)?fmtValue(a.momentum.hour.rsi14,1):'Sense dades',a.momentum?.hour?.rsiTone||'neutral']
    ];
    for(const [tf,label] of [['week','1W'],['day','1D'],['four','4H'],['hour','1H']]){
      const m=a.momentum?.[tf],v=m?.macdHistogram,ok=m?.available&&Number.isFinite(v);
      grid.append(metric('MACD '+label,ok?(v>=0?'+':'')+fmtValue(v,4)+' · '+(m.macdCross==='CAP RECENT'?'Sense creuament':m.macdCross):'Sense dades',!ok?'neutral':v>=0?'positive':'negative'));
    }
    const crossMarket=a.momentum?.week?.weeklyTrend==='ALCISTA'&&a.momentum?.day?.macdHistogram<0&&a.momentum?.four?.macdHistogram<0;
    if(crossMarket)grid.append(metric('Divergència temporal','1W alcista · 1D i 4H amb momentum negatiu','negative'));
    for(const [tf,label] of [['day','1D'],['four','4H'],['hour','1H']]){
      const phase=a.momentum?.[tf]?.phase||'SENSE DADES';
      grid.append(metric('Fase '+label,phase,phase==='IMPULS ALCISTA'?'positive':phase==='DEBILITAT BAIXISTA'?'negative':'neutral'));
    }
    grid.append(metric('Gir incipient',a.momentum?.earlyTurn?'VIGILAR · NO READY':'No detectat',a.momentum?.earlyTurn?'positive':'neutral'));
    grid.append(metric('Context temporal',a.momentum?.context||'Sense dades',a.momentum?.context==='SENSE CONFLICTE CLAR'?'neutral':'negative'));
    for(const [k,v,tone] of vals)grid.append(metric(k,v,tone));
    const content=document.getElementById('coinMetrics');content.replaceChildren();
    const summary=document.createElement('div');summary.className='coin-summary';
    const heading=document.createElement('strong');heading.textContent=noPlan?'DIAGNÒSTIC · Sense entrada confirmada':'DIAGNÒSTIC · Revisar pla al Pine';
    summary.append(heading);
    const comparison=document.createElement('p');
    comparison.className='coin-comparison-note';
    const webScore=Number.isFinite(a.setupQuality)?a.setupQuality:Number.isFinite(a.score)?a.score:null;
    comparison.textContent='Entrada web: '+(webScore===null?'sense dades':Math.round(webScore)+'/100')+
      ' · Pine: score no disponible en aquesta aplicació. Motors independents: els valors no són equivalents.';
    summary.append(comparison);
    if(Number.isFinite(a.pineReferenceEntry)&&Number.isFinite(a.pineReferenceStop)){
      const planNote=document.createElement('p');
      planNote.textContent='Pla web de referència: entrada '+fmtValue(a.pineReferenceEntry,5)+' $ · stop '+fmtValue(a.pineReferenceStop,5)+' $ · R:R '+fmtValue(a.pineReferenceNetRR,2)+'. Validar a TradingView amb mateixa espelma i exchange.';
      summary.append(planNote);
    }
    const findings=[
      [a.priceAboveVwap===true?'up':a.priceAboveVwap===false?'down':'flat',a.priceAboveVwap===true?'Preu per sobre del VWAP.':a.priceAboveVwap===false?'Preu per sota del VWAP.':'VWAP no concloent.'],
      [relativeTone==='positive'?'up':relativeTone==='negative'?'down':'flat',Number.isFinite(a.relativeStrengthBTC)?'Força relativa vs BTC: '+fmtValue(a.relativeStrengthBTC)+' punts.':'Força relativa no disponible.'],
      [volumeTone==='positive'?'up':volumeTone==='negative'?'down':'flat',volumeTone==='positive'?'Volum 1H i 4H favorable.':volumeTone==='negative'?'Pressió baixista amb volum significatiu.':'Volum sense confirmació clara.'],
      [noPlan?'down':'flat',noPlan?'Cap pla executable.':'Pla orientatiu: comprovar al Pine.']
    ];
    for(const [tone,line] of findings){const p=document.createElement('p');p.className=tone;p.textContent=(tone==='up'?'▲ ':tone==='down'?'▼ ':'● ')+line;summary.append(p);}
    const overview=document.createElement('div');overview.className='coin-overview';
    const phase=a.momentum?.four?.phase||'SENSE DADES';
    const context=a.momentum?.context||'Sense context confirmat';
    const headline=document.createElement('div');headline.className='coin-headline';
    const title=document.createElement('strong');title.textContent=phase==='DEBILITAT BAIXISTA'?'Debilitat de tendència':phase==='IMPULS ALCISTA'?'Momentum favorable':phase==='RECUPERACIO INICIAL'?'Recuperació inicial':phase==='PERDUA IMPULS'?'Pèrdua d’impuls':'Context de tendència mixt';
    const p=document.createElement('p');p.textContent=context+' · '+(a.momentum?.earlyTurn?'Possible gir inicial per vigilar.':'Sense gir incipient confirmat.');
    headline.append(title,p);overview.append(headline);
    const tf=document.createElement('div');tf.className='coin-brief-tf';
    for(const [key,label] of [['week','1W'],['day','1D'],['four','4H'],['hour','1H']]){
      const m=a.momentum?.[key],v=m?.macdHistogram;
      const span=document.createElement('span');span.className='coin-brief-chip '+(m?.available&&Number.isFinite(v)?v>=0?'positive':'negative':'neutral');
      span.textContent=label+': '+(m?.available&&Number.isFinite(v)?v>=0?'Impuls +':'Impuls −':'Sense dades');tf.append(span);
    }
    overview.append(tf);
    const reasons=document.createElement('div');reasons.className='coin-brief-reasons';
    const heading2=document.createElement('strong');heading2.textContent='Què falta per entrar?';reasons.append(heading2);
    const items=[];
    if(!a.planAvailable)items.push('Falta un pla executable amb risc i objectiu validats.');
    if(a.priceAboveVwap===false)items.push('El preu continua per sota del VWAP.');
    if(volumeTone!=='positive')items.push('Falta confirmació de volum alcista 1H/4H.');
    if(items.length===0)items.push('Validar tancament, trigger, liquiditat i preu executable al Pine.');
    for(const item of items.slice(0,3)){const t=document.createElement('p');t.textContent='• '+item;reasons.append(t)}
    overview.append(reasons);
    const details=document.createElement('details');details.className='coin-all-details';
    const detailsTitle=document.createElement('summary');detailsTitle.textContent='Veure tots els indicadors i dades tècniques';details.append(detailsTitle,grid);
    content.append(summary,overview,details);
    const info=document.createElement('p');info.className='coin-note';
    info.textContent='Estudi retrospectiu exploratori: '+safeText(st.events??'—')+' episodis; variació mitjana posterior a 6 h: '+(typeof st.avgForward6hPct==='number'?fmtValue(st.avgForward6hPct)+'%':'Sense dades')+'. No és un backtesting executiu. Els indicadors de vigilància no autoritzen READY.';
    details.append(info);
    overlay.hidden=false;document.getElementById('coinDismiss').focus();
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest?.('[data-crypto-detail]');
    if(button){e.preventDefault();openCoin(button.dataset.cryptoDetail);}
  });
})();