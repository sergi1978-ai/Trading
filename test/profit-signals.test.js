import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProfitSignals} from '../lib/profit-signals.js';
import {PROFIT_STRATEGIES} from '../lib/profit-simulator.js';
const DAY=86400000,H=3600000,start=Date.parse('2026-01-01T00:00:00Z');
const make=(count,step,unit,startPrice=100)=>Array.from({length:count},(_,i)=>{
 const p=startPrice+i*.03;
 return {t:new Date(start+i*step).toISOString(),endExclusive:new Date(start+(i+1)*step).toISOString(),
 o:p,h:p+.2,l:p-.1,c:p+.1,v:2000};
});
function fixture(){return {symbol:'BTC-USD',market:'CRYPTO',
 hourly:make(2200,H,1),fourHour:make(550,4*H,1),daily:make(92,DAY,1)};}
test('no signal without approved volume source, regardless of optimistic history',()=>{
 const r=generateProfitSignals({...fixture()});
 assert.equal(r.signals.length,0);assert.equal(r.diagnostics.reason,'VOLUME_FEED_UNVERIFIED');
});
test('signals must be only independent named strategies with 1H close timestamps',()=>{
 const f=fixture();const r=generateProfitSignals({...f,volumeApproved:true});
 assert.deepEqual(Object.keys(r.counts),PROFIT_STRATEGIES);
 for(const s of r.signals){
   assert.ok(PROFIT_STRATEGIES.includes(s.strategyId));
   assert.ok(f.hourly.some(b=>b.endExclusive===s.signalTime));
   assert.ok(s.closedContext.fourEnd<=s.signalTime);
   assert.ok(s.closedContext.dayEnd<=s.signalTime);
   assert.ok(s.entryTrigger>s.initialStop);
 }
});
test('malformed OHLCV and overlapping bars are rejected, not repaired',()=>{
 const f=fixture();
 assert.throws(()=>generateProfitSignals({...f,volumeApproved:true,
   hourly:[...f.hourly.slice(0,3),f.hourly[2],...f.hourly.slice(3)]}),/Invalid closed candles/);
});
test('signal generation is stable with identical data and settings',()=>{
 const f=fixture();
 const a=generateProfitSignals({...f,volumeApproved:true});
 const b=generateProfitSignals({...f,volumeApproved:true});
 assert.deepEqual(a,b);
});

test('breakout funnel counts ordered stages but does not generate fictitious READY',()=>{
 const r=generateProfitSignals({...fixture(),volumeApproved:true});
 const d=r.diagnostics.breakoutFunnel;
 assert.ok(d.eligibleHourBars>=d.hasBreakoutInPrevious6FourHour);
 assert.ok(d.hasBreakoutInPrevious6FourHour>=d.favorableDailyAndFourHour);
 assert.ok(d.favorableDailyAndFourHour>=d.retestZoneTouched);
 assert.ok(d.retestZoneTouched>=d.bullishHourAndVolume);
 assert.equal(d.riskQualifiedSignals,r.counts.BREAKOUT_RETEST);
});
