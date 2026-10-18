// Crypto details add-on. Loads after the main radar and does not change trade authorization.
(() => {
  const safeText = value => String(value ?? 'Sense dades');
  const fmtValue = (v, decimals=2) => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('ca-ES',{maximumFractionDigits:decimals}) : 'Sense dades';
  const style = document.createElement('style');
  style.textContent = '.crypto-info{font:inherit;color:#b9dcff;background:transparent;border:0;text-decoration:underline;cursor:pointer;font-weight:800;padding:5px}.coin-overlay[hidden]{display:none}.coin-overlay{position:fixed;inset:0;z-index:1000;background:#030914d8;display:grid;place-items:center;padding:15px}.coin-panel{width:min(560px,100%);max-height:90vh;overflow:auto;background:#14243d;border:1px solid #486080;border-radius:16px;padding:20px;color:#eef5ff}.coin-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.coin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.coin-tile{padding:12px;background:#21334e;border-radius:10px;overflow-wrap:anywhere}.coin-tile small{display:block;font-size:11px;color:#bdd0e5;margin-bottom:5px}.coin-note{color:#b6cbe2;font-size:12px;line-height:1.5}.coin-tile.positive{background:#153a33;border:1px solid #27745c}.coin-tile.positive strong{color:#8af3c2}.coin-tile.negative{background:#432631;border:1px solid #98505f}.coin-tile.negative strong{color:#ffb5c1}.coin-tile.neutral{background:#21334e;border:1px solid #354a68}.coin-summary{padding:13px;border-radius:12px;background:#1c3048;border:1px solid #3c5978;margin-top:16px}.coin-summary strong{display:block;margin-bottom:7px}.coin-summary p{margin:5px 0;font-size:12px;line-height:1.4}.coin-summary .up{color:#8af3c2}.coin-summary .down{color:#ffb5c1}.coin-summary .flat{color:#c7d5e8}';
  document.head.append(style);
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
    document.getElementById('coinHeading').textContent=sym+' · Anàlisi avançada';
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
      ['EMA 200 · 1D',a.momentum?.day?.ema200Available?fmtValue(a.momentum.day.ema200,5):'Històric insuficient',a.momentum?.day?.emaAligned?'positive':'neutral'],
      ['Creuament EMA 20/50 · 4H',a.momentum?.four?.emaCross5||'Sense dades',a.momentum?.four?.emaCross5==='ALCISTA'?'positive':a.momentum?.four?.emaCross5==='BAIXISTA'?'negative':'neutral'],
      ['MACD · 1H',a.momentum?.hour?.macdCross||'Sense dades',a.momentum?.hour?.macdTone||'neutral'],
      ['RSI · 1H',Number.isFinite(a.momentum?.hour?.rsi14)?fmtValue(a.momentum.hour.rsi14,1):'Sense dades',a.momentum?.hour?.rsiTone||'neutral']
    ];
    for(const [k,v,tone] of vals)grid.append(metric(k,v,tone));
    const content=document.getElementById('coinMetrics');content.replaceChildren();
    const summary=document.createElement('div');summary.className='coin-summary';
    const heading=document.createElement('strong');heading.textContent=noPlan?'DIAGNÒSTIC · Sense entrada confirmada':'DIAGNÒSTIC · Revisar pla al Pine';
    summary.append(heading);
    const findings=[
      [a.priceAboveVwap===true?'up':a.priceAboveVwap===false?'down':'flat',a.priceAboveVwap===true?'Preu per sobre del VWAP.':a.priceAboveVwap===false?'Preu per sota del VWAP.':'VWAP no concloent.'],
      [relativeTone==='positive'?'up':relativeTone==='negative'?'down':'flat',Number.isFinite(a.relativeStrengthBTC)?'Força relativa vs BTC: '+fmtValue(a.relativeStrengthBTC)+' punts.':'Força relativa no disponible.'],
      [volumeTone==='positive'?'up':volumeTone==='negative'?'down':'flat',volumeTone==='positive'?'Volum 1H i 4H favorable.':volumeTone==='negative'?'Pressió baixista amb volum significatiu.':'Volum sense confirmació clara.'],
      [noPlan?'down':'flat',noPlan?'Cap pla executable.':'Pla orientatiu: comprovar al Pine.']
    ];
    for(const [tone,line] of findings){const p=document.createElement('p');p.className=tone;p.textContent=(tone==='up'?'▲ ':tone==='down'?'▼ ':'● ')+line;summary.append(p);}
    content.append(summary,grid);
    const info=document.createElement('p');info.className='coin-note';
    info.textContent='Estudi retrospectiu exploratori: '+safeText(st.events??'—')+' episodis; variació mitjana posterior a 6 h: '+(typeof st.avgForward6hPct==='number'?fmtValue(st.avgForward6hPct)+'%':'Sense dades')+'. No és un backtesting executiu. Els indicadors de vigilància no autoritzen READY.';
    content.append(info);
    overlay.hidden=false;document.getElementById('coinDismiss').focus();
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest?.('[data-crypto-detail]');
    if(button){e.preventDefault();openCoin(button.dataset.cryptoDetail);}
  });
})();