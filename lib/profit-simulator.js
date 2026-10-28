// LONG AI PROFIT v1.0 — phase 2 portfolio backtesting kernel.
// Pure functions: no broker connection, no orders, no data fetching.
// Signals must originate from fully CLOSED bars; all fills occur on later bars.
const finite = Number.isFinite;
const at = value => Date.parse(value);
const round = value => Math.round(value*1e8)/1e8;
const EPS=1e-9;
export const PROFIT_STRATEGIES=Object.freeze(['TREND_PULLBACK','BREAKOUT_RETEST','EARLY_EXPANSION']);
export function simulateProfit({barsBySymbol,signals,initialCapital=10000,
 riskPct=.005,maxPortfolioRiskPct=.015,maxPositions=3,maxAllocationPct=.25,
 commissionBps=5,slippageBps=5,holdDays=7,noImpulseDays=3,
 tp1R=1.5,tp2R=3,trailAtrMultiplier=2}={}) {
 if(!barsBySymbol||typeof barsBySymbol!=='object'||!Array.isArray(signals))throw Error('barsBySymbol and signals required');
 const cfg=[initialCapital,riskPct,maxPortfolioRiskPct,maxPositions,maxAllocationPct,commissionBps,slippageBps,holdDays,noImpulseDays,tp1R,tp2R,trailAtrMultiplier];
 if(cfg.some(v=>!finite(v))||initialCapital<=0||riskPct<=0||riskPct>0.01||maxPortfolioRiskPct<riskPct||maxPositions<1||!Number.isInteger(maxPositions)||maxAllocationPct<=0||maxAllocationPct>1||commissionBps<0||slippageBps<0||holdDays<=0||noImpulseDays<=0||tp1R<=0||tp2R<=tp1R||trailAtrMultiplier<=0)throw Error('Invalid risk configuration');
 const marketBars=new Map(),latest=new Map(),barEnds=new Set(),timeline=new Map();
 for(const [symbol,raw] of Object.entries(barsBySymbol)){
   if(!Array.isArray(raw)||!raw.length)throw Error('Missing bar history for '+symbol);
   let previousEnd=-Infinity;
   const data=raw.map(b=>{
     const t=at(b.t),end=at(b.endExclusive);
     if(!finite(t)||!finite(end)||end<=t||t<previousEnd||
       ![b.o,b.h,b.l,b.c,b.v].every(finite)||b.o<=0||b.l<=0||b.v<0||
       b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h))
       throw Error('Invalid/overlapping OHLCV for '+symbol);
     previousEnd=end;
     return {...b,tMs:t,endMs:end,symbol};
   });
   marketBars.set(symbol,data);
   for(const b of data){
     barEnds.add(symbol+'|'+b.endMs);
     if(!timeline.has(b.tMs))timeline.set(b.tMs,[]);
     timeline.get(b.tMs).push(b);
   }
 }
 let rejected=[],accepted=[],trades=[],cash=initialCapital,positionId=0;
 const positions=new Map(),state=new Map();
 const orderedSignals=signals.map((signal,i)=>{
   if(!PROFIT_STRATEGIES.includes(signal.strategyId))throw Error('Unknown strategy at '+i);
   const timestamp=at(signal.signalTime);
   if(!marketBars.has(signal.symbol)||!finite(timestamp)||!barEnds.has(signal.symbol+'|'+timestamp))throw Error('Signal without matching closed bar: '+signal.symbol);
   if(![signal.entryTrigger,signal.initialStop,signal.atr4h].every(finite)||
       signal.initialStop<=0||signal.entryTrigger<=signal.initialStop||
       signal.atr4h<=0)throw Error('Invalid signal level');
   return {...signal,_i:i,_ms:timestamp,_expiry:timestamp+(signal.validHours??3)*3600000};
 }).sort((a,b)=>a._ms-b._ms||a.strategyId.localeCompare(b.strategyId)||a.symbol.localeCompare(b.symbol)||a._i-b._i);
 for(const s of orderedSignals)if(!finite(s._expiry)||s._expiry<=s._ms)throw Error('Invalid signal expiry');
 let nextSignal=0, pending=[];
 const timepoints=[...timeline.keys()].sort((a,b)=>a-b);
 const equityCurve=[];let maxDrawdown=0,peak=initialCapital;
 function equity(){let sum=cash;for(const p of positions.values())sum+=p.qty*(latest.get(p.symbol)??p.entry);return sum;}
 function openRisk(){return [...positions.values()].reduce((sum,p)=>sum+p.qty*Math.max(0,p.entry-p.stop),0);}
 function noteRejected(s,reason){rejected.push({symbol:s.symbol,strategyId:s.strategyId,signalTime:s.signalTime,reason});}
 function fillPrice(p,side){return p*(side==='BUY'?1+slippageBps/10000:1-slippageBps/10000);}
 function fee(amount){return amount*commissionBps/10000;}
 function exitQty(p,qty,rawPrice,time,reason){
   if(!(qty>0&&qty<=p.qty+EPS))throw Error('Invalid close quantity');
   qty=Math.min(qty,p.qty);
   const price=fillPrice(rawPrice,'SELL'),value=qty*price,commission=fee(value);
   cash+=value-commission;
   p.qty-=qty;p.proceeds+=value-commission;p.fees+=commission;
   p.executions.push({time:new Date(time).toISOString(),reason,quantity:round(qty),price:round(price),fee:round(commission)});
   if(p.qty<=EPS){
     positions.delete(p.symbol);
     const pnl=p.proceeds-p.invested;
     const grossRisk=p.initialQty*(p.entry-p.initialStop);
     const record={id:p.id,symbol:p.symbol,strategyId:p.strategyId,
       signalTime:p.signalTime,entryTime:p.entryTime,exitTime:new Date(time).toISOString(),
       entryPrice:round(p.entry),initialStop:round(p.initialStop),initialQty:round(p.initialQty),
       netPnL:round(pnl),realizedR:round(pnl/grossRisk),fees:round(p.fees),
       durationHours:round((time-p.entryMs)/3600000),exitReason:reason,
       executions:p.executions,capitalAtEntry:round(p.capitalAtEntry)};
     trades.push(record);
   }
 }
 function manage(p,b){
   // Gap through stop and combined stop/target OHLC collision both prioritize adverse stop.
   const timed=b.tMs>=p.entryMs+holdDays*86400000;
   const noImpulse=b.tMs>=p.entryMs+noImpulseDays*86400000 && p.highest<p.entry+.5*p.initialRisk;
   if(b.o<=p.stop){exitQty(p,p.qty,b.o,b.tMs,'GAP_STOP');return;}
   if(b.l<=p.stop){exitQty(p,p.qty,p.stop,b.endMs,'STOP');return;}
   if(timed||noImpulse){exitQty(p,p.qty,b.o,b.tMs,timed?'TIME_7D':'NO_IMPULSE_3D');return;}
   if(b.h>=p.tp1&&!p.tp1Done){
     const qty=Math.min(p.qty,p.initialQty*.5);
     exitQty(p,qty,Math.max(b.o,p.tp1),b.endMs,'TP1_1_5R');
     p.tp1Done=true;
   }
   if(positions.has(p.symbol)&&b.h>=p.tp2){
     exitQty(p,p.qty,Math.max(b.o,p.tp2),b.endMs,'TP2_3R');return;
   }
   if(positions.has(p.symbol)){
     p.highest=Math.max(p.highest,b.h);
     if(p.tp1Done)p.stop=Math.max(p.stop,b.c-trailAtrMultiplier*p.atr4h);
   }
 }
 function tryEntry(s,b){
   if(b.tMs<s._ms)return false; // signal bar itself is never eligible
   if(b.tMs>=s._expiry){noteRejected(s,'EXPIRED');return true;}
   if(positions.has(s.symbol)){noteRejected(s,'SYMBOL_ALREADY_OPEN');return true;}
   if(positions.size>=maxPositions){noteRejected(s,'MAX_POSITIONS');return true;}
   if(b.h<s.entryTrigger)return false;
   const rawFill=Math.max(b.o,s.entryTrigger);
   if(finite(s.maxEntryPrice)&&rawFill>s.maxEntryPrice){noteRejected(s,'NO_CHASE');return true;}
   const entry=fillPrice(rawFill,'BUY'),stop=s.initialStop;
   const perUnitRisk=entry-fillPrice(stop,'SELL');
   const entryFeePerUnit=entry*commissionBps/10000;
   const exitFeePerUnit=fillPrice(stop,'SELL')*commissionBps/10000;
   const totalRiskUnit=perUnitRisk+entryFeePerUnit+exitFeePerUnit;
   if(totalRiskUnit<=0){noteRejected(s,'INVALID_RISK');return true;}
   const capital=equity();
   const residualRisk=Math.max(0,capital*maxPortfolioRiskPct-openRisk());
   const tradeRisk=Math.min(capital*riskPct,residualRisk);
   const affordable=Math.max(0,cash)/(entry*(1+commissionBps/10000));
   const exposureLimit=capital*maxAllocationPct/entry;
   const qty=Math.min(tradeRisk/totalRiskUnit,affordable,exposureLimit);
   if(qty<=0||!finite(qty)||qty*entry<1e-6){noteRejected(s,'NO_CAPITAL');return true;}
   const amount=entry*qty,entryCommission=fee(amount);
   cash-=amount+entryCommission;
   const pos={id:++positionId,symbol:s.symbol,strategyId:s.strategyId,
     signalTime:s.signalTime,entryTime:new Date(b.tMs).toISOString(),entryMs:b.tMs,
     entry,stop,initialStop:stop,initialQty:qty,qty,initialRisk:entry-stop,
     tp1:entry+tp1R*(entry-stop),tp2:entry+tp2R*(entry-stop),tp1Done:false,
     highest:entry,atr4h:s.atr4h,capitalAtEntry:capital,invested:amount+entryCommission,
     proceeds:0,fees:entryCommission,executions:[{time:new Date(b.tMs).toISOString(),
       reason:'ENTRY',quantity:round(qty),price:round(entry),fee:round(entryCommission)}]};
   positions.set(s.symbol,pos);
   accepted.push({symbol:s.symbol,strategyId:s.strategyId,signalTime:s.signalTime,
     entryTime:pos.entryTime,entryPrice:round(entry),quantity:round(qty),riskBudget:round(qty*totalRiskUnit),
     capitalAtEntry:round(capital)});
   // Stop can be touched on the entry candle, but profit targets are NOT assumed fillable then.
   // If both stop & target hit after a stop-entry inside the same OHLC: adverse stop wins.
   if(b.l<=stop)exitQty(pos,pos.qty,stop,b.endMs,'ENTRY_BAR_STOP');
   return true;
 }
 for(const t of timepoints){
   const bars=timeline.get(t).sort((a,b)=>a.symbol.localeCompare(b.symbol));
   // All new bars expose the opening quote before any trades this timestamp.
   for(const b of bars)if(!latest.has(b.symbol))latest.set(b.symbol,b.o);
   while(nextSignal<orderedSignals.length&&orderedSignals[nextSignal]._ms<=t)pending.push(orderedSignals[nextSignal++]);
   // First manage holdings already open BEFORE accepting new orders.
   const closedSymbols=new Set();
   for(const b of bars){
     const existing=positions.get(b.symbol);
     if(existing){manage(existing,b);if(!positions.has(b.symbol))closedSymbols.add(b.symbol);}
     latest.set(b.symbol,b.c);
   }
   const remaining=[];
   for(const s of pending){
     const b=bars.find(x=>x.symbol===s.symbol);
     if(t>=s._expiry){noteRejected(s,'EXPIRED');continue;}
     if(!b){remaining.push(s);continue;}
     if(closedSymbols.has(s.symbol)){noteRejected(s,'SAME_BAR_REENTRY_BLOCKED');continue;}
     const resolved=tryEntry(s,b);
     if(!resolved)remaining.push(s);
   }
   pending=remaining;
   const current=equity();
   peak=Math.max(peak,current);
   maxDrawdown=Math.max(maxDrawdown,(peak-current)/peak);
   equityCurve.push({t:new Date(Math.max(...bars.map(x=>x.endMs))).toISOString(),
     equity:round(current),cash:round(cash),openRisk:round(openRisk()),positions:positions.size});
 }
 for(const s of [...pending,...orderedSignals.slice(nextSignal)])noteRejected(s,'END_OF_DATA');
 const endingEquity=equity(),closedPnL=trades.reduce((sum,x)=>sum+x.netPnL,0);
 const winners=trades.filter(x=>x.netPnL>0),losers=trades.filter(x=>x.netPnL<0);
 const profit=winners.reduce((sum,x)=>sum+x.netPnL,0),loss=Math.abs(losers.reduce((sum,x)=>sum+x.netPnL,0));
 const open=[...positions.values()].map(p=>({symbol:p.symbol,strategyId:p.strategyId,
   quantity:round(p.qty),entry:round(p.entry),stop:round(p.stop),
   mark:round(latest.get(p.symbol)??p.entry),unrealizedPnL:round(p.proceeds-p.invested+p.qty*(latest.get(p.symbol)??p.entry))}));
 const summaries=Object.fromEntries(PROFIT_STRATEGIES.map(k=>{
   const rows=trades.filter(x=>x.strategyId===k);
   return [k,{closedTrades:rows.length,netPnL:round(rows.reduce((s,x)=>s+x.netPnL,0)),
     meanR:rows.length?round(rows.reduce((s,x)=>s+x.realizedR,0)/rows.length):null}];
 }));
 return {settings:{initialCapital,riskPct,maxPortfolioRiskPct,maxPositions,maxAllocationPct,commissionBps,slippageBps,holdDays,noImpulseDays,tp1R,tp2R,trailAtrMultiplier},
   summary:{startCapital:initialCapital,endEquity:round(endingEquity),totalReturnPct:round((endingEquity/initialCapital-1)*100),
     markToMarketMaxDrawdownPct:round(100*maxDrawdown),closedTrades:trades.length,
     winRatePct:trades.length?round(winners.length/trades.length*100):null,
     profitFactor:loss>0?round(profit/loss):trades.length?'NO_LOSSES':null,
     meanR:trades.length?round(trades.reduce((s,x)=>s+x.realizedR,0)/trades.length):null,
     closedPnL:round(closedPnL),openCount:open.length},
   trades,accepted,rejected,openPositions:open,byStrategy:summaries,equityCurve,
   assumptions:'Closed-bar signals only; buy-stop next eligible candle; adverse OHLC stop priority; gap fills at open; 50% TP1 1.5R, remainder TP2 3R with close-updated trailing; no same-bar reentry; portfolio-level cash and mark-to-market. No intrabar path reconstruction.'};
}
