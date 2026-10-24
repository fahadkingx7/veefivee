/* Keyless public sources. Public services may refuse or throttle a request. */
(function (root) {
  'use strict';
  const READER = 'https://r.jina.ai/';
  const OVERPASS = 'https://overpass-api.de/api/interpreter';
  const MAX_BYTES = 2 * 1024 * 1024;
  const CATEGORY_FILTERS = Object.freeze({
    hairdressers: '["shop"="hairdresser"]',
    dentists: '["amenity"="dentist"]',
    restaurants: '["amenity"="restaurant"]',
    cafes: '["amenity"="cafe"]',
    real_estate: '["office"="estate_agent"]',
    lawyers: '["office"="lawyer"]',
    accountants: '["office"="accountant"]',
    car_repair: '["shop"="car_repair"]',
    hotels: '["tourism"="hotel"]',
    shops: '["shop"]'
  });

  function error(code, message) {
    const failure = new Error(message);
    failure.code = code;
    return failure;
  }
  function abortError() {
    const failure = error('ABORTED', 'Extraction stopped.');
    failure.name = 'AbortError';
    return failure;
  }
  function checkAbort(signal) { if (signal && signal.aborted) throw abortError(); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function validateUrl(value) {
    const parser = root.LeadExtractParser;
    if (parser && typeof parser.validatePublicUrl === 'function') return parser.validatePublicUrl(value);
    try {
      const raw = String(value || '').trim();
      if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) return null;
      const url = new URL(raw);
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || !host.includes('.') || host.includes(':')) return null;
      if (/(?:^|\.)(?:localhost|local|internal|intranet|lan|home|test|invalid|example|onion)$/.test(host)) return null;
      // Without the shared parser, reject numeric hosts entirely instead of accepting private IPs.
      if (/^[\d.]+$/.test(host) || (url.port && !['80', '443'].includes(url.port))) return null;
      url.hash = '';
      return url.href;
    } catch (_) { return null; }
  }
  function qlString(value) {
    return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\u0000-\u001f\u007f]/g, ' ') + '"';
  }
  function placeName(value, label) {
    const name = clean(value);
    if (!name || name.length > 100) throw error('INVALID_LOCATION', 'Enter a ' + label + ' between 1 and 100 characters.');
    return name;
  }
  function exactBoundaryQuery(name, regionId, regionOnly) {
    const quoted = qlString(name);
    const scope = regionId ? '(area.region)' : '';
    const region = regionId ? 'rel(' + Number(regionId) + ');map_to_area->.region;' : '';
    // The optional region means a country, state or region, not a namesake locality.
    const boundaryFilter = '["boundary"="administrative"]' + (regionOnly ? '["admin_level"~"^[2-6]$"]' : '');
    let alternatives = 'rel' + scope + boundaryFilter + '["name"=' + quoted + '];' +
      'rel' + scope + boundaryFilter + '["name:en"=' + quoted + '];';
    if (!regionId && /^[a-z]{2}$/i.test(name)) alternatives += 'rel["boundary"="administrative"]["ISO3166-1"=' + qlString(name.toUpperCase()) + '];';
    return '[out:json][timeout:20][maxsize:16777216];' + region + '(' + alternatives + ');out tags 12;';
  }
  function businessQuery(cityId, category, limit) {
    if (!Number.isSafeInteger(Number(cityId)) || Number(cityId) <= 0) throw error('INVALID_LOCATION', 'The selected city boundary is invalid.');
    if (!Object.prototype.hasOwnProperty.call(CATEGORY_FILTERS, category)) throw error('INVALID_CATEGORY', 'Choose one of the available business categories.');
    return '[out:json][timeout:25][maxsize:16777216];rel(' + Number(cityId) + ');map_to_area->.city;' +
      'nwr(area.city)' + CATEGORY_FILTERS[category] + '["name"];out center tags ' + Math.max(1, Math.min(20, Math.floor(Number(limit) || 10))) + ';';
  }
  function values(value) { return String(value || '').split(/[;\n]+/).map(clean).filter(Boolean); }
  function toBusiness(element) {
    const tags = element.tags || {};
    const sourceUrl = 'https://www.openstreetmap.org/' + element.type + '/' + element.id;
    const emails = [], phones = [];
    const add = function (target, tag, type) {
      values(tags[tag]).forEach(function (raw) {
        let value = raw;
        const parser = root.LeadExtractParser;
        if (parser && type === 'email' && typeof parser.emailValue === 'function') value = parser.emailValue(raw);
        else if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) value = '';
        if (parser && type === 'phone' && typeof parser.phoneValue === 'function') value = parser.phoneValue(raw);
        else if (type === 'phone' && (raw.replace(/\D/g, '').length < 7 || raw.replace(/\D/g, '').length > 15)) value = '';
        if (value && !target.some(item => item.value === value)) target.push({value, sourceUrl, evidence: 'OpenStreetMap ' + tag + ': ' + raw});
      });
    };
    ['email', 'contact:email'].forEach(tag => add(emails, tag, 'email'));
    ['phone', 'contact:phone', 'mobile', 'contact:mobile'].forEach(tag => add(phones, tag, 'phone'));
    const website = values(tags.website || tags['contact:website']).map(function (candidate) {
      return validateUrl(/^https?:\/\//i.test(candidate) ? candidate : 'https://' + candidate);
    }).find(Boolean) || '';
    return {
      name: clean(tags.name || tags['name:en']), website, emails, phones, people: [],
      address: ['addr:housenumber', 'addr:street', 'addr:city', 'addr:postcode', 'addr:country'].map(tag => clean(tags[tag])).filter(Boolean).join(', '),
      sourceUrl, sources: [sourceUrl]
    };
  }
  function wait(milliseconds, signal) {
    checkAbort(signal);
    if (milliseconds <= 0) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const done = function () { if (signal) signal.removeEventListener('abort', stopped); resolve(); };
      const timer = setTimeout(done, milliseconds);
      const stopped = function () { clearTimeout(timer); if (signal) signal.removeEventListener('abort', stopped); reject(abortError()); };
      if (signal) signal.addEventListener('abort', stopped, {once: true});
    });
  }
  async function readLimited(response) {
    const declared = Number(response.headers && response.headers.get && response.headers.get('content-length'));
    if (declared > MAX_BYTES) throw error('TOO_LARGE', 'This source is too large to read safely. Try a specific contact or team page.');
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let size = 0, content = '';
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > MAX_BYTES) throw error('TOO_LARGE', 'This source is too large. Try a specific contact or team page.');
          content += decoder.decode(part.value, {stream: true});
        }
        return content + decoder.decode();
      } catch (failure) {
        try { await reader.cancel(); } catch (_) {}
        throw failure;
      } finally { reader.releaseLock(); }
    }
    const content = await response.text();
    if (new TextEncoder().encode(content).byteLength > MAX_BYTES) throw error('TOO_LARGE', 'This source is too large. Try a specific contact or team page.');
    return content;
  }
  function create(options) {
    options = options || {};
    const fetchImpl = options.fetchImpl || (root.fetch && root.fetch.bind(root));
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : function () {};
    // Overpass may queue for 15 seconds before the query's 25-second execution limit.
    const timeoutMs = Math.max(10, Math.min(45000, Number(options.timeoutMs) || 45000));
    const pages = new Map(), locations = new Map();
    const nextRequest = {reader: 0, overpass: 0};
    const stoppedSources = {};
    let queue = Promise.resolve();
    if (typeof fetchImpl !== 'function') throw error('UNSUPPORTED', 'This browser does not support website requests. Use a current browser.');

    function serial(task) {
      const pending = queue.then(task);
      queue = pending.catch(function () {});
      return pending;
    }
    async function request(url, init, source, signal) {
      checkAbort(signal);
      if (stoppedSources[source]) throw stoppedSources[source];
      const remaining = nextRequest[source] - Date.now();
      if (remaining > 0) onStatus({phase: 'waiting', message: 'Waiting briefly between public source requests.'});
      await wait(remaining, signal);
      checkAbort(signal);
      nextRequest[source] = Date.now() + (source === 'reader' ? 3200 : 1500);
      const controller = new AbortController();
      let timedOut = false;
      const stopped = function () { controller.abort(); };
      if (signal) signal.addEventListener('abort', stopped, {once: true});
      const timer = setTimeout(function () { timedOut = true; controller.abort(); }, timeoutMs);
      try {
        const response = await fetchImpl(url, Object.assign({}, init, {signal: controller.signal, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin'}));
        if (response.status === 429) {
          const failure = error('RATE_LIMIT', (source === 'reader' ? 'The website reader' : 'OpenStreetMap') + ' has reached its public request limit. This source is stopped for this run. Try again later.');
          stoppedSources[source] = failure;
          throw failure;
        }
        if ([401, 403, 451].includes(response.status)) throw error('BLOCKED', 'This source declined public access. Try another public source URL.');
        if (!response.ok) throw error('SOURCE_UNAVAILABLE', 'The public source returned HTTP ' + response.status + '. Try again later.');
        const content = await readLimited(response);
        checkAbort(signal);
        if (timedOut) throw error('TIMEOUT', 'The public source took too long to respond. Try again later.');
        return content;
      } catch (failure) {
        if (signal && signal.aborted) throw abortError();
        if (timedOut) throw error('TIMEOUT', 'The public source took too long to respond. Try again later.');
        if (failure.code) throw failure;
        throw error('NETWORK', 'The public source could not be reached. Check your connection or try again later.');
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', stopped);
      }
    }
    function readPage(inputUrl, settings) {
      settings = settings || {};
      return serial(async function () {
        checkAbort(settings.signal);
        const url = validateUrl(inputUrl);
        if (!url) throw error('INVALID_URL', 'Enter a public http:// or https:// website URL. Local addresses and signed-in pages are unsupported.');
        if (pages.has(url)) return Object.assign({}, pages.get(url));
        onStatus({phase: 'reading', message: 'Reading ' + new URL(url).hostname + '.', url});
        const content = await request(READER + url, {method: 'GET'}, 'reader', settings.signal);
        if (!content.trim()) throw error('EMPTY_PAGE', 'The page returned no readable public content.');
        const upstreamError = content.match(/^Warning:\s*Target URL returned error\s+(\d{3})\b/im);
        if (upstreamError) throw error('PAGE_UNAVAILABLE', 'The website returned HTTP ' + upstreamError[1] + '. Try another public page on the business website.');
        // Jina's plain response is Markdown; never treat it as executable HTML.
        const result = {url, sourceUrl: url, text: content, html: '', content, format: 'markdown'};
        if (pages.size >= 20) pages.delete(pages.keys().next().value);
        pages.set(url, result);
        return Object.assign({}, result);
      });
    }
    async function queryOverpass(query, signal) {
      const content = await request(OVERPASS, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'data=' + encodeURIComponent(query)}, 'overpass', signal);
      let data;
      try { data = JSON.parse(content); } catch (_) { throw error('INVALID_RESPONSE', 'OpenStreetMap returned an unreadable response. Try again later.'); }
      if (!Array.isArray(data.elements) || data.remark) throw error('INCOMPLETE_RESPONSE', 'OpenStreetMap could not complete this search. Try a smaller city or try later.');
      return data.elements;
    }
    async function boundary(name, regionId, label, signal) {
      const key = (regionId || '') + ':' + name;
      if (locations.has(key)) return locations.get(key);
      const elements = await queryOverpass(exactBoundaryQuery(name, regionId, label === 'region'), signal);
      const relations = elements.filter(item => item.type === 'relation' && Number.isSafeInteger(item.id) && item.id > 0);
      const unique = Array.from(new Map(relations.map(item => [item.id, item])).values());
      if (!unique.length) throw error('LOCATION_NOT_FOUND', 'No exact ' + label + ' boundary was found for “' + name + '”. Use its full official name or try website URLs.');
      if (unique.length !== 1) throw error('AMBIGUOUS_LOCATION', 'Several places match “' + name + '”. ' + (label === 'city' && !regionId ? 'Add a region or country to narrow the search.' : 'Use a more specific city or region name, or try website URLs.'));
      locations.set(key, unique[0].id);
      return unique[0].id;
    }
    function discover(settings) {
      settings = settings || {};
      return serial(async function () {
        checkAbort(settings.signal);
        if (!Object.prototype.hasOwnProperty.call(CATEGORY_FILTERS, settings.category)) throw error('INVALID_CATEGORY', 'Choose one of the available business categories.');
        const city = placeName(settings.city, 'city');
        const region = settings.region ? placeName(settings.region, 'region or country') : '';
        onStatus({phase: 'locating', message: 'Finding the exact city boundary in OpenStreetMap.'});
        const regionId = region ? await boundary(region, null, 'region', settings.signal) : null;
        const cityId = await boundary(city, regionId, 'city', settings.signal);
        onStatus({phase: 'discovering', message: 'Reading public business listings in ' + city + '.'});
        const limit = Math.max(1, Math.min(20, Math.floor(Number(settings.limit) || 10)));
        const elements = await queryOverpass(businessQuery(cityId, settings.category, limit), settings.signal);
        return elements.filter(item => ['node', 'way', 'relation'].includes(item.type) && Number.isSafeInteger(item.id) && item.tags && item.tags.name).slice(0, limit).map(toBusiness);
      });
    }
    return {readPage, discover};
  }
  const api = {create};
  root.LeadExtractSources = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign({}, api, {_test: {qlString, exactBoundaryQuery, businessQuery, toBusiness, validateUrl}});
})(typeof globalThis !== 'undefined' ? globalThis : this);
