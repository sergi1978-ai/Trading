import test from 'node:test';
import assert from 'node:assert/strict';
import {day,fourHour,replay} from '../lib/multitimeframe.js';
const bar=(stamp,o=100,h=o+2,l=o-2,c=o+1,v=100)=>({t:Date.parse(stamp),o,h,l,c,v});
test('New York trading-date key is sortable ISO, not localized MM/DD/YYYY',()=>{
 assert.equal(day(Date.parse('2026-10-25T02:00:00Z')),'2026-10-24');
 assert.equal(day(Date.parse('2026-11-02T15:00:00Z')),'2026-11-02');
});
test('4H candle uses four contiguous 1H candles and never crosses gaps',()=>{
 const xs=['2026-10-23T13:30:00Z','2026-10-23T14:30:00Z','2026-10-23T15:30:00Z','2026-10-23T16:30:00Z'].map((t,i)=>bar(t,100+i));
 const q=fourHour(xs);assert.equal(q.length,1);assert.equal(q[0].end,Date.parse('2026-10-23T17:30:00Z'));
 assert.equal(fourHour([xs[0],xs[1],xs[3],bar('2026-10-23T17:30:00Z')]).length,0);
});
test('empty replay returns no invented trades and exposes warmup',()=>{
 const d=Array.from({length:60},(_,i)=>bar(new Date(Date.UTC(2026,0,i+1,14)).toISOString()));
 const h=Array.from({length:30},(_,i)=>bar(new Date(Date.UTC(2026,0,1,14+i)).toISOString()));
 const r=replay(d,h);assert.equal(r.closed,0);assert.equal(r.totalReturnPct,0);assert.ok(r.rejections.warmup>=1);
});
