'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A minimal DOM for application orchestration. Parser cases and real browser
// constraint validation/layout are covered separately.
class Node {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {};
    this.dataset = {}; this.attributes = {}; this.value = ''; this.hidden = false;
    this.disabled = false; this.checked = false; this._text = '';
  }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get firstChild() { return this.children[0]; }
  append(...children) {
    for (let child of children) {
      if (typeof child === 'string') { const text = new Node('#text'); text.textContent = child; child = text; }
      if (child.tagName === '#FRAGMENT') this.append(...child.children);
      else { child.parentElement = this; this.children.push(child); }
    }
  }
  replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  async dispatch(type, event = {}) {
    for (const listener of this.listeners[type] || []) await listener({preventDefault() {}, ...event});
  }
  click() { return this.dispatch('click'); }
  focus() { this.focused = true; }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
  }
}

function setup({source, createSource, saved = null} = {}) {
  const ids = new Map(), html = fs.readFileSync(path.join(__dirname, '../leadextract.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) {
    const node = new Node(match[1]); ids.set(match[2], node);
  }
  ids.get('pageLimit').value = '3'; ids.get('resultLimit').value = '5';
  ids.get('businessCategory').value = 'dentists';
  const tabs = ['discover', 'websites', 'paste'].map(mode => {
    const tab = ids.get('tab-' + mode); tab.dataset.mode = mode; return tab;
  });
  const controls = ['businessCategory', 'businessCity', 'businessRegion', 'websiteUrls', 'pasteSource', 'pasteContent', 'resultLimit', 'pageLimit'].map(id => ids.get(id));
  const storage = new Map(saved == null ? [] : [['veefivee_public_contacts_v1', saved]]);
  const document = {
    body: new Node('body'),
    getElementById: id => ids.get(id),
    createElement: tag => new Node(tag),
    createTextNode: text => { const node = new Node('#text'); node.textContent = text; return node; },
    createDocumentFragment: () => new Node('#fragment'),
    querySelectorAll: selector => selector === '[data-mode]' ? tabs : [...controls, ...tabs]
  };
  const context = vm.createContext({
    document, URL, Blob, AbortController, DOMException, setTimeout, clearTimeout,
    localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)}
  });
  context.window = context;
  context.LeadExtractSources = {create: createSource || (() => source || {
    discover: async () => [], readPage: async () => { throw new Error('Unexpected website read'); }
  })};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/leadextract-parser.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/leadextract.js'), 'utf8'), context);
  return {context, ids, storage, node: id => ids.get(id), mode: mode => ids.get('tab-' + mode).click(), run: () => ids.get('leadSearchForm').dispatch('submit')};
}

const page = (url, text) => ({url, sourceUrl: url, text, html: ''});
const ownerText = 'Title: Willow Studio\n\n# Alex Rowan\nOwner\nEmail: alex@willow-studio.org\nPhone: +44 20 7946 0958';
const allNodes = node => [node, ...node.children.flatMap(allNodes)];

test('pasted content remains local, renders attributed contacts and can be saved and reloaded', async () => {
  let requests = 0;
  const app = setup({source: {discover: async () => { requests++; }, readPage: async () => { requests++; }}});
  await app.mode('paste');
  app.node('pasteSource').value = 'https://willow-studio.org/team';
  app.node('pasteContent').value = ownerText;
  await app.run();
  assert.equal(requests, 0);
  assert.equal(app.node('runSearch').disabled, false);
  assert.equal(app.node('stopSearch').hidden, true);
  assert.match(app.node('businessResults').textContent, /Alex Rowan/);
  assert.match(app.node('businessResults').textContent, /alex@willow-studio.org/);
  assert.match(app.node('businessResults').textContent, /live source not verified/);
  const save = allNodes(app.node('businessResults')).find(node => node.className === 'le-save');
  await save.click();
  const saved = app.storage.get('veefivee_public_contacts_v1');
  assert.equal(JSON.parse(saved)[0].people[0].sourceUrl, 'https://willow-studio.org/team');
  const reloaded = setup({saved});
  reloaded.node('savedOnly').checked = true;
  await reloaded.node('savedOnly').dispatch('change');
  assert.match(reloaded.node('businessResults').textContent, /Alex Rowan/);
  assert.equal(reloaded.node('exportCsv').disabled, false);
});

