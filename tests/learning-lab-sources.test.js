import test from 'node:test';import assert from 'node:assert/strict';
import {compareDaily,parseYahooDaily} from '../lib/learning-lab/compare-sources.js';
test('comparison matches dates and flags >0.5% OHLC',()=>{
 const a=[{day:'2026-11-02',o:100,h:102,l:99,c:101,v:100}];
 const b=[{day:'2026-11-02',o:100,h:102,l:99,c:100,v:1000}];
 const out=compareDaily(a,b);assert.equal(out[0].status,'compared');
 assert.equal(out[0].difference.c,1);assert.equal(out[0].flagged,true);
 assert.equal(out[0].difference.v,-90);
});
test('missing independent day is not silently treated as a match',()=>{
 assert.equal(compareDaily([{day:'2026-11-02',o:1}],[])[0].status,'missing');
});
test('Yahoo daily parser rejects invalid response',()=>{
 assert.throws(()=>parseYahooDaily({}),/no valid daily data/);
});
