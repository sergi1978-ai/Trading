import test from 'node:test';
import assert from 'node:assert/strict';
import {newYorkClock,rebuildRthSession} from '../lib/stock-rth-rebuild.js';
const MIN=60000;
function fixture(start,day,open='09:30',close='16:00'){
 const length=(Number(close.slice(0,2))*60+Number(close.slice(3)))-(Number(open.slice(0,2))*60+Number(open.slice(3)));
 return {symbol:'NVDA',calendarDay:{date:day,open,close},
  minuteBars:Array.from({length},(_,i)=>({
   t:new Date(Date.parse(start)+i*MIN).toISOString(),
   endExclusive:new Date(Date.parse(start)+(i+1)*MIN).toISOString(),
   o:100+i*.001,h:100.1+i*.001,l:99.9+i*.001,c:100.02+i*.001,v:10+i%10
  }))};
}
test('RTH reconstruction handles EDT and last 30m bar; excludes injected 08:00 1H premarket',()=>{
 const f=fixture('2026-10-28T13:30:00Z','2026-10-28');
 const res=rebuildRthSession(f);
 assert.equal(res.oneHour.length,7);
 assert.equal(res.fourHour.length,2);
 assert.equal(Date.parse(res.oneHour[6].endExclusive)-Date.parse(res.oneHour[6].t),30*MIN);
 assert.equal(Date.parse(res.fourHour[1].endExclusive)-Date.parse(res.fourHour[1].t),150*MIN);
 assert.equal(res.parity.sum1HVolume,res.parity.dailyVolume);
 assert.equal(res.parity.sum4HVolume,res.parity.dailyVolume);
 assert.equal(res.parity.verifiedAgainstPine,false);
});
test('DST transition switches New York open from 13:30Z to 14:30Z',()=>{
 assert.deepEqual(newYorkClock(Date.parse('2026-10-28T13:30:00Z')),{date:'2026-10-28',minutes:570});
 assert.deepEqual(newYorkClock(Date.parse('2026-11-02T14:30:00Z')),{date:'2026-11-02',minutes:570});
 const result=rebuildRthSession(fixture('2026-11-02T14:30:00Z','2026-11-02'));
 assert.equal(result.oneHour[0].t,'2026-11-02T14:30:00.000Z');
});
test('early close from explicit calendar yields 4-hour final partial 3.5-hour bar',()=>{
 const f=fixture('2026-11-27T14:30:00Z','2026-11-27','09:30','13:00');
 const res=rebuildRthSession(f);
 assert.equal(res.parity.expectedMinutes,210);
 assert.equal(res.fourHour.length,1);
 assert.equal(res.oneHour.length,4);
 assert.equal(Date.parse(res.oneHour.at(-1).endExclusive)-Date.parse(res.oneHour.at(-1).t),30*MIN);
});
test('missing 1-minute candle is rejected rather than fabricated',()=>{
 const f=fixture('2026-10-28T13:30:00Z','2026-10-28');
 f.minuteBars.splice(125,1);
 assert.throws(()=>rebuildRthSession(f),/MISSING_RTH_MINUTE/);
});
test('after-hours or premarket inputs do not replace a missing RTH minute',()=>{
 const f=fixture('2026-10-28T13:30:00Z','2026-10-28');
 f.minuteBars.pop();
 f.minuteBars.unshift({t:'2026-10-28T12:00:00.000Z',endExclusive:'2026-10-28T12:01:00.000Z',
   o:100,h:101,l:99,c:100,v:5000});
 assert.throws(()=>rebuildRthSession(f),/MISSING_RTH_MINUTE/);
});
