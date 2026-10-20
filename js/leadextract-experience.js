/* veefivee LeadExtract — empty-first studio experience, no external requests. */
(() => {
  'use strict';
  const results = () => document.querySelectorAll('[data-results-only]');
  const suggest = (query) => {
    const q=query.replace(/\s+/g,' ').trim();
    const parsed=q.match(/^(.+?)\s+(?:in|near|around)\s+(.+)$/i);
    if (!parsed) return [`${q} owners`,`${q} contact information`,`${q} with websites`];
    const industry=parsed[1].trim(), location=parsed[2].trim();
    return [`${industry} near ${location}`,`locally owned ${industry} in ${location}`,`${industry} with booking sites in ${location}`];
  };
  let started=false;
  const buttons=['btnExtractCsvHero','btnExtractCsvToolbar','btnExportCsvTop','btnExportCsvMobileProxy','btnPreviewCsvModal'];
  const sync=()=>{
    for (const id of buttons) {let b=document.getElementById(id);if(b){b.disabled=!started;b.setAttribute('aria-disabled',String(!started));}}
    const save=document.getElementById('btnSaveAllCurrent');if(save){save.disabled=!started;save.setAttribute('aria-disabled',String(!started));}
  };
  window.addEventListener('DOMContentLoaded', () => {
    sync();
    const input=document.getElementById('searchQueryInput');
    if(input)input.addEventListener('input',()=>input.removeAttribute('aria-invalid'));
    const chips=document.getElementById('relatedSearchChips');
    chips?.addEventListener('click',e=>{
      const button=e.target.closest('button[data-search]');
      if(!button)return;
      input.value=button.dataset.search;
      document.getElementById('btnRunScrape')?.click();
      document.getElementById('viewLeadEngine')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  });
  window.addEventListener('vf:leadsearch',e=>{
    started=true;sync();
    results().forEach(el=>el.removeAttribute('data-results-only'));
    const empty=document.getElementById('leadEmptyState');if(empty)empty.hidden=true;
    const related=document.getElementById('relatedSearches');if(related)related.hidden=false;
    const chips=document.getElementById('relatedSearchChips');
    if(chips){chips.replaceChildren();
      suggest(e.detail.query).forEach(q=>{
        const b=document.createElement('button');b.type='button';b.className='vf-related-chip';b.dataset.search=q;b.textContent=q;chips.appendChild(b);
      });
    }
  });
})();
