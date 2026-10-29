import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=readFileSync(new URL('../pine/LONG_AI_PROFIT_v1_5_C_LAB.pine',import.meta.url),'utf8');
const audit=readFileSync(new URL('../pine/LONG_AI_PROFIT_v1_5_C_DIAGNOSTIC_NO_RETUNE.pine',import.meta.url),'utf8');
test('diagnostic Pine begins with the byte-for-byte frozen v1.5 script',()=>{
 assert.ok(audit.startsWith(base),'No original entry, exit or indicator rule changed');
});
test('new diagnostics only append to script, do not route orders',()=>{
 const appended=audit.slice(base.length);
 assert.match(appended,/DIAGNOSTIC ONLY/);
 for(const name of ['strategy.closedtrades.max_runup(k)','strategy.closedtrades.max_drawdown(k)','strategy.closedtrades.commission(k)','strategy.closedtrades.exit_comment(k)'])assert.ok(appended.includes(name));
 assert.doesNotMatch(appended,/strategy\.(entry|exit|close|cancel|order)\(/);
 assert.doesNotMatch(appended,/input\./);
});
