import {cmsConfig as config} from './cms-config.js';
const KEY='chabad-cms-session';
let session;
try { session=JSON.parse(sessionStorage.getItem(KEY)||'null'); } catch { session=null; }
let refreshing;
export const configured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)&&Boolean(config.publishableKey);
export const settings=config;
function keep(value){session=value; if(value)sessionStorage.setItem(KEY,JSON.stringify(value));else sessionStorage.removeItem(KEY);}
export function signedIn(){return Boolean(session?.access_token);}
async function decode(response){
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const error=new Error(response.status===401?'הכניסה פגה. יש להתחבר מחדש.':response.status===403?'אין לחשבון הזה הרשאת עריכה.':'לא ניתן להשלים את הפעולה כרגע. נסו שוב.');
    error.status=response.status; throw error;
  }
  return data;
}
async function token(){
  if(!session)return config.publishableKey;
  if(session.expires_at*1000>Date.now()+60000)return session.access_token;
  if(!refreshing)refreshing=(async()=>{
    try{ const response=await fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});keep(await decode(response)); }
    catch(error){keep(null);throw error;}finally{refreshing=null;}
  })();
  await refreshing;return session.access_token;
}
async function request(path, options={}){
  if(!configured())throw new Error('הניהול עדיין לא חובר לשירות השמירה.');
  const access=await token();
  const authHeaders=session?{Authorization:'Bearer '+access}:{};
  const response=await fetch(config.url+path,{...options,headers:{apikey:config.publishableKey,...authHeaders,...options.headers}});
  if(response.status===204)return null;
  return decode(response);
}
export async function login(email,password){
  const response=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!response.ok)throw new Error(response.status===429?'בוצעו ניסיונות רבים. המתינו מעט ונסו שוב.':'הפרטים אינם נכונים או שהכניסה אינה זמינה.');
  keep(await response.json());
  try{await requireAdmin();}catch(error){await logout();throw error;}
}
export async function requireAdmin(){
  if(!session)throw new Error('יש להתחבר תחילה.');
  const rows=await request('/rest/v1/cms_admins?select=user_id&user_id=eq.'+encodeURIComponent(session.user.id));
  if(!rows?.length)throw new Error('אין לחשבון הזה הרשאת עריכה.');
}
export async function logout(){try{if(session)await request('/auth/v1/logout',{method:'POST'});}finally{keep(null);}}
export async function list(table,admin=false){
  if(!['cms_updates','cms_gallery'].includes(table))throw new Error('Invalid collection');
  const filter=admin?'':table==='cms_updates'?'&published=eq.true&archived_at=is.null':'&archived_at=is.null';
  return request('/rest/v1/'+table+'?select=*'+filter+'&order='+ (table==='cms_updates'?'created_at.desc':'sort_order.asc,created_at.asc'));
}
export async function save(table,row,existing){
  if(!['cms_updates','cms_gallery'].includes(table))throw new Error('Invalid collection');
  let path='/rest/v1/'+table;
  if(existing)path+='?id=eq.'+encodeURIComponent(existing.id)+'&updated_at=eq.'+encodeURIComponent(existing.updated_at);
  const result=await request(path,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});
  if(!result?.length)throw new Error('התוכן השתנה בינתיים במכשיר אחר. רעננו ונסו שוב.');
  return result[0];
}
export async function upload(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('בחרו תמונת JPG, PNG או WebP. באייפון ניתן לייצא תמונת JPG.');
  if(file.size>20*1024*1024)throw new Error('התמונה גדולה מדי. בחרו תמונה עד 20MB.');
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('לא ניתן לקרוא את התמונה. נסו קובץ JPG אחר.');});
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
  if(!blob)throw new Error('לא ניתן להכין את התמונה להעלאה.');
  const path='uploads/'+crypto.randomUUID()+'.jpg';
  await request('/storage/v1/object/'+config.bucket+'/'+path,{method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false'},body:blob});
  return {image_url:config.url+'/storage/v1/object/public/'+config.bucket+'/'+path,storage_path:path};
}
export function safeImage(value){
  if(typeof value!=='string')return '';
  if(/^assets\/gallery\/photo-\d{2}\.webp$/.test(value))return value;
  try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}
}
