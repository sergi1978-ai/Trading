// Learning Lab v0.1 — descriptive analysis only; no parameter optimisation or live orders.
const finite = n => typeof n === 'number' && Number.isFinite(n);
const round = (n,d=2) => n == null ? null : Number(n.toFixed(d));
function analyse(trades) {
  const valid = trades.filter(t => finite(t.returnPct));
  const returns = valid.map(t=>t.returnPct);
  const wins = returns.filter(n=>n>0), losses=returns.filter(n=>n<0);
  const total = returns.reduce((a,b)=>a+b,0);
  const grossWin=wins.reduce((a,b)=>a+b,0), grossLoss=-losses.reduce((a,b)=>a+b,0);
  let equity=1, peak=1, drawdown=0;
  for(const r of returns){ equity*=Math.max(0,1+r/100); peak=Math.max(peak,equity); drawdown=Math.max(drawdown,1-equity/peak); }
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const expectancy=returns.length?total/returns.length:null;
  return {count:returns.length,winRatePct:returns.length?round(100*wins.length/returns.length):null,
    expectancyPct:round(expectancy),averageWinPct:round(mean(wins)),averageLossPct:round(mean(losses)),
    profitFactor:grossLoss?round(grossWin/grossLoss):grossWin>0?null:0,
    compoundedReturnPct:round((equity-1)*100),maxDrawdownPct:round(drawdown*100),
    insufficientSample:returns.length<30};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
  try {
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body || !Array.isArray(body.trades) || body.trades.length>5000) return res.status(400).json({error:'Cal una llista trades de màxim 5000 operacions'});
    if(body.trades.some(t=>!t || !finite(t.returnPct) || Math.abs(t.returnPct)>1000 || (t.motor!=null && typeof t.motor!=='string'))) return res.status(400).json({error:'Operacions invàlides: returnPct ha de ser numèric'});
    const trades=body.trades;
    const motors=['A','C','E','F','TACTICA','PROVA','SENSE_MOTOR'];
    const groups=Object.fromEntries(motors.map(m=>[m,analyse(trades.filter(t=>(t.motor||'SENSE_MOTOR').toUpperCase()===m))]));
    const unknown=[...new Set(trades.map(t=>(t.motor||'SENSE_MOTOR').toUpperCase()).filter(m=>!motors.includes(m)))];
    for(const m of unknown.slice(0,30))groups[m]=analyse(trades.filter(t=>(t.motor||'SENSE_MOTOR').toUpperCase()===m));
    return res.status(200).json({version:'learning-lab-v0.1',source:body.source||'manual',total:analyse(trades),byMotor:groups,
      warnings:['Anàlisi descriptiva; no aprenentatge automàtic','Sense validació fora de mostra ni ajust per selecció de paràmetres','Les rendibilitats es calculen amb returnPct subministrat; comprovar comissions, exposició i ordre temporal','El drawdown pressuposa operacions seqüencials i sense solapament'],
      next:'Integrar replay 1D/4H/1H i registrar indicadors en el moment de cada entrada'});
  } catch(e){return res.status(400).json({error:'JSON invàlid o dades incorrectes'});}
}