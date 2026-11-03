import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateBars} from '../lib/learning-lab/candles.js';
const hours=[9,10,11,12,13,14,15];
function fixture(day,offset){
 return hours.map((h,i)=>{
  const minute=h===9?30:30;
  return {t:day+'T'+String(h+offset).padStart(2,'0')+':'+minute+':00Z',o:100+i,h:102+i,l:99+i,c:101+i,v:1000};
 });
}
test('winter US session: 4h and 1d aggregates',()=>{
 const bars=fixture('2026-01-12',5); // EST 09:30 = 14:30Z
 const out=aggregateBars(bars);
 assert.equal(out.fourHour.length,2);
 assert.equal(out.daily.length,1);
 assert.equal(out.fourHour[0].count,4);
 assert.equal(out.fourHour[1].count,3);
 assert.equal(out.daily[0].o,100);
 assert.equal(out.daily[0].c,107);
 assert.equal(out.daily[0].v,7000);
});
test('summer NY timezone uses DST',()=>{
 const out=aggregateBars(fixture('2026-07-13',4));
 assert.equal(out.fourHour.length,2);
 assert.equal(out.daily.length,1);
});
test('missing hour excludes incomplete 4h and daily',()=>{
 const bars=fixture('2026-01-12',5).filter((_,i)=>i!==2);
 const out=aggregateBars(bars);
 assert.equal(out.fourHour.length,1);
 assert.equal(out.daily.length,0);
});
test('duplicates and invalid OHLCV rejected',()=>{
 const bars=fixture('2026-01-12',5);
 assert.throws(()=>aggregateBars([...bars,bars[0]]),/Duplicate/);
 assert.throws(()=>aggregateBars([{...bars[0],h:1}]),/Invalid/);
});
test('after-hours excluded',()=>{
 const bars=fixture('2026-01-12',5);
 bars.push({t:'2026-01-12T23:30:00Z',o:100,h:101,l:99,c:100,v:5});
 assert.equal(aggregateBars(bars).daily[0].v,7000);
});

import {fromThirtyMinuteBars} from '../lib/learning-lab/candles.js';
test('30m Alpaca bars reconstruct complete session including 15:30 half-hour',()=>{
 const bars=Array.from({length:13},(_,i)=>{
  const localMinute=570+i*30,utcMinute=localMinute+300;
  const hour=Math.floor(utcMinute/60),minute=utcMinute%60;
  return {t:'2026-01-12T'+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':00Z',o:100+i,h:102+i,l:99+i,c:101+i,v:100};
 });
 const h=fromThirtyMinuteBars(bars),agg=aggregateBars(h);
 assert.equal(h.length,7);assert.equal(agg.fourHour.length,2);assert.equal(agg.daily.length,1);
 assert.equal(agg.daily[0].v,1300);
});
test('incomplete 30m pair is excluded',()=>{
 const bars=[
  {t:'2026-01-12T14:30:00Z',o:100,h:102,l:99,c:101,v:100},
  {t:'2026-01-12T15:30:00Z',o:101,h:103,l:100,c:102,v:100}
 ];
 assert.equal(fromThirtyMinuteBars(bars).length,0);
});
