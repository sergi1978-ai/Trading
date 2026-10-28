import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateProfit} from '../lib/profit-simulator.js';
const base=Date.parse('2026-10-01T00:00:00Z');
const candle=(hour,{o=100,h=101,l=99,c=100,v=1000}={})=>({
 t:new Date(base+hour*3600000).toISOString(),
 endExclusive:new Date(base+(hour+1)*3600000).toISOString(),o,h,l,c,v});
const signal=(symbol='BTCUSD',strategyId='TREND_PULLBACK',entryTrigger=100,initialStop=98,atr4h=1)=>({
 symbol,strategyId,entryTrigger,initialStop,atr4h,signalTime:candle(0).endExclusive,maxEntryPrice:110});
const run=(bars,signals=[signal()],options={})=>simulateProfit({
 barsBySymbol:{BTCUSD:bars},signals,...options});
test('missing source candle for signal fails closed',()=>{
 assert.throws(()=>run([candle(0)], [{...signal(),signalTime:'2026-10-02T20:00:00Z'}]),/without matching closed bar/);
});
test('fills at following bar, sizes risk under 0.5%, and never treats signal bar as execution',()=>{
 const r=run([candle(0,{o:99,h:120,l:99,c:100}),candle(1,{o:100,h:101,l:99,c:100})]);
 assert.equal(r.accepted.length,1);
 assert.equal(r.accepted[0].entryTime,candle(1).t);
 assert.ok(r.accepted[0].riskBudget<=50+1e-7);
 assert.equal(r.openPositions.length,1);
});
test('entry candle hits stop and target: conservative entry-bar stop takes priority',()=>{
 const r=run([candle(0),candle(1,{o:99,h:108,l:97,c:105})]);
 assert.equal(r.trades.length,1);
 assert.equal(r.trades[0].exitReason,'ENTRY_BAR_STOP');
 assert.ok(r.summary.totalReturnPct<0);
});
test('gap-through-stop can exceed intended 0.5% capital risk',()=>{
 const r=run([candle(0),candle(1,{o:100,h:101,l:99,c:100}),candle(2,{o:90,h:94,l:89,c:92})]);
 assert.equal(r.trades[0].exitReason,'GAP_STOP');
 assert.ok(r.trades[0].netPnL<-50);
});
test('TP1 partial and TP2 both fill without assuming profit on entry candle',()=>{
 const r=run([candle(0),candle(1,{o:100,h:110,l:99,c:100}),
   candle(2,{o:100,h:108,l:99,c:108})]);
 assert.equal(r.trades.length,1);
 assert.equal(r.trades[0].executions.filter(x=>x.reason.startsWith('TP')).length,2);
 assert.ok(r.trades[0].netPnL>0);
});
test('max drawdown marks open positions, not only closed trades',()=>{
 const r=run([candle(0),candle(1,{o:100,h:100,l:99,c:99}),
   candle(2,{o:99,h:100,l:98.8,c:99})],undefined,{commissionBps:0,slippageBps:0});
 assert.equal(r.trades.length,0);
 assert.ok(r.summary.markToMarketMaxDrawdownPct>0);
});
test('no trade reentry on same OHLC stop exit bar',()=>{
 const bars=[candle(0),candle(1,{o:100,h:101,l:99,c:100}),candle(2,{o:100,h:107,l:97,c:100})];
 const secondary={...signal(),strategyId:'BREAKOUT_RETEST',signalTime:candle(1).endExclusive};
 const r=run(bars,[signal(),secondary]);
 assert.equal(r.trades.length,1);
 assert.equal(r.accepted.length,1);
 assert.ok(r.rejected.some(s=>s.reason==='SAME_BAR_REENTRY_BLOCKED'));
});
test('maxPositions and portfolio risk are bounded for independent motors',()=>{
 const bars=[candle(0),candle(1,{o:100,h:101,l:99,c:100})];
 const signals=['AAA','BBB','CCC','DDD'].map((symbol,i)=>signal(symbol,
   ['TREND_PULLBACK','BREAKOUT_RETEST','EARLY_EXPANSION','TREND_PULLBACK'][i]));
 const r=simulateProfit({barsBySymbol:Object.fromEntries(signals.map(s=>[s.symbol,bars])),
   signals,maxPositions:3});
 assert.equal(r.openPositions.length,3);
 assert.ok(r.equityCurve.at(-1).openRisk<=151);
});
test('signal not reached by expiry is not force-filled',()=>{
 const bars=[candle(0),candle(1,{o:95,h:96,l:94,c:95}),candle(2,{o:95,h:96,l:94,c:95}),
   candle(3,{o:95,h:99,l:94,c:99}),candle(4,{o:100,h:103,l:99,c:102})];
 const r=run(bars);
 assert.equal(r.accepted.length,0);
 assert.equal(r.rejected[0].reason,'EXPIRED');
});
test('no fabricated closed trade at final bar; open position marked to market',()=>{
 const r=run([candle(0),candle(1,{o:100,h:100,l:99.5,c:99.8})]);
 assert.equal(r.trades.length,0);assert.equal(r.openPositions.length,1);
 assert.ok(r.openPositions[0].unrealizedPnL<0);
});

