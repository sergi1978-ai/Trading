import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
test('Learning Lab inline script parses and comparison controls are present',()=>{
 const html=readFileSync(new URL('../learning-lab.html',import.meta.url),'utf8');
 const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js,'inline script missing');
 assert.doesNotThrow(()=>new Script(js));
 assert.match(html,/id="tvCompare"/);
 assert.match(js,/candleData\.samples\.daily/);
});
