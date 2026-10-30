/* Homepage journal: optional progressive enhancement from GitHub Pages JSON.
   The three accessible HTML cards remain usable if network fetching fails. */
(() => {
  'use strict';
  const grid = document.getElementById('homeJournalGrid');
  if (!grid || !window.fetch) return;
  const safeUrl = (s,kind) => typeof s === 'string' && (kind === 'image' ? /^assets\/[a-z0-9_.\/-]+\.(?:png|jpe?g|webp|avif)$/i : /^(industries|blogs)\/[a-z0-9_\/-]+\.html$/i).test(s) ? s : null;
  const create = (tag,cls,text) => { const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; };
  const make = (post) => {
    const href=safeUrl(post.url,'post'), src=safeUrl(post.image,'image');
    if(!href || !src || !post.title) return null;
    const article=create('article','vf-home-journal-card');
    const media=create('a','vf-home-journal-image');media.href=href;media.setAttribute('aria-label','Read '+post.title);
    const img=create('img');img.src=src;img.alt=post.imageAlt||post.title;img.loading='eager';img.decoding='async';img.width=740;img.height=480;media.append(img);
    const copy=create('div','vf-home-journal-copy');
    const tag=create('span','vf-home-journal-tag',(post.category||'Insights')+' · '+(Math.max(1,Math.min(45,Number(post.readMinutes)||6)))+' min read');
    const heading=create('h3');const name=create('a',null,post.title);name.href=href;heading.append(name);
    const excerpt=create('p',null,post.excerpt||'Thoughtful ideas and practical advice for what comes next.');
    const link=create('a','vf-home-journal-read','Read the story ↗');link.href=href;
    copy.append(tag,heading,excerpt,link);article.append(media,copy);return article;
  };
  fetch('data/blog-posts.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(data=>{
    if(!data || !Array.isArray(data.posts) || !data.posts.length) return;
    const latest=data.posts.slice().sort((a,b)=>String(b.updated||b.date||'').localeCompare(String(a.updated||a.date||''))).slice(0,3);
    const fragment=document.createDocumentFragment();let count=0;
    for(const post of latest){const card=make(post);if(card){fragment.append(card);count++;}}
    if(count===3) grid.replaceChildren(fragment);
  }).catch(()=>{});
})();
