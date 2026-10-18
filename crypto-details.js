// Crypto details add-on. Loads after the main radar and does not change trade authorization.
(() => {
  const safeText = value => String(value ?? 'Sense dades');
  const fmtValue = (v, decimals=2) => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('ca-ES',{maximumFractionDigits:decimals}) : 'Sense dades';
  const style = document.createElement('style');
  style.textContent = '.crypto-info{font:inherit;color:#b9dcff;background:transparent;border:0;text-decoration:underline;cursor:pointer;font-weight:800;padding:5px}.coin-overlay[hidden]{display:none}.coin-overlay{position:fixed;inset:0;z-index:1000;background:#030914d8;display:grid;place-items:center;padding:15px}.coin-panel{width:min(560px,100%);max-height:90vh;overflow:auto;background:#14243d;border:1px solid #486080;border-radius:16px;padding:20px;color:#eef5ff}.coin-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.coin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.coin-tile{padding:12px;background:#21334e;border-radius:10px;overflow-wrap:anywhere}.coin-tile small{display:block;font-size:11px;color:#bdd0e5;margin-bottom:5px}.coin-note{color:#b6cbe2;font-size:12px;line-height:1.5}';
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
    const metric=(label,value)=>{
      const el=document.createElement('div');el.className='coin-tile';
      const k=document.createElement('small');k.textContent=label;
      const v=document.createElement('strong');v.textContent=safeText(value);
      el.append(k,v);return el;
    };
    const grid=document.createElement('div');grid.className='coin-grid';
    const st=a.historicalAccumulation||{};
    const vals=[
      ['Preu 1H',fmtValue(a.price,5)+' $'],
      ['RVOL 1H / 4H',fmtValue(a.rvol)+'× / '+fmtValue(a.rvol4h)+'×'],
      ['VWAP mòbil 24H',fmtValue(a.vwap24h,5)+' $'],
      ['Preu vs VWAP',a.priceAboveVwap===true?'Per sobre':a.priceAboveVwap===false?'Per sota':'Sense dades'],
      ['Força vs BTC 24H',typeof a.relativeStrengthBTC==='number'?fmtValue(a.relativeStrengthBTC)+' punts percentuals':'Sense dades'],
      ['Liquiditat',a.liquidityTier],
      ['Volum diari mitjà',typeof a.dollarVolumeDay==='number'?fmtValue(a.dollarVolumeDay,0)+' $':'Sense dades'],
      ['OBV / acumulació',a.accumulationWatch?'Indicis · vigilar':'No detectada'],
      ['Volum sostingut',a.strongVolumeWatch?'Detectat':'No detectat'],
      ['Senyal',a.pineState||a.status],
      ['Proveïdors',a.providerConsistency],
      ['Pla executable',a.planAvailable?'Validar al Pine':'Sense pla']
    ];
    for(const [k,v] of vals)grid.append(metric(k,v));
    const content=document.getElementById('coinMetrics');content.replaceChildren(grid);
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