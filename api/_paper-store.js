import {get,put} from '@vercel/blob';
const KEY='paper-trading/server-state-v1.json';
export async function loadPaper(){
 const result=await get(KEY,{access:'private',useCache:false});
 if(!result)return {trades:[],cursor:0,lastRun:null,checks:0};
 if(result.statusCode!==200||!result.stream)throw Error('Blob read failed: '+result.statusCode);
 return new Response(result.stream).json();
}
export async function savePaper(state){
 if(!process.env.BLOB_READ_WRITE_TOKEN)throw Error('Missing Blob token');
 await put(KEY,JSON.stringify(state),{access:'private',addRandomSuffix:false,overwrite:true,contentType:'application/json',cacheControlMaxAge:0});
}
