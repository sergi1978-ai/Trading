(() => {
 const root=document.getElementById('cryptoBacktestPanel');
 if(!root)return;
 const symbol=root.querySelector('#btSymbol'),go=root.querySelector('#btRun'),status=root.querySelector('#btStatus'),results=root.querySelector('#btResults'),history=root.querySelector('#btHistory'),chart=root.querySelector('#btChart');
 const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('ca-ES',{maximumFractionDigits:d}):'—';
 const labels={early:'Anticipada',balanced:'Equilibrada',strict:'Conservadora'};
 function node(tag,content,cls){const x=document.createElement(tag);if(cls)x.className=cls;x.textContent=content;return x;}
 function draw(trades){
  const ctx=chart.getContext('2d'),w=chart.width=660,h=chart.height=180;
  ctx.clearRect(0,0,w,h);
  let equity=100,values=[equity];
  for(const t of trades){equity*=1+t.netPct/100;values.push(equity);}
  const min=Math.min(...values)*.995,max=Math.max(...values)*1.005,span=Math.max(.01,max-min);
  ctx.strokeStyle='#3d5372';ctx.beginPath();ctx.moveTo(25,10);ctx.lineTo(25,h-20);ctx.lineTo(w-8,h-20);ctx.stroke();
  ctx.strokeStyle='#66d2ac';ctx.lineWidth=2;ctx.beginPath();
  values.forEach((v,i)=>{const x=25+(w-40)*i/Math.max(1,values.length-1),y=10+(h-30)*(max-v)/span;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});
  ctx.stroke();ctx.fillStyle='#c3d1e4';ctx.font='12px system-ui';ctx.fillText(fmt(values.at(-1))+' (inicial 100)',34,20);
 }
 go.addEventListener('click',async()=>{
  const s=symbol.value.trim().toUpperCase();if(!/^[A-Z0-9]{2,12}$/.test(s)){status.textContent='Introdueix un ticker vàlid';return;}
  go.disabled=true;status.textContent='Consultant espelmes tancades i simulant operacions…';results.replaceChildren();history.replaceChildren();chart.getContext('2d').clearRect(0,chart.width,chart.height);
  try{
   const response=await fetch('/api/crypto-backtest?symbol='+encodeURIComponent(s),{cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Error HTTP '+response.status);
   status.textContent=s+' · '+data.bars+' espelmes 1H · '+data.firstBar.slice(0,10)+' a '+data.lastBar.slice(0,10)+' · Kraken';
   const t=document.createElement('table');t.style.minWidth='650px';t.innerHTML='<thead><tr><th>Estratègia</th><th>Operacions</th><th>Encerts</th><th>Mitjana neta</th><th>Profit factor</th><th>Rendiment</th><th>Drawdown</th></tr></thead>';
   const body=document.createElement('tbody');for(const m of data.modes){const tr=document.createElement('tr');for(const val of [labels[m.mode],m.count,fmt(m.winRatePct)+'%',fmt(m.averageNetPct)+'%',fmt(m.profitFactor),fmt(m.returnPct)+'%',fmt(m.maxDrawdownPct)+'%'])tr.append(node('td',val));body.append(tr)}t.append(body);results.append(t);
   const select=document.createElement('select');select.setAttribute('aria-label','Estratègia per al gràfic');data.modes.forEach(m=>{const opt=document.createElement('option');opt.value=m.mode;opt.textContent=labels[m.mode];select.append(opt)});history.append(node('label','Gràfic i últimes operacions · '));history.append(select);
   const records=document.createElement('div');records.className='tablebox';history.append(records);
   function paint(mode){const m=data.modes.find(x=>x.mode===mode);draw(m.trades);const table=document.createElement('table');table.style.minWidth='560px';table.innerHTML='<thead><tr><th>Entrada</th><th>Sortida</th><th>Preu entrada</th><th>Preu sortida</th><th>Motiu</th><th>Net</th></tr></thead>';const tb=document.createElement('tbody');for(const x of m.trades.slice(-20).reverse()){const tr=document.createElement('tr');for(const v of [x.entryTime?.slice(0,16),x.exitTime?.slice(0,16),fmt(x.entry,5),fmt(x.exit,5),x.reason,fmt(x.netPct)+'%'])tr.append(node('td',v));tb.append(tr)}table.append(tb);records.replaceChildren(table)}
   select.addEventListener('change',()=>paint(select.value));paint(select.value);
  }catch(e){status.textContent='No s’ha pogut completar la prova: '+String(e.message||e)}
  finally{go.disabled=false;}
 });
})();