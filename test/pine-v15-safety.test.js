import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../pine/LONG_AI_PROFIT_v1_5_C_LAB.pine',import.meta.url),'utf8');
test('Pine v6 one-hour standard crypto only, no stock RTH overclaim',()=>{
 assert.ok(s.startsWith('//@version=6'));
 assert.match(s,/chart\.is_standard/);
 assert.match(s,/timeframe\.in_seconds\(\) != 3600/);
 assert.match(s,/syminfo\.type != "crypto"/);
});
test('only C continuation, with locked experiment EXECUCIO vs QUALITAT',()=>{
 assert.match(s,/C15 · EXECUCIO/);
 assert.match(s,/C15 · QUALITAT/);
 assert.match(s,/bool candleQuality = candleLocation>=\.70 and bullishBody>=\.40/);
 assert.match(s,/not testQuality or candleQuality/);
 assert.doesNotMatch(s,/strategy\.entry\("A"/);
 assert.doesNotMatch(s,/strategy\.entry\("B"/);
});
test('HTF requests use previous bars, no developing 4H/1D values',()=>{
 assert.ok((s.match(/lookahead=barmerge\.lookahead_on/g)||[]).length>=4);
 assert.match(s,/\[close\[1\],ta\.ema\(close,20\)\[1\]/);
 assert.match(s,/p\[1\],m\[1\],a\[1\]/);
 assert.match(s,/hist\[1\],hist\[2\]/);
 assert.match(s,/barstate\.isconfirmed and entryCondition and validRisk/);
});
test('risk sizing and no-chase pending stop-limit unchanged from reference',()=>{
 assert.match(s,/riskFraction = \.005/);
 assert.match(s,/allocationCap = \.25/);
 assert.match(s,/costReserve = \.002/);
 assert.match(s,/riskCandidate\/entryTriggerCandidate<=\.10/);
 assert.match(s,/strategy\.entry\("C15",strategy\.long,qty=qty,stop=trigger,/);
 assert.match(s,/limit=trigger\+chaseATR\*fATR/);
 assert.match(s,/bar_index-pendingAt>=pendingBars/);
});
test('one full-size bracket eliminates TP1 TP2 legs, with stop priority',()=>{
 assert.match(s,/strategy\.exit\("C15_FULL","C15",stop=stop,limit=takeProfit/);
 assert.doesNotMatch(s,/qty_percent|sizeHalf|sizeOther|TP1_PROFIT|TP2_PROFIT/);
 assert.match(s,/comment_profit="TP_COMPLET",comment_loss="STOP_COMPLET"/);
 assert.match(s,/calc_on_order_fills=false/);
 assert.match(s,/process_orders_on_close=false/);
});
test('no fictional overhead R/R and no unverified probabilistic quality labels',()=>{
 assert.match(s,/resistanceAbove = not na\(dResistance\)/);
 assert.match(s,/resistanceRoomR = resistanceAbove/);
 assert.match(s,/bool resistanceClear = not resistanceAbove or resistanceRoomR>=1\.50/);
 assert.doesNotMatch(s,/:\s*3\.0\s*$/m);
});
test('history, no-progress & time-stop and actual fill target reconciliation',()=>{
 assert.match(s,/entryMs\+7\*86400000/);
 assert.match(s,/entryMs\+3\*86400000/);
 assert.match(s,/strategy\.position_avg_price/);
 assert.match(s,/takeProfit:=actualEntry\+takeProfitR\*riskAtFill/);
 assert.match(s,/strategy\.closedtrades\.entry_time/);
});
