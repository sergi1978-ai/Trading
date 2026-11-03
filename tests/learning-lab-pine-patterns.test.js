import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePatterns} from '../lib/learning-lab/pine-patterns.js';
function fixture(){const bars=Array.from({length:60},(_,i)=>({t:String(i),o:100,h:102,l:99,c:101,v:100}));
 const indicators=bars.map(()=>({ema20:100,ema50:99,rsi14:55,atr14:2,macdHistogram:0.5}));
 return {bars,indicators};}
test('rejects insufficient history and never creates trade signals',()=>{
 const {bars,indicators}=fixture();
 assert.equal(evaluatePatterns(bars.slice(0,10),indicators.slice(0,10)).status,'insufficient_history');
});
test('detects a closed-bar breakout A and E without claiming volume confirmation',()=>{
 const {bars,indicators}=fixture();bars[59]={...bars[59],o:101,h:106,l:100,c:105};
 indicators[59]={...indicators[59],rsi14:60,macdHistogram:0.8};
 const r=evaluatePatterns(bars,indicators);
 assert.equal(r.motors.A.breakout,true);assert.equal(r.motors.E.breakout,true);
 assert.equal(r.motors.E.pattern,null);assert.equal(r.motors.F.pattern,null);
 assert.equal(r.status,'partial_patterns_only');
});
test('C retest is unresolved rather than guessed',()=>{
 const {bars,indicators}=fixture();const r=evaluatePatterns(bars,indicators);
 assert.equal(r.motors.C.retest,null);assert.equal(r.motors.C.pattern,null);
});
