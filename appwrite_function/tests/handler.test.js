import test from 'node:test';import assert from 'node:assert/strict';import handler from '../main.js';
const res={json:(body,status=200)=>({body,status}),text:body=>({body,status:200})};
test('unconfigured storage fails explicitly',async()=>{const r=await handler({req:{path:'/get-health-data',headers:{}},res,error:()=>{}});assert.equal(r.status,503);});
test('no JWT means no private reads',async()=>{
 for(const k of ['APPWRITE_FUNCTION_API_ENDPOINT','APPWRITE_FUNCTION_PROJECT_ID','HDT_DATABASE_ID','HDT_TABLE_ID'])process.env[k]='test';
 const r=await handler({req:{path:'/get-health-data',headers:{}},res,error:()=>{}});assert.equal(r.status,401);
 for(const k of ['APPWRITE_FUNCTION_API_ENDPOINT','APPWRITE_FUNCTION_PROJECT_ID','HDT_DATABASE_ID','HDT_TABLE_ID'])delete process.env[k];
});
