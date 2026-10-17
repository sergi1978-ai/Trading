import {get,put} from '@vercel/blob';
const KEY='paper-trading/server-state-v1.json';
export async function loadPaper(){
 const result=await get(KEY,{access:'private'});
 if(!result)return {trades:[],cursor:0,lastRun:null,checks:0};
 const response=await fetch(result.url,{headers:{Authorization:'Bearer '+process.env.BLOB_READ_WRITE_TOKEN},cache:'no-store'});
 if(!response.ok)throw Error('Blob read failed: '+response.status);
 return response.json();
}
export async function savePaper(state){
 if(!process.env.BLOB_READ_WRITE_TOKEN)throw Error('Missing Blob token');
 await put(KEY,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',cacheControlMaxAge:0});
}
