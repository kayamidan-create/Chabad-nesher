import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {test} from 'node:test';
const source=await fs.readFile(new URL('../site/cms-api.js',import.meta.url),'utf8');
async function fixture(responses=[],saved=null){
 const storage=new Map();if(saved)storage.set('chabad-cms-session',JSON.stringify(saved));
 const calls=[];
 const context=vm.createContext({URL,Date,JSON,Boolean,Error,Promise,encodeURIComponent,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(url,opts)=>{calls.push({url,opts});const r=responses.shift();if(!r)throw new Error('Unexpected request '+url);return {ok:r.status<400,status:r.status,json:async()=>r.body};}});
 const config=new vm.SyntheticModule(['cmsConfig'],function(){this.setExport('cmsConfig',{url:'https://example.supabase.co',publishableKey:'public-test-key',bucket:'site-media'});},{context});
 const module=new vm.SourceTextModule(source,{context});await module.link(()=>config);await module.evaluate();return {api:module.namespace,calls,storage};
}
test('unsafe image protocols and paths are rejected',async()=>{
 const {api}=await fixture();for(const s of ['javascript:alert(1)','data:image/svg+xml,x','//evil.example/x','../secret'])assert.equal(api.safeImage(s),'');assert.equal(api.safeImage('assets/gallery/photo-01.webp'),'assets/gallery/photo-01.webp');
});
test('login rejects a non-admin account and clears its session',async()=>{
 const s={access_token:'test',refresh_token:'refresh',expires_at:Date.now()/1000+3600,user:{id:'user-1'}};
 const {api,storage}=await fixture([{status:200,body:s},{status:200,body:[]},{status:204}]);
 await assert.rejects(()=>api.login('test@example.test','not-a-real-password'),/הרשאת עריכה/);assert.equal(api.signedIn(),false);assert.equal(storage.size,0);
});
test('public reads explicitly filter archived and unpublished records',async()=>{
 const {api,calls}=await fixture([{status:200,body:[]},{status:200,body:[]}]);await api.list('cms_updates');await api.list('cms_gallery');assert.match(calls[0].url,/published=eq.true&archived_at=is.null/);assert.match(calls[1].url,/archived_at=is.null/);
});
test('stale edits report conflicts rather than success',async()=>{
 const {api,calls}=await fixture([{status:200,body:[]}]);await assert.rejects(()=>api.save('cms_updates',{title:'test'},{id:'record',updated_at:'2026-10-06T10:00:00+00:00'}),/השתנה בינתיים/);assert.match(calls[0].url,/updated_at=eq.2026-10-06T10%3A00%3A00%2B00%3A00/);
});
test('failed token refresh clears the session and prevents the write',async()=>{
 const {api,calls,storage}=await fixture([{status:401,body:{}}],{access_token:'expired',refresh_token:'refresh',expires_at:1,user:{id:'user-1'}});await assert.rejects(()=>api.save('cms_updates',{title:'test'}),/הכניסה פגה/);assert.equal(calls.length,1);assert.equal(storage.size,0);
});
test('other database collections cannot be modified',async()=>{
 const {api,calls}=await fixture();await assert.rejects(()=>api.save('cms_admins',{}),/Invalid collection/);assert.equal(calls.length,0);
});
