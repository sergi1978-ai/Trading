import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../pine/LONG_AI_PROFIT_v1_3_LAB.pine',import.meta.url),'utf8');
test('Pine v6, independent A/B selection and no mixed backtest',()=>{
 assert.ok(script.startsWith('//@version=6'));
 assert.match(script,/options=\["A · PULLBACK", "B · BREAKOUT RETEST"\]/);
 assert.match(script,/bool selected = engine==/);
 assert.match(script,/strategy\("LONG AI PROFIT v1\.3 LAB/);
});
test('All higher timeframes use confirmed data convention and decision uses closed 1H',()=>{
 const requests=script.match(/lookahead=barmerge\.lookahead_on/g)||[];
 assert.ok(requests.length>=5);
 assert.match(script,/bool newSetup = barstate\.isconfirmed and selected and planOK/);
 assert.match(script,/calc_on_every_tick=false/);
 assert.match(script,/calc_on_order_fills=false/);
});
test('Risk limited at 0.5% equity and 25% nominal portfolio size',()=>{
 assert.match(script,/float riskFraction = 0\.005/);
 assert.match(script,/float maxAllocation = 0\.25/);
 assert.match(script,/sizeByRisk = strategy\.equity\*riskFraction/);
 assert.match(script,/sizeByCash = strategy\.equity\*maxAllocation/);
 assert.match(script,/proposedRisk\/proposedTrigger<=maxStopPercent/);
});
test('Plan uses limit-chase, expiry, and brackets at signal bar before first fill',()=>{
 assert.match(script,/limit=entryTrigger\+entryChaseATR\*fATR/);
 assert.match(script,/int maxPendingBars = 3/);
 assert.match(script,/if not na\(orderBar\) and strategy\.position_size==0 and not na\(stopPrice\)/);
 assert.match(script,/strategy\.exit\("TP1","LONG",qty=halfQty/);
 assert.match(script,/strategy\.exit\("TP2","LONG",qty=otherQty/);
 assert.doesNotMatch(script,/strategy\.exit\([^\n]*qty_percent/);
});
test('Exits have stop/profit distinction, time stop and dust cleanup',()=>{
 for (const x of ['comment_profit="OBJECTIU_1"','comment_loss="STOP_1"',
  'comment_profit="OBJECTIU_2"','comment_loss="STOP_2"','TEMPS_7D',
  'SENSE_IMPULS_3D','RESIDU'])assert.ok(script.includes(x),x);
 assert.match(script,/strategy\.close\("LONG"/);
});
test('No brokerage calls and no unrestricted US stock claims',()=>{
 assert.match(script,/allowStocks = input\.bool\(false/);
 assert.match(script,/STRATEGY TESTER · NO BROKER/);
 assert.doesNotMatch(script,/https?:\/\//);
 assert.doesNotMatch(script,/alert\(/);
});
test('Orthogonal indicator families remain independent',()=>{
 for(const x of ['ta.dmi','ta.macd','ta.rsi','ta.atr','ta.vwap','ta.stdev',
   'ta.ema','rvol1','rvol4','btcFavorable'])assert.ok(script.includes(x),x);
});