test('resting TP1 gap at opening fills before a later low crosses stop',()=>{
 const bars=[candle(0),candle(1,{o:100,h:101,l:99,c:100}),
   candle(2,{o:105,h:106,l:97,c:98})];
 const r=run(bars);
 assert.equal(r.trades.length,1);
 const leg=r.trades[0].executions;
 assert.equal(leg[1].reason,'TP1_OPEN');
 assert.equal(leg[2].reason,'STOP');
 assert.ok(leg[1].price>103);
});
test('resting TP2 gap at opening fills both halves before later intrabar stop',()=>{
 const bars=[candle(0),candle(1,{o:100,h:101,l:99,c:100}),
   candle(2,{o:109,h:112,l:96,c:97})];
 const r=run(bars);
 assert.equal(r.trades.length,1);
 assert.deepEqual(r.trades[0].executions.slice(1).map(x=>x.reason),['TP1_OPEN','TP2_OPEN']);
 assert.ok(r.trades[0].netPnL>0);
});
test('all-bar same timestamp symbols must keep cash and portfolio risk bounded',()=>{
 const bars=[candle(0),candle(1,{o:100,h:101,l:99,c:100})];
 const syms=['A','B','C','D','E','F'];
 const r=simulateProfit({barsBySymbol:Object.fromEntries(syms.map(s=>[s,bars])),
   signals:syms.map(s=>signal(s)),maxPositions:3});
 assert.equal(r.accepted.length,3);
 assert.ok(r.equityCurve.every(e=>e.openRisk<=150.01));
 assert.ok(r.equityCurve.every(e=>e.cash>=-1e-7));
});

test('second asset entry sizes against 1H OPEN not unknown simultaneous CLOSE',()=>{
 const a=[candle(0),candle(1,{o:100,h:101,l:99,c:100}),
   candle(2,{o:100,h:1000,l:99,c:1000})];
 const b=[candle(0),candle(1),candle(2,{o:100,h:102,l:99,c:100})];
 const r=simulateProfit({barsBySymbol:{AAA:a,BBB:b},
   signals:[signal('AAA'),{...signal('BBB'),signalTime:candle(1).endExclusive}]});
 const second=r.accepted.find(x=>x.symbol==='BBB');
 assert.ok(second,'BBB should fill');
 assert.ok(second.capitalAtEntry<=10001);
 assert.ok(second.riskBudget<=51);
});
test('intrabar exit cannot free a MAX_POSITIONS slot for another same-hour entry',()=>{
 const baseBars=[candle(0),candle(1,{o:100,h:101,l:99,c:100}),
   candle(2,{o:100,h:102,l:97,c:99})];
 const other=[candle(0),candle(1),candle(2)];
 const r=simulateProfit({
  barsBySymbol:{AAA:baseBars,BBB:baseBars,CCC:baseBars,DDD:other},
  signals:[signal('AAA'),signal('BBB'),signal('CCC'),
    {...signal('DDD'),signalTime:candle(1).endExclusive}],maxPositions:3});
 assert.equal(r.accepted.length,3);
 assert.ok(r.rejected.some(x=>x.symbol==='DDD'&&x.reason==='MAX_POSITIONS'));
});
