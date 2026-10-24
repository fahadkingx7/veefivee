/* LeadExtract: source-backed public business research. No generated contacts. */
(() => {
  'use strict';
  const P = window.LeadExtractParser;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'veefivee_public_contacts_v1';
  const state = {mode: 'discover', results: [], saved: [], controller: null, busy: false, log: [], readerBlocked: false};
  const clean = value => String(value || '').trim();
  const unique = values => [...new Set(values.filter(Boolean))];
  const countLabel = (count, singular, plural = singular + 's') => count + ' ' + (count === 1 ? singular : plural);
  const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
  const key = business => business.sourceUrl || business.website || business.id;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

  function safeLink(url, text, className) {
    const safe = P.validatePublicUrl(url);
    if (!safe) return el('span', className, text);
    const a = el('a', className, text);
    a.href = safe; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }
  function notify(message, tone = 'info') {
    $('searchStatus').hidden = false; $('searchStatus').dataset.tone = tone;
    $('statusText').textContent = message;
  }
  function log(message, url) {
    state.log.push({message, url});
    if (state.log.length > 150) state.log.shift();
    const li = el('li', '', message);
    if (url) { li.append(' ', safeLink(url, 'Source ↗')); }
    $('logEntries').append(li);
    while ($('logEntries').children.length > 150) $('logEntries').firstChild.remove();
  }
  function loadSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      // A separate schema/key prevents the former demo's synthetic vault entering live results.
      if (Array.isArray(data)) state.saved = data.filter(item => item && item.version === 1 && P.validatePublicUrl(item.sourceUrl || item.website)).slice(0, 100).map(item => {
        const strings = {};
        ['name', 'website', 'sourceUrl', 'address', 'status', 'checkedAt'].forEach(field => { strings[field] = typeof item[field] === 'string' ? item[field].slice(0, 2000) : ''; });
        const people = (Array.isArray(item.people) ? item.people : []).filter(p => p && typeof p.name === 'string' && P.validatePublicUrl(p.sourceUrl)).slice(0, 100).map(p => {
          const person = {};
          ['name', 'role', 'email', 'phone', 'sourceUrl', 'evidence', 'emailSourceUrl', 'phoneSourceUrl'].forEach(field => { person[field] = typeof p[field] === 'string' ? p[field].slice(0, 2000) : ''; });
          return person;
        });
        return makeBusiness(Object.assign(strings, {people, emails: contacts(item.emails), phones: contacts(item.phones), sources: (Array.isArray(item.sources) ? item.sources : []).filter(url => typeof url === 'string' && P.validatePublicUrl(url))}));
      });
    } catch (_) { state.saved = []; }
  }
  function toggleSave(business) {
    const id = key(business);
    const next = state.saved.filter(item => key(item) !== id);
    const wasSaved = next.length !== state.saved.length;
    if (!wasSaved) {
      if (next.length >= 100) { notify('The saved list holds 100 businesses. Remove a saved entry before adding another.', 'error'); return; }
      next.push(JSON.parse(JSON.stringify(business)));
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); state.saved = next; render(); }
    catch (_) { notify('Browser storage is unavailable or full. Your current results can still be exported.', 'error'); }
  }
  function contacts(list) {
    return Array.isArray(list) ? list.filter(item => item && typeof item.value === 'string' && P.validatePublicUrl(item.sourceUrl)) : [];
  }
  function contactLine(label, value, sourceUrl) {
    const line = el('p', 'le-contact-line');
    line.append(el('strong', '', label + ': '), document.createTextNode(value || 'Not published'));
    if (value && sourceUrl) line.append(safeLink(sourceUrl, 'source ↗', 'le-source-link'));
    return line;
  }
  function renderCard(business) {
    const card = el('article', 'le-card');
    const head = el('div', 'le-card-head');
    head.append(el('h3', '', business.name || host(business.website) || 'Business website'));
    const save = el('button', 'le-save', state.saved.some(item => key(item) === key(business)) ? 'Saved ✓' : 'Save');
    save.type = 'button'; save.setAttribute('aria-pressed', String(state.saved.some(item => key(item) === key(business))));
    save.disabled = state.busy;
    if (state.busy) save.title = 'Save after research finishes or is stopped.';
    save.setAttribute('aria-label', 'Save ' + (business.name || host(business.website)));
    save.addEventListener('click', () => toggleSave(business)); head.append(save); card.append(head);
    if (business.website) card.append(safeLink(business.website, host(business.website) + ' ↗', 'le-website'));
    if (business.address) card.append(el('p', 'le-address', business.address));
    card.append(el('p', 'le-card-status', business.status || 'Public source found'));
    const people = Array.isArray(business.people) ? business.people : [];
    if (!people.length) card.append(el('p', 'le-missing', 'No named team member found in the sources checked.'));
    people.forEach(person => {
      const panel = el('section', 'le-person');
      panel.append(el('h4', '', person.name), el('p', 'le-role', person.role || 'Named on the business website'));
      panel.append(contactLine('Person’s email', person.email, person.emailSourceUrl || person.sourceUrl));
      panel.append(contactLine('Person’s phone', person.phone, person.phoneSourceUrl || person.sourceUrl));
      const evidence = el('details', 'le-evidence');
      evidence.append(el('summary', '', 'Why this person is listed'));
      evidence.append(el('p', '', clean(person.evidence).slice(0, 700)));
      evidence.append(safeLink(person.sourceUrl, 'Open the original page ↗'));
      panel.append(evidence); card.append(panel);
    });
    const contactSection = el('section', 'le-contact-section');
    contactSection.append(el('h4', '', 'Website / listing contacts'));
    const emails = contacts(business.emails), phones = contacts(business.phones);
    if (!emails.length && !phones.length) contactSection.append(el('p', 'le-missing', 'No published phone or email found.'));
    emails.forEach(item => contactSection.append(contactLine('Email', item.value, item.sourceUrl)));
    phones.forEach(item => contactSection.append(contactLine('Phone', item.value, item.sourceUrl)));
    if (emails.length || phones.length) contactSection.append(el('p', 'le-missing', 'These may be shared business contacts, not a named person’s direct details.'));
    card.append(contactSection);
    const sources = el('div', 'le-sources');
    sources.append(el('strong', '', 'Sources checked'));
    const list = el('ul');
    unique(business.sources || []).forEach(url => { const li = el('li'); li.append(safeLink(url, url)); list.append(li); });
    sources.append(list); card.append(sources);
    return card;
  }
  function visibleResults() {
    const input = $('resultFilter').value.trim().toLowerCase();
    const source = $('savedOnly').checked ? state.saved : state.results;
    return source.filter(b => !input || [b.name, b.website, ...(b.people || []).map(p => p.name + ' ' + p.role)].join(' ').toLowerCase().includes(input));
  }
  function render() {
    const list = visibleResults();
    const people = list.reduce((n, b) => n + (b.people || []).length, 0);
    $('resultCount').textContent = countLabel(list.length, 'business', 'businesses') + ' · ' + countLabel(people, 'named person', 'named people') + ' · ' + state.saved.length + ' saved';
    $('exportCsv').disabled = !list.length;
    const fragment = document.createDocumentFragment();
    if (!list.length) {
      const empty = el('div', 'le-empty');
      empty.append(el('h3', '', state.busy ? 'Checking public sources…' : 'No results to show yet.'));
      empty.append(el('p', '', $('savedOnly').checked ? 'Save a business from your results to keep it here.' : 'Try a business search or add website URLs. Results appear as public sources are read.'));
      fragment.append(empty);
    } else list.forEach(b => fragment.append(renderCard(b)));
    $('businessResults').replaceChildren(fragment);
  }
  function setMode(mode, focus) {
    if (state.busy) return;
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === mode;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      $('panel-' + button.dataset.mode).hidden = !selected;
      if (selected && focus) button.focus();
    });
    $('resultLimitField').hidden = mode !== 'discover';
    $('pageLimitField').hidden = mode === 'paste';
    $('runSearch').textContent = mode === 'paste' ? 'Extract published contacts ↗' : 'Find public contacts ↗';
  }
  function setBusy(busy) {
    state.busy = busy;
    $('runSearch').disabled = busy; $('stopSearch').hidden = !busy;
    document.querySelectorAll('#leadSearchForm input, #leadSearchForm textarea, #leadSearchForm select, [data-mode]').forEach(node => { node.disabled = busy; });
    $('searchProgress').hidden = !busy;
  }
  function makeBusiness(data) {
    return Object.assign({version: 1, name: '', website: '', sourceUrl: '', people: [], emails: [], phones: [], sources: [], status: '', checkedAt: new Date().toISOString()}, data);
  }
  function merge(business, parsed, sourceUrl) {
    if (parsed.businessName && (!business.name || business.name === host(business.website))) business.name = parsed.businessName;
    for (const field of ['emails', 'phones']) {
      const compare = value => field === 'emails' ? value.toLowerCase() : value.replace(/\D/g, '');
      parsed[field].forEach(item => {
        if (!business[field].some(existing => compare(existing.value) === compare(item.value))) business[field].push(item);
      });
    }
    parsed.people.forEach(person => {
      const existing = business.people.find(p => p.name.toLocaleLowerCase() === person.name.toLocaleLowerCase());
      if (!existing) business.people.push(person);
      else {
        if (!existing.role && person.role) existing.role = person.role;
        for (const field of ['email', 'phone']) {
          if (!existing[field] && person[field]) { existing[field] = person[field]; existing[field + 'SourceUrl'] = person[field + 'SourceUrl'] || person.sourceUrl; }
        }
      }
    });
    // Repeated details across different people are shared contacts, even when
    // those people were found on separate pages in this run.
    for (const field of ['email', 'phone']) {
      const normalized = value => field === 'email' ? value.toLowerCase() : value.replace(/\D/g, '');
      const counts = new Map();
      for (const person of business.people) if (person[field]) {
        const value = normalized(person[field]); counts.set(value, (counts.get(value) || 0) + 1);
      }
      business.sharedContacts = business.sharedContacts || {email: [], phone: []};
      business.sharedContacts[field] = unique([...business.sharedContacts[field], ...[...counts].filter(([, n]) => n > 1).map(([value]) => value)]);
      for (const person of business.people) if (person[field] && business.sharedContacts[field].includes(normalized(person[field]))) {
        person[field] = ''; person[field + 'SourceUrl'] = '';
      }
    }
    business.sources = unique([...business.sources, sourceUrl]);
    business.checkedAt = new Date().toISOString();
  }
  function relatedPages(parsed, startingUrl) {
    return parsed.links.filter(link => P.validatePublicUrl(link.url) && host(link.url) === host(startingUrl) && /(?:contact|about|team|staff|people|leadership|founder|owner|our-story|meet-|management)/i.test(link.label + ' ' + new URL(link.url).pathname))
      .sort((a, b) => Number(/team|staff|people|leadership|founder/i.test(b.url + b.label)) - Number(/team|staff|people|leadership|founder/i.test(a.url + a.label)))
      .map(link => link.url);
  }
  async function enrich(business, source, limit, signal, budget, research) {
    if (!business.website) { business.status = 'Public listing found; no website listed to check for people.'; return; }
    const queue = [business.website], visited = new Set();
    let read = 0, failed = 0;
    while (queue.length && visited.size < limit && budget.left > 0) {
      if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url); budget.left--;
      try {
        const page = await source.readPage(url, {signal});
        const parsed = P.parsePage({url: page.sourceUrl || page.url, html: page.html, text: page.text});
        merge(business, parsed, page.sourceUrl || page.url);
        read++; research.pagesRead++; log('Read public page', url);
        relatedPages(parsed, business.website).forEach(link => { if (!visited.has(link) && !queue.includes(link)) queue.push(link); });
      } catch (error) {
        if (signal.aborted || error.code === 'ABORTED' || error.name === 'AbortError') throw error;
        failed++; research.pagesFailed++; log(error.message, url);
        if (error.code === 'RATE_LIMIT') { state.readerBlocked = true; business.status = 'Website reader limit reached; partial results retained.'; throw error; }
      }
      business.status = read + ' website page' + (read === 1 ? '' : 's') + ' read' + (failed ? '; ' + failed + ' unavailable.' : '.');
      render();
    }
    if (!read) business.status = 'Website could not be read. Try its contact/team URL or Paste a page.';
    else if (!budget.left && queue.length) business.status += ' Run page limit reached.';
  }
  function inputSettings() {
    const settings = {mode: state.mode, pages: Number($('pageLimit').value), limit: Number($('resultLimit').value)};
    if (state.mode === 'discover') {
      settings.category = $('businessCategory').value; settings.city = $('businessCity').value.trim(); settings.region = $('businessRegion').value.trim();
      if (!settings.city) { $('businessCity').focus(); throw new Error('Enter a city or town to search.'); }
    } else if (state.mode === 'websites') {
      const lines = $('websiteUrls').value.split(/\r?\n/).map(clean).filter(Boolean);
      if (!lines.length || lines.length > 10) throw new Error('Enter 1–10 public website URLs, one per line.');
      settings.urls = unique(lines.map(raw => {
        const url = P.validatePublicUrl(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
        if (!url) throw new Error('Use public http:// or https:// URLs without credentials or local addresses: ' + raw.slice(0, 100));
        return url;
      }));
    } else {
      settings.url = P.validatePublicUrl($('pasteSource').value.trim()); settings.content = $('pasteContent').value.trim();
      if (!settings.url) throw new Error('Enter the original public page URL so contacts can be attributed.');
      if (!settings.content) throw new Error('Paste the public page text or HTML to extract.');
      if (settings.content.length > 1000000) throw new Error('Paste a smaller page (under one million characters).');
    }
    return settings;
  }
  async function run(event) {
    event.preventDefault();
    if (state.busy) return;
    let settings;
    try { settings = inputSettings(); } catch (error) { notify(error.message, 'error'); return; }
    state.results = []; state.log = []; state.readerBlocked = false;
    $('savedOnly').checked = false; $('resultFilter').value = ''; $('logEntries').replaceChildren();
    state.controller = new AbortController(); const signal = state.controller.signal;
    setBusy(true); render(); notify('Starting your public contact research…', 'busy');
    let stopped = false, failure = '';
    const research = {pagesRead: 0, pagesFailed: 0};
    try {
      const source = window.LeadExtractSources.create({onStatus: info => { notify(info.message, 'busy'); }});
      if (settings.mode === 'paste') {
        const business = makeBusiness({name: host(settings.url), website: settings.url, sourceUrl: settings.url});
        const html = /<\/?[a-z][\s\S]*>/i.test(settings.content) ? settings.content : '';
        merge(business, P.parsePage({url: settings.url, html, text: html ? '' : settings.content}), settings.url);
        business.status = 'Extracted from user-pasted page content; live source not verified.';
        state.results.push(business); log('Parsed pasted content locally; original URL supplied by you.', settings.url);
      } else {
        if (settings.mode === 'discover') {
          const listings = await source.discover({category: settings.category, city: settings.city, region: settings.region, limit: settings.limit, signal});
          const seen = new Set();
          state.results = listings.filter(b => {
            const id = (b.website ? host(b.website) : b.sourceUrl) + '|' + b.name.toLowerCase() + '|' + b.address;
            if (seen.has(id)) return false; seen.add(id); return true;
          }).map(b => makeBusiness(Object.assign({}, b, {status: 'Public listing found; website check pending.'})));
          log('Found ' + state.results.length + ' matching OpenStreetMap listings.');
        } else state.results = settings.urls.map(url => makeBusiness({name: host(url), website: url, sourceUrl: url, status: 'Waiting to read website.'}));
        render();
        const budget = {left: 30};
        $('searchProgress').max = Math.max(1, state.results.length); $('searchProgress').value = 0;
        for (let i = 0; i < state.results.length; i++) {
          if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
          if (!budget.left) { state.results[i].status = 'Public listing only; 30-page run limit reached.'; continue; }
          await enrich(state.results[i], source, settings.pages, signal, budget, research);
          $('searchProgress').value = i + 1;
        }
      }
    } catch (error) {
      stopped = signal.aborted || error.code === 'ABORTED' || error.name === 'AbortError';
      failure = stopped ? '' : error.message;
      log(stopped ? 'Research stopped. Existing results retained.' : error.message);
    } finally {
      state.results.forEach(b => { if (/pending|waiting/i.test(b.status)) b.status = 'Not checked; research ended before this website was read.'; });
      setBusy(false); state.controller = null; render();
      const count = state.results.length;
      const named = state.results.reduce((n, b) => n + b.people.length, 0);
      const peopleLabel = countLabel(named, 'named person', 'named people');
      let message, tone = 'info';
      if (stopped) message = 'Stopped. ' + countLabel(count, 'business', 'businesses') + ' retained; you can export or save partial results.';
      else if (failure) { message = failure + (count ? ' Available results are retained below.' : ' Try Website URLs or Paste a page.'); tone = 'error'; }
      else if (!count) message = 'No matching listings found. Try another category, the full city name, or Website URLs.';
      else if (settings.mode === 'websites') {
        const websitesRead = state.results.filter(b => b.sources.length > 0).length;
        if (!research.pagesRead) {
          message = 'No website pages could be read. No contacts were extracted. Check the activity log, try another public URL or use Paste a page.';
          tone = 'error';
        } else if (research.pagesFailed) {
          message = 'Partial research: ' + websitesRead + ' of ' + countLabel(count, 'website') + ' read and ' + peopleLabel + ' found. ' + countLabel(research.pagesFailed, 'page') + ' could not be read; available results are retained below.';
          tone = 'error';
        } else message = 'Research finished: ' + countLabel(websitesRead, 'website') + ' read and ' + peopleLabel + ' found. Only details found in sources successfully read are included.';
      } else if (settings.mode === 'paste') message = 'Extracted from pasted content: ' + countLabel(count, 'business', 'businesses') + ' and ' + peopleLabel + '. The original source has not been verified.';
      else message = 'Research finished: ' + countLabel(count, 'business', 'businesses') + ' and ' + peopleLabel + ' found. Only details found in sources successfully read are included.';
      notify(message, tone);
    }
  }
  function buildCsv(businesses) {
    const rows = [['Business', 'Website', 'Person name', 'Role', 'Person email', 'Person phone', 'Website/listing emails', 'Website/listing phones', 'Person source', 'Person email source', 'Person phone source', 'Email sources', 'Phone sources', 'All sources', 'Checked at', 'Research status']];
    businesses.forEach(b => {
      (b.people.length ? b.people : [{}]).forEach(p => rows.push([
        b.name, b.website, p.name, p.role, p.email, p.phone,
        contacts(b.emails).map(v => v.value).join('; '), contacts(b.phones).map(v => v.value).join('; '),
        p.sourceUrl, p.email ? p.emailSourceUrl || p.sourceUrl : '', p.phone ? p.phoneSourceUrl || p.sourceUrl : '',
        unique(contacts(b.emails).map(v => v.sourceUrl)).join('; '), unique(contacts(b.phones).map(v => v.sourceUrl)).join('; '),
        unique(b.sources).join('; '), b.checkedAt, b.status
      ]));
    });
    return '\uFEFF' + rows.map(row => row.map(value => P.escapeCsvCell(value == null ? '' : value)).join(',')).join('\r\n');
  }
  // Validation is mode-specific; hidden URL fields must not block another mode.
  $('leadSearchForm').noValidate = true;
  $('leadSearchForm').addEventListener('submit', run);
  $('stopSearch').addEventListener('click', () => { state.controller?.abort(); notify('Stopping…', 'busy'); });
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
    button.addEventListener('keydown', event => {
      const tabs = [...document.querySelectorAll('[data-mode]')]; const index = tabs.indexOf(button);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); setMode(tabs[next].dataset.mode, true); }
    });
  });
  $('resultFilter').addEventListener('input', render);
  $('savedOnly').addEventListener('change', render);
  $('exportCsv').addEventListener('click', () => {
    const rows = visibleResults(); if (!rows.length) return;
    const url = URL.createObjectURL(new Blob([buildCsv(rows)], {type: 'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = 'veefivee-public-contacts-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
  // Pure serialization is exposed for regression tests; fetched content is never injected as HTML.
  window.LeadExtractExport = Object.freeze({buildCsv});
  loadSaved(); setMode('discover'); render();
})();
