import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
test('radar inline JS parses',()=>{assert.ok(script);assert.doesNotThrow(()=>new Script(script));});
test('stock and crypto lists expose save and remove controls',()=>{for(const id of ['saveStocks','saveCrypto','savedStocks','savedCrypto'])assert.match(html,new RegExp('id="'+id+'"'));assert.match(script,/localStorage\\.setItem/);assert.match(script,/filter\\(s=>s!==symbol\\)/);});
test('watchlist backups require format and version validation',()=>{for(const id of ['exportWatch','importWatch','importWatchFile','watchBackupStatus'])assert.match(html,new RegExp('id="'+id+'"'));assert.match(script,/data\\?\\.format!==['"]longai-watchlists['"]/);assert.match(script,/file\\.size>100000/);});
