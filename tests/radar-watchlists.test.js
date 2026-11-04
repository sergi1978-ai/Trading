import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];

test('radar inline JavaScript parses',()=>{
 assert.ok(script,'inline script missing');
 assert.doesNotThrow(()=>new Script(script));
});

test('stock and crypto watchlists expose save and remove controls',()=>{
 for(const id of ['saveStocks','saveCrypto','savedStocks','savedCrypto'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(script.includes('localStorage.setItem'));
 assert.ok(script.includes('filter(s=>s!==symbol)'));
});

test('watchlist backups validate format, size and both lists',()=>{
 for(const id of ['exportWatch','importWatch','importWatchFile','watchBackupStatus'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(script.includes("data?.format!=='longai-watchlists'"));
 assert.ok(script.includes('file.size>100000'));
 assert.ok(script.includes("validate(data.stocks,'stock')"));
 assert.ok(script.includes("validate(data.crypto,'crypto')"));
});
