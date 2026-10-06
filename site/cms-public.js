import {configured,list,safeImage} from './cms-api.js';
function element(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
async function load(){
  if(!configured())return;
  const admin=element('a','ניהול האתר');admin.href='admin.html';admin.setAttribute('aria-label','כניסה לניהול האתר');admin.style.cssText='position:fixed;left:0;top:48%;z-index:6;background:#71533a;color:white;padding:12px 10px;border-radius:0 8px 8px 0;font-size:14px;box-shadow:0 3px 12px #0002';document.body.append(admin);
  // Keep the last deployed content on network errors. An empty successful result
  // is intentional and must not resurrect archived content.
  const results=await Promise.allSettled([list('cms_updates'),list('cms_gallery')]);
  if(results[0].status==='fulfilled'){
    const grid=document.querySelector('#updates .updates-grid');grid.replaceChildren();
    if(!results[0].value.length)grid.append(element('p','עדכונים חדשים יפורסמו כאן בקרוב.','lead'));
    results[0].value.forEach(row=>{
      const article=element('article',null,'card update-card'),body=element('div',null,'update-body');
      const image=safeImage(row.image_url);if(image){const img=element('img');img.src=image;img.alt=row.title;img.loading='lazy';img.style.cssText='width:100%;max-height:360px;object-fit:contain;display:block';article.append(img);}
      const p=element('p',row.body);p.style.whiteSpace='pre-wrap';body.append(element('span','עדכון מבית חב״ד','update-tag'),element('h3',row.title),p);article.append(body);grid.append(article);
    });
  }
  if(results[1].status==='fulfilled'){
    const gallery=document.querySelector('#gallery .gallery');gallery.replaceChildren();
    results[1].value.forEach(row=>{const image=safeImage(row.image_url);if(!image)return;const b=element('button',null,'gallery-item');b.type='button';const img=element('img');img.src=image;img.alt=row.caption||'פעילות בבית חב״ד';img.loading='lazy';b.append(img);gallery.append(b);});
    if(!results[1].value.length)gallery.append(element('p','תמונות חדשות יפורסמו כאן בקרוב.'));
  }
}
load().catch(()=>{});
