import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pine=readFileSync(new URL('../pine/LONG_AI_PROFIT_v1_2_LAB.pine',import.meta.url),'utf8');
test('v1.2 Pine has one additional closed 1D/4H follow-through filter',()=>{
 assert.match(pine,/followThroughOK=dClose>d20 and fClose>f20 and fClose>fPrevClose/);
 assert.match(pine,/confirmed=barstate.isconfirmed[^\n]*followThroughOK/);
 assert.match(pine,/lookahead=barmerge.lookahead_on/);
});
test('v1.2 Pine preallocates take-profit quantities instead of re-issuing qty_percent',()=>{
 assert.match(pine,/fixedTP1Qty:=quantity\*\.5/);
 assert.match(pine,/fixedTP2Qty:=quantity-fixedTP1Qty/);
 assert.doesNotMatch(pine,/strategy\.exit\([^\n]*qty_percent/);
 assert.match(pine,/comment_loss="STOP_TP1"/);
 assert.match(pine,/comment_loss="STOP_TP2"/);
});
test('v1.2 Pine retains a zero-live-order, no-leverage strategy declaration',()=>{
 assert.match(pine,/pyramiding=0/);
 assert.match(pine,/initial_capital=10000/);
 assert.match(pine,/strategy\.equity\*\.005/);
 assert.match(pine,/strategy\.equity\*\.25/);
 assert.match(pine,/strategy\.position_size\*close<1/);
 assert.doesNotMatch(pine,/request\.security_lower_tf\(/);
});
// NOTE: These are textual guardrails, NOT Pine compiler or Strategy Tester verification.
