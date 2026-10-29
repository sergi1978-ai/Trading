import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const s=readFileSync(new URL("../pine/LONG_AI_PROFIT_v1_6_LAB.pine",import.meta.url),"utf8");
test("Pine v6 lab, chart 1H only, crypto USD/USDT only",()=>{
 assert.ok(s.startsWith("//@version=6\nstrategy("));
 assert.match(s,/timeframe\.in_seconds\(\) != 3600/);
 assert.match(s,/chart\.is_standard/);
 assert.match(s,/syminfo\.type != "crypto"/);
 assert.match(s,/syminfo\.currency != "USDT" and syminfo\.currency != "USD"/);
});
test("C continuation and B breakout retest are exclusive strategy choices",()=>{
 assert.match(s,/options=\["C · CONTINUACIO", "B · RUPTURA-RETEST"\]/);
 assert.match(s,/bool signalC =/);
 assert.match(s,/bool signalB =/);
 assert.match(s,/bool selectedSignal = route/);
 assert.match(s,/bar_index>bBreakIndex/);
});
test("Higher timeframe offset semantics and no future information",()=>{
 assert.ok((s.match(/lookahead=barmerge\.lookahead_on/g)||[]).length>=4);
 for (const k of ["close[1]","ta.ema(close,20)[1]","ta.ema(close,50)[1]","ta.atr(14)[1]","ta.highest(high,60)[1]","p[1],m[1],a[1]","h[1],h[2]"])assert.ok(s.includes(k),k);
 assert.match(s,/barstate\.isconfirmed and inStudy and selectedSignal and planOK/);
 assert.match(s,/calc_on_every_tick=false, calc_on_order_fills=false/);
});
test("Risk objective and exposure limit with preplanned protective entry exit",()=>{
 assert.match(s,/riskFraction = 0\.005/);
 assert.match(s,/allocationCap = 0\.25/);
 assert.match(s,/math\.min\(strategy\.equity\*riskFraction\/perUnitRisk,strategy\.equity\*allocationCap\/proposedTrigger\)/);
 assert.match(s,/math\.floor\(rawQty\/lot\)\*lot/);
 assert.match(s,/proposedRisk\/proposedTrigger<=maxStopPct/);
 const start=s.indexOf("if newSignal");
 const end=s.indexOf("// Retirar entrada pendent");
 const block=s.slice(start,end);
 assert.match(block,/strategy\.entry\("L"/);
 assert.match(block,/strategy\.exit\("L_BRACKET","L"/);
 assert.ok(block.indexOf("strategy.entry(")<block.indexOf("strategy.exit("));
 assert.match(block,/stop=stopPrice,limit=targetPrice/);
 assert.match(block,/stop=trigger,\s*\n\s*limit=trigger\+maxEntryChaseAtr4\*fATR/);
});
test("Single bracket avoids split TP quantity reservations and no live alerts",()=>{
 assert.doesNotMatch(s,/strategy\.exit\("TP1"|strategy\.exit\("TP2"|qty_percent/);
 assert.match(s,/comment_profit="OBJECTIU_2R",comment_loss="STOP_ESTRUCTURAL"/);
 assert.doesNotMatch(s,/alertcondition\(|alert\(/);
 assert.match(s,/pyramiding=0/);
});
test("Date-scoped historical testing with 3-day and 7-day exit conditions",()=>{
 assert.match(s,/time>=startDate and time<endDate/);
 assert.match(s,/bar_index-pendingAt>=expirationBars/);
 assert.match(s,/time>=entryMs\+7\*86400000/);
 assert.match(s,/time>=entryMs\+3\*86400000/);
 assert.match(s,/bar_index-lastFlatBar<cooldownBars/);
});
test("No fabricated resistance R and no per-leg trade accounting",()=>{
 assert.match(s,/bool realResistance = not na\(dHigh60\)/);
 assert.match(s,/not realResistance or roomRR>=targetR/);
 assert.doesNotMatch(s,/roomRR = .*: 3\.0/);
 assert.match(s,/strategy\.closedtrades\.entry_time\(k\)/);
 assert.match(s,/strategy\.closedtrades\.exit_time\(k\)/);
 assert.match(s,/strategy\.closedtrades\.commission\(k\)/);
 assert.match(s,/strategy\.closedtrades\.max_runup\(k\)/);
 assert.match(s,/strategy\.closedtrades\.max_drawdown\(k\)/);
});
test("No automatic claim that 30 observed trades constitute proof",()=>{
 assert.match(s,/MOSTRA <30: NO VALIDAT/);
 assert.match(s,/COMPROVAR OOS \+ COSTOS/);
});
