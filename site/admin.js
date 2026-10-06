import {configured,settings,signedIn,login,logout,requireAdmin,list,save,upload,safeImage} from './cms-api.js';
const $=id=>document.getElementById(id);
let updates=[],photos=[],editing=null,busy=false,previewUrl='';
const message=text=>{$('status').textContent=text;};
function node(tag,text,className){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
function button(text,handler){const b=node('button',text,'secondary');b.type='button';b.addEventListener('click',()=>run(handler));return b;}
async function run(fn){
  if(busy)return;busy=true;document.body.classList.add('busy');document.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=true);
  try{await fn();}catch(error){message(error instanceof TypeError?'אין חיבור לשירות השמירה. בדקו את החיבור ונסו שוב.':error.message||'הפעולה לא הושלמה.');}
  finally{busy=false;document.body.classList.remove('busy');document.querySelectorAll('button,input,textarea').forEach(x=>x.disabled=false);if(!configured())$('login-form').querySelector('button').disabled=true;}
}
function showWorkspace(){ $('login-panel').hidden=true;$('workspace').hidden=false; }
function resetForm(){editing=null;$('update-form').reset();$('update-published').checked=true;$('update-form').querySelector('button[type=submit]').textContent='שמירה ופרסום';$('update-preview').hidden=true;$('update-preview').removeAttribute('src');$('update-form-title').textContent='הוספת עדכון';if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}}
function edit(row){
  editing=row;$('update-form').reset();$('update-title').value=row.title;$('update-body').value=row.body;$('update-published').checked=row.published;
  $('update-form').querySelector('button[type=submit]').textContent=row.published?'שמירה ופרסום':'שמירת טיוטה';
  const url=safeImage(row.image_url);$('update-preview').hidden=!url;if(url)$('update-preview').src=url;
  $('update-form-title').textContent='עריכת עדכון';$('update-form').scrollIntoView({behavior:'smooth',block:'start'});$('update-title').focus();
}
function renderUpdates(){
  const host=$('update-list');host.replaceChildren();
  if(!updates.length)host.append(node('p','עדיין אין הודעות. הוסיפו את העדכון הראשון בטופס למעלה.'));
  updates.forEach(row=>{
    const card=node('article',null,'entry');card.append(node('span',row.archived_at?'בארכיון':row.published?'מפורסם באתר':'טיוטה','badge'),node('h3',row.title),node('p',row.body));
    const image=safeImage(row.image_url);if(image){const img=node('img');img.src=image;img.alt=row.title;img.loading='lazy';card.append(img);}
    const actions=node('div',null,'buttons');
    if(!row.archived_at){actions.append(button('עריכה',()=>edit(row)),button(row.published?'הסתרה מהאתר':'פרסום באתר',async()=>{await save('cms_updates',{published:!row.published},row);await refresh();message('ההודעה עודכנה באתר.');}));}
    actions.append(button(row.archived_at?'החזרה כטיוטה':'העברה לארכיון',async()=>{await save('cms_updates',{archived_at:row.archived_at?null:new Date().toISOString(),published:false},row);if(editing?.id===row.id)resetForm();await refresh();message(row.archived_at?'ההודעה הוחזרה כטיוטה.':'ההודעה הוסרה מהאתר ונשמרה בארכיון.');}));
    card.append(actions);host.append(card);
  });
}
function renderGallery(){
  const host=$('gallery-list');host.replaceChildren();
  photos.forEach(row=>{
    const card=node('article',null,'photo'),img=node('img');img.src=safeImage(row.image_url);img.alt=row.caption||'תמונה מהקהילה';img.loading='lazy';
    const label=node('label','תיאור התמונה'),input=node('input');input.value=row.caption||'';input.maxLength=200;label.append(input);card.append(img,label);
    if(row.archived_at)card.append(node('span','בארכיון','badge'));
    card.append(button('שמירת התיאור',async()=>{await save('cms_gallery',{caption:input.value.trim()},row);await refresh();message('התיאור נשמר.');}),button(row.archived_at?'החזרה לגלריה':'הסרה מהגלריה',async()=>{await save('cms_gallery',{archived_at:row.archived_at?null:new Date().toISOString()},row);await refresh();message(row.archived_at?'התמונה הוחזרה לגלריה.':'התמונה הוסרה מהגלריה ונשמרה בארכיון.');}));
    host.append(card);
  });
}
async function refresh(){await requireAdmin();[updates,photos]=await Promise.all([list('cms_updates',true),list('cms_gallery',true)]);renderUpdates();renderGallery();}
$('login-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
  if(!configured())throw new Error('הניהול עדיין לא חובר לשירות השמירה.');
  const password=$('password').value;try{await login(settings.adminEmail||$('email').value.trim(),password);}finally{$('password').value='';}
  await refresh();showWorkspace();message('התחברתם בהצלחה. אפשר לעדכן את האתר.');
});});
$('logout').addEventListener('click',()=>run(async()=>{await logout();$('workspace').hidden=true;$('login-panel').hidden=false;resetForm();updates=[];photos=[];$('update-list').replaceChildren();$('gallery-list').replaceChildren();message('יצאתם ממסך הניהול.');}));
$('refresh').addEventListener('click',()=>run(async()=>{await refresh();resetForm();message('התוכן רוענן.');}));
for(const type of ['updates','gallery'])$('tab-'+type).addEventListener('click',()=>{
  for(const t of ['updates','gallery']){$(t+'-panel').hidden=t!==type;$('tab-'+t).classList.toggle('secondary',t!==type);$('tab-'+t).setAttribute('aria-pressed',String(t===type));}
  message('');
});
$('update-cancel').addEventListener('click',resetForm);
$('update-image').addEventListener('change',()=>{
  if(previewUrl)URL.revokeObjectURL(previewUrl);
  const file=$('update-image').files[0];if(file){previewUrl=URL.createObjectURL(file);$('update-preview').src=previewUrl;$('update-preview').hidden=false;$('remove-image').checked=false;}
});
$('update-published').addEventListener('change',()=>{$('update-form').querySelector('button[type=submit]').textContent=$('update-published').checked?'שמירה ופרסום':'שמירת טיוטה';});
$('update-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
  const row={title:$('update-title').value.trim(),body:$('update-body').value.trim(),published:$('update-published').checked};
  if(!row.title||!row.body)throw new Error('מלאו כותרת ותוכן להודעה.');
  if($('remove-image').checked){row.image_url=null;row.storage_path=null;}
  const file=$('update-image').files[0];if(file){message('מעלה את התמונה…');Object.assign(row,await upload(file));}
  await save('cms_updates',row,editing);resetForm();await refresh();message(row.published?'העדכון נשמר ופורסם באתר.':'הטיוטה נשמרה. היא אינה מוצגת באתר.');
});});
$('gallery-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
  const files=Array.from($('gallery-files').files);if(!files.length)throw new Error('בחרו תמונה להעלאה.');
  if(files.length>20)throw new Error('אפשר להעלות עד 20 תמונות בכל פעם.');
  let done=0,order=photos.reduce((max,row)=>Math.max(max,row.sort_order),0)+1;
  try{for(const file of files){message(`מעלה תמונה ${done+1} מתוך ${files.length}…`);const media=await upload(file);await save('cms_gallery',{...media,caption:$('gallery-caption').value.trim()||'פעילות בבית חב״ד',sort_order:order++});done++;}}
  catch(error){throw new Error(`${done} תמונות פורסמו. ${error.message} בחרו שוב רק את התמונות שנותרו.`);}
  finally{$('gallery-files').value='';await refresh();}
  $('gallery-form').reset();message(`${done} תמונות הועלו ופורסמו בגלריה.`);
});});
if(settings.adminEmail){$('email').value=settings.adminEmail;$('email').required=false;$('email-label').hidden=true;}
if(!configured()){message('מסך הניהול מוכן, אך חיבור שירות השמירה עדיין לא הושלם.');$('login-form').querySelector('button').disabled=true;}
else if(signedIn())run(async()=>{await refresh();showWorkspace();message('');});