test('a failed website yields no invented contacts and leaves the controls usable', async () => {
  const app = setup({source: {readPage: async () => { throw Object.assign(new Error('Network unavailable'), {code: 'NETWORK'}); }}});
  await app.mode('websites');
  app.node('websiteUrls').value = 'https://willow-studio.org';
  await app.run();
  assert.match(app.node('businessResults').textContent, /Website could not be read/);
  assert.match(app.node('businessResults').textContent, /No published phone or email found/);
  assert.match(app.node('logEntries').textContent, /Network unavailable/);
  assert.equal(app.node('searchStatus').dataset.tone, 'error');
  assert.match(app.node('statusText').textContent, /No website pages could be read\. No contacts were extracted/);
  assert.doesNotMatch(app.node('statusText').textContent, /Research finished|businesses.*found/);
  assert.equal(app.node('runSearch').disabled, false);
});

test('mixed website failures report partial research and retain successful attributed contacts', async () => {
  const app = setup({source: {readPage: async url => {
    if (url.includes('willow-studio')) return page(url, ownerText);
    throw Object.assign(new Error('Website declined access'), {code: 'BLOCKED'});
  }}});
  await app.mode('websites');
  app.node('websiteUrls').value = 'https://willow-studio.org\nhttps://second-studio.org';
  await app.run();
  assert.match(app.node('statusText').textContent, /^Partial research: 1 of 2 websites read and 1 named person found\. 1 page could not be read/);
  assert.equal(app.node('searchStatus').dataset.tone, 'error');
  assert.match(app.node('businessResults').textContent, /Alex Rowan/);
  assert.match(app.node('businessResults').textContent, /Website could not be read/);
  assert.equal(app.node('exportCsv').disabled, false);
});

test('a failed follow-up page marks partial research without losing the readable starting page', async () => {
  const app = setup({source: {readPage: async url => {
    if (url.endsWith('/')) return page(url, ownerText + '\n[Our team](https://willow-studio.org/team)');
    throw Object.assign(new Error('Website took too long'), {code: 'TIMEOUT'});
  }}});
  await app.mode('websites');
  app.node('websiteUrls').value = 'https://willow-studio.org';
  await app.run();
  assert.match(app.node('statusText').textContent, /^Partial research: 1 of 1 website read and 1 named person found\. 1 page could not be read/);
  assert.match(app.node('businessResults').textContent, /1 website page read; 1 unavailable/);
  assert.match(app.node('businessResults').textContent, /Alex Rowan/);
});

test('corrupt saved entries cannot break filtering or render unsafe source links', async () => {
  const app = setup({saved: JSON.stringify([
    {version: 1, sourceUrl: 'https://willow-studio.org/', name: 'Willow Studio', people: {name: 'invalid shape'}, sources: 'invalid shape', emails: [{value: 'hello@willow-studio.org', sourceUrl: 'javascript:alert(1)'}]},
    {version: 1, sourceUrl: 'javascript:alert(1)', name: 'Rejected entry'},
    {version: 0, sourceUrl: 'https://old-demo.org/', name: 'Old schema'}
  ])});
  app.node('savedOnly').checked = true;
  await app.node('savedOnly').dispatch('change');
  app.node('resultFilter').value = 'willow';
  await app.node('resultFilter').dispatch('input');
  assert.match(app.node('businessResults').textContent, /Willow Studio/);
  assert.doesNotMatch(app.node('businessResults').textContent, /Rejected entry|Old schema|hello@/);
  assert.match(app.node('resultCount').textContent, /1 business · 0 named people · 1 saved/);
});

test('source initialization failures restore the form rather than leaving extraction stuck', async () => {
  const app = setup({createSource: () => { throw new Error('Public source support unavailable'); }});
  await app.mode('websites');
  app.node('websiteUrls').value = 'https://willow-studio.org';
  await app.run();
  assert.match(app.node('statusText').textContent, /Public source support unavailable/);
  assert.equal(app.node('searchStatus').dataset.tone, 'error');
  assert.equal(app.node('runSearch').disabled, false);
  assert.equal(app.node('stopSearch').hidden, true);
  assert.equal(app.node('websiteUrls').disabled, false);
});

