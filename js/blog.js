/* veefivee blog archive - no frameworks, no keys, no external services. */
(() => {
  'use strict';
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  const search = document.getElementById('blogSearch');
  const sort = document.getElementById('blogSort');
  const categories = document.getElementById('blogCategories');
  const count = document.getElementById('blogTotal');
  const showing = document.getElementById('blogResults');
  const empty = document.getElementById('blogEmpty');
  const loadWrap = document.getElementById('blogLoadWrap');
  const loadButton = document.getElementById('blogLoadMore');
  const sentinel = document.getElementById('blogSentinel');
  const clear = document.getElementById('blogClearFilters');
  const CHUNK = 6;
  const params = new URLSearchParams(window.location.search);
  let articles = [];
  let filtered = [];
  let displayed = 0;
  let category = params.get('category') || 'all';
  let observer = null;
  let debounce = null;
  const fallback = document.getElementById('blogFallbackData');
  const escapeHTML = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attrURL = (url, type) => {
    try {
      if (typeof url !== 'string' || /^\s*(?:javascript|data):/i.test(url)) return '#';
      const base = new URL(document.baseURI);
      const parsed = new URL(url, base);
      if (parsed.origin !== base.origin) return '#';
      if (type === 'image' && !/^\/?assets\//.test(url)) return '#';
      if (type === 'post' && !/^(?:industries|blogs)\/[a-z\d/_-]+\.html(?:\?[^#]*)?$/.test(url)) return '#';
      return escapeHTML(url);
    } catch (_) { return '#'; }
  };
  const dateNumber = a => Date.parse(a.updated || a.date || '') || 0;
  const dateLabel = a => a.updated ? new Date(`${a.updated}T12:00:00`).toLocaleDateString('en-US', {month:'short', year:'numeric'}) : 'Guide';
  const categoryTitle = c => c === 'all' ? 'All stories' : c;
  const renderCard = (a, index) => {
    const href = attrURL(a.url,'post');
    const image = attrURL(a.image,'image');
    const imageLoading = index < 3 ? 'eager' : 'lazy';
    return `<article class="vf-blog-card">
      <a class="vf-blog-card-image" href="${href}" tabindex="-1" aria-hidden="true"><img src="${image}" alt="${escapeHTML(a.imageAlt || a.title)}" width="740" height="480" decoding="async" loading="${imageLoading}"><span class="vf-blog-card-category">${escapeHTML(a.category)}</span></a>
      <div class="vf-blog-card-copy"><div class="vf-blog-card-overline"><span>${escapeHTML(dateLabel(a))}</span><span class="vf-dot"></span><span>${Math.max(1,Math.min(45,Number(a.readMinutes)||7))} min read</span></div>
      <h3><a href="${href}">${escapeHTML(a.title)}</a></h3><p>${escapeHTML(a.excerpt)}</p>
      <a class="vf-blog-card-link" href="${href}" aria-label="Read: ${escapeHTML(a.title)}">Read the story <span aria-hidden="true">↗</span></a></div></article>`;
  };
  const getFilters = () => {
    const q = search.value.toLocaleLowerCase().trim();
    filtered = articles.filter(a => (category === 'all' || a.category === category) && (!q || [a.title,a.excerpt,a.category,(a.keywords||[]).join(' ')].join(' ').toLocaleLowerCase().includes(q)));
    const direction = sort.value;
    filtered.sort((a,b) => direction === 'az' ? a.title.localeCompare(b.title) : direction === 'oldest' ? dateNumber(a)-dateNumber(b) || a.title.localeCompare(b.title) : dateNumber(b)-dateNumber(a) || b.title.localeCompare(a.title));
  };
  function syncURL() {
    const url = new URL(location.href);
    url.searchParams.delete('page');
    if (search.value.trim()) url.searchParams.set('q',search.value.trim()); else url.searchParams.delete('q');
    if (category !== 'all') url.searchParams.set('category',category); else url.searchParams.delete('category');
    if (sort.value !== 'newest') url.searchParams.set('sort',sort.value); else url.searchParams.delete('sort');
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  const addChunk = () => {
    const chunk = filtered.slice(displayed, displayed + CHUNK);
    if (!chunk.length) {loadWrap.hidden=true;return;}
    grid.insertAdjacentHTML('beforeend',chunk.map((p,i)=>renderCard(p,displayed+i)).join(''));
    displayed += chunk.length;
    showing.textContent = `Showing ${displayed} of ${filtered.length} ${filtered.length === 1 ? 'story' : 'stories'}`;
    loadWrap.hidden = displayed >= filtered.length;
    if (observer && !loadWrap.hidden) observer.observe(sentinel);
  };
  const reset = () => {
    getFilters();
    grid.innerHTML='';displayed=0;
    empty.hidden=filtered.length>0;
    count.textContent = `${filtered.length} ${filtered.length===1?'story':'stories'} to explore`;
    loadWrap.hidden=true;
    if (filtered.length) addChunk(); else showing.textContent='No matching stories';
    syncURL();
  };
  const buildChips = () => {
    const names=[...new Set(articles.map(x=>x.category))].sort((a,b)=>a.localeCompare(b));
    if (category !== 'all' && !names.includes(category)) category='all';
    categories.innerHTML=['all',...names].map(x=>`<button type="button" class="vf-blog-chip${x===category?' is-active':''}" data-category="${escapeHTML(x)}" aria-pressed="${x===category}">${escapeHTML(categoryTitle(x))}</button>`).join('');
  };
  const init = list => {
    articles=list.filter(p=>p&&typeof p.title==='string'&&typeof p.category==='string'&&typeof p.url==='string'&&attrURL(p.url,'post')!=='#');
    buildChips();
    search.value=params.get('q')||'';
    if (['newest','oldest','az'].includes(params.get('sort'))) sort.value=params.get('sort');
    reset();
    if ('IntersectionObserver' in window) {
      observer=new IntersectionObserver(entries=>{
        if(entries.some(e=>e.isIntersecting)&& !loadWrap.hidden) { observer.unobserve(sentinel);addChunk(); }
      },{rootMargin:'0px 0px 350px 0px'});
      if(!loadWrap.hidden) observer.observe(sentinel);
    }
  };
  categories.addEventListener('click',e=>{
    const el=e.target.closest('button[data-category]');if(!el)return;
    category=el.dataset.category;
    [...categories.querySelectorAll('button')].forEach(btn=>{let active=btn.dataset.category===category;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',String(active));});
    reset();
  });
  search.addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(reset,150);});
  sort.addEventListener('change',reset);
  loadButton.addEventListener('click',addChunk);
  // Low-cost scroll fallback: helpful when the sentinel moves after changing filters.
  let scrollPending=false;
  window.addEventListener('scroll',()=>{
    if (loadWrap.hidden || scrollPending) return;
    scrollPending=true;
    requestAnimationFrame(()=>{
      scrollPending=false;
      if (!loadWrap.hidden && sentinel.getBoundingClientRect().top < innerHeight + 280) addChunk();
    });
  },{passive:true});
  clear.addEventListener('click',()=>{category='all';search.value='';sort.value='newest';buildChips();reset();search.focus();});
  let local=[];
  try{local=JSON.parse((fallback.textContent||'[]').replace(/<!--[^>]*-->/g,'').trim());}catch(_){}
  if(Array.isArray(local))init(local);
  // Same-origin static JSON file is the source of truth. No GitHub API keys/rate limits.
  fetch('data/blog-posts.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Index unavailable');return r.json();})
    .then(data=>{if(data&&Array.isArray(data.posts)){init(data.posts);}else throw Error('Invalid index');})
    .catch(()=>{/* Site still works from embedded, generator-produced fallback while offline. */});
})();
