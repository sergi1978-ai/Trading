// Durable paper trading storage via Upstash Redis REST. Never store tokens in browser.
export async function kv(command) {
 const url=process.env.PAPER_REDIS_REST_URL, token=process.env.PAPER_REDIS_REST_TOKEN;
 if(!url||!token)throw Error('MISSING_PAPER_REDIS');
 const res=await fetch(url.replace(/\/$/,'') ,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command)});
 if(!res.ok)throw Error('Redis HTTP '+res.status);
 const data=await res.json();if(data.error)throw Error('Redis: '+data.error);
 return data.result;
}
export async function loadPaper(){
 const raw=await kv(['GET','trading2026:paper:v1']);
 if(!raw)return {trades:[],cursor:0,lastRun:null,checks:0};
 try{return JSON.parse(raw)}catch(_){throw Error('Paper storage corrupt: refusing overwrite')}
}
export async function savePaper(v){return kv(['SET','trading2026:paper:v1',JSON.stringify(v)])}