test('enrichment follows relevant same-site pages and refuses off-site links', async () => {
  const requested = [];
  const app = setup({source: {readPage: async url => {
    requested.push(url);
    return page(url, requested.length === 1
      ? 'Title: Willow Studio\n[Our team](https://willow-studio.org/team)\n[Other team](https://other-studio.org/team)\n[News](https://willow-studio.org/news)'
      : ownerText);
  }}});
  await app.mode('websites');
  app.node('websiteUrls').value = 'https://willow-studio.org';
  await app.run();
  assert.deepEqual(requested, ['https://willow-studio.org/', 'https://willow-studio.org/team']);
  assert.match(app.node('businessResults').textContent, /2 website pages read/);
  assert.match(app.node('businessResults').textContent, /Alex Rowan/);
  assert.match(app.node('statusText').textContent, /^Research finished: 1 website read and 1 named person found/);
  assert.equal(app.node('searchStatus').dataset.tone, 'info');
});

test('stopping a later read preserves earlier results and restores form controls', async () => {
  let began;
  const started = new Promise(resolve => { began = resolve; });
  const app = setup({source: {readPage: async (url, {signal}) => {
    if (url.includes('willow-studio')) return page(url, ownerText);
    began();
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), {once: true}));
  }}});
  await app.mode('websites');
  app.node('websiteUrls').value = 'https://willow-studio.org\nhttps://second-studio.org';
  const pending = app.run();
  await started;
  await app.node('stopSearch').click();
  await pending;
  assert.match(app.node('statusText').textContent, /^Stopped\./);
  assert.match(app.node('businessResults').textContent, /Alex Rowan/);
  assert.equal(app.node('runSearch').disabled, false);
  assert.equal(app.node('websiteUrls').disabled, false);
  assert.equal(app.node('searchProgress').hidden, true);
  assert.equal(app.node('exportCsv').disabled, false);
});

test('rate limiting halts later website reads and retains partial data', async () => {
  const requested = [];
  const app = setup({source: {readPage: async url => {
    requested.push(url);
    if (requested.length === 1) return page(url, ownerText);
    throw Object.assign(new Error('Reader request limit reached'), {code: 'RATE_LIMIT'});
  }}});
  await app.mode('websites');
  app.node('websiteUrls').value = 'https://willow-studio.org\nhttps://second-studio.org\nhttps://third-studio.org';
  await app.run();
  assert.equal(requested.length, 2);
  assert.equal(app.node('searchStatus').dataset.tone, 'error');
  assert.match(app.node('businessResults').textContent, /Alex Rowan/);
  assert.match(app.node('businessResults').textContent, /Not checked; research ended/);
  assert.equal(app.node('runSearch').disabled, false);
});

test('CSV preserves individual attribution, protects formulas and escapes multiline values', () => {
  const app = setup();
  const csv = app.context.LeadExtractExport.buildCsv([{
    name: '=HYPERLINK("https://untrusted.org")', website: 'https://willow-studio.org/',
    people: [{name: 'Alex Rowan', role: 'Owner', email: 'alex@willow-studio.org', phone: '+442079460958', sourceUrl: 'https://willow-studio.org/team', emailSourceUrl: 'https://willow-studio.org/contact'}],
    emails: [{value: 'office@willow-studio.org', sourceUrl: 'https://willow-studio.org/contact'}],
    phones: [], sources: ['https://willow-studio.org/', 'https://willow-studio.org/team'],
    checkedAt: '2026-10-21T00:00:00Z', status: 'Read one page\nA second line'
  }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/untrusted.org""\)"/);
  assert.match(csv, /"'\+442079460958"/);
  assert.match(csv, /"https:\/\/willow-studio.org\/team","https:\/\/willow-studio.org\/contact","https:\/\/willow-studio.org\/team"/);
  assert.match(csv, /"Read one page\nA second line"/);
});
