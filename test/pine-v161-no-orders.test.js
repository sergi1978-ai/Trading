import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const v16=readFileSync(new URL("../pine/LONG_AI_PROFIT_v1_6_LAB.pine",import.meta.url),"utf8");
const diag=readFileSync(new URL("../pine/LONG_AI_PROFIT_v1_6_1_DIAGNOSTIC.pine",import.meta.url),"utf8");
test("v1.6 baseline is preserved; stop, target and fixed entry parameters unchanged",()=>{
 const required=[
 "float riskFraction = 0.005","float allocationCap = 0.25",
 "float reserveCostPct = 0.002","float maxStopPct = 0.08",
 "float maxEntryChaseAtr4 = 0.20","float targetR = 2.00",
 'strategy.entry("L",strategy.long,qty=qty,stop=trigger,',
 'strategy.exit("L_BRACKET","L",stop=stopPrice,limit=targetPrice,',
 'comment_profit="OBJECTIU_2R",comment_loss="STOP_ESTRUCTURAL"',
 'bool impulseC =','bool signalC =','bool signalB ='
 ];
 for(const item of required){
   assert.ok(v16.includes(item),"old missing "+item);
   assert.ok(diag.includes(item),"diagnostic missing "+item);
 }
});
test("60-day resistance is a documented switch, strict comparator is still available",()=>{
 assert.match(diag,/options=\["INFORMATIVA \(LAB\)", "ESTRICTA \(v1\.6\)"\]/);
 assert.match(diag,/bool resistanceConflict = realResistance and roomRR<targetR/);
 assert.match(diag,/bool resistanceOK = resistanceMode=="INFORMATIVA \(LAB\)" or not resistanceConflict/);
 assert.match(diag,/bool planOK = geometryOK and costRROK and resistanceOK/);
 assert.match(diag,/roomRR = realResistance and proposedRisk>0/);
});
test("diagnostic exposes stages before/after risk, submitted, filled and expired",()=>{
 for(const key of ["rawCandidateCount","costQualifiedCount","resistanceConflictCount","submitted","filledCount","expiredCount","blockedRegime","blockedSetup","blockedPlan"]){
   assert.match(diag,new RegExp(key));
 }
 assert.match(diag,/plotshape\(barstate\.isconfirmed and inStudy and selectedSignal,title="SENYAL ABANS RISC"/);
 assert.match(diag,/plotshape\(newSignal,title="ORDRE CANDIDATA"/);
});
test("testing window no longer expires at October 29 midnight",()=>{
 assert.match(diag,/endDate = input\.time\(timestamp\("01 Jan 2030 00:00 \+0000"\)/);
});
test("still restricts to crypto 1H and closes HTF candles",()=>{
 assert.match(diag,/timeframe\.in_seconds\(\) != 3600 or not chart\.is_standard/);
 assert.match(diag,/syminfo\.type != "crypto"/);
 assert.match(diag,/syminfo\.currency != "USDT" and syminfo\.currency != "USD"/);
 assert.ok((diag.match(/lookahead=barmerge\.lookahead_on/g)||[]).length>=4);
 assert.match(diag,/barstate\.isconfirmed and inStudy and selectedSignal and planOK/);
});
test("no partial exit, no use of broker account, no automatic alerts",()=>{
 assert.match(diag,/pyramiding=0/);
 assert.doesNotMatch(diag,/qty_percent|strategy\.exit\("TP1"|strategy\.exit\("TP2"/);
 assert.doesNotMatch(diag,/alertcondition\(|alert\(/);
});
