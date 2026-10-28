import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pine=readFileSync(new URL('../pine/LONG_AI_PROFIT_v1_4_LAB.pine',import.meta.url),'utf8');
test('Pine v6 1H standard candles only, crypto only until RTH parity',()=>{
  assert.ok(pine.startsWith('//@version=6'));
  assert.match(pine,/timeframe\.in_seconds\(\) != 3600/);
  assert.match(pine,/chart\.is_standard/);
  assert.match(pine,/if not crypto[\s\S]*runtime\.error/);
});
test('separate A reclaim, B breakout retest and C continuation engines',()=>{
  for(const s of ['A · RETROCES','B · RUPTURA-RETEST','C · CONTINUACIO']) assert.ok(pine.includes(s));
  assert.match(pine,/bool signalA =/);
  assert.match(pine,/bool signalB =/);
  assert.match(pine,/bool signalC =/);
  assert.match(pine,/bool routeSignal = route/);
});
test('MTF close values are offset; no unoffset lookahead in source',()=>{
  const sections=[...pine.matchAll(/request\.security\([\s\S]*?lookahead=barmerge\.lookahead_on\)/g)];
  assert.ok(sections.length>=4);
  assert.match(pine,/\[close\[1\],ta\.ema\(close,20\)\[1\]/);
  assert.match(pine,/p\[1\],m\[1\],a\[1\]/);
  assert.match(pine,/h\[1\],h\[2\]/);
  assert.match(pine,/barstate\.isconfirmed and routeSignal/);
});
test('risk cap and non-chasing stop limit, with expiry and no same-bar signal fill',()=>{
  assert.match(pine,/riskFraction = 0\.005/);
  assert.match(pine,/allocationCap = 0\.25/);
  assert.match(pine,/riskFraction\/perUnit/);
  assert.match(pine,/dist\/candidateTrigger<=0\.10/);
  assert.match(pine,/strategy\.entry\("LONG",strategy\.long,qty=qty,stop=trigger,limit=trigger\+\.2\*fAtr/);
  assert.match(pine,/bar_index-placedAt>=lifeBars/);
  assert.match(pine,/strategy\.cancel\("LONG"\)/);
});
test('two reserved protective bracket quantities and profit-only trailing',()=>{
  assert.match(pine,/sizeHalf:=qty\*\.5/);
  assert.match(pine,/sizeOther:=qty-sizeHalf/);
  assert.match(pine,/qty=sizeHalf,stop=stop,limit=target1/);
  assert.match(pine,/qty=sizeOther,stop=stop,limit=target2/);
  assert.match(pine,/exit_comment\(k\)=="TP1_PROFIT"/);
  assert.match(pine,/if firstTargetFilled and barstate\.isconfirmed/);
  assert.doesNotMatch(pine,/strategy\.exit\([^\n]*qty_percent/);
});
test('time stop, impulse failure, position residue cleanup, and reentry cooldown',()=>{
  assert.match(pine,/time>=entryEpoch\+7\*86400000/);
  assert.match(pine,/time>=entryEpoch\+3\*86400000/);
  assert.match(pine,/strategy\.position_size\*close<1/);
  assert.match(pine,/bar_index-lastClosedBar<8/);
});
test('diagnostic blocked-bar funnel and separately labeled real stop/TP legs',()=>{
  for(const x of ['rejectedRegime','rejectedSetup','rejectedRisk','strategy.closedtrades.exit_comment','STOP_1','STOP_2','TP1_PROFIT','TP2_PROFIT'])assert.ok(pine.includes(x));
});
test('C is a separate compression breakout, not former Early Expansion strategy',()=>{
  assert.match(pine,/compressedBase =/);
  assert.match(pine,/bool cImpulse =/);
  assert.doesNotMatch(pine,/EARLY_EXPANSION/);
});
