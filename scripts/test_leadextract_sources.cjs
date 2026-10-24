'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/leadextract-parser.js');
const {create, _test} = require('../js/leadextract-sources.js');

function response(body, status = 200, headers) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {status, headers});
}
function abortedFetch(_url, options) {
  return new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), {once: true});
  });
}

test('Overpass parameters are escaped and category/limit cannot inject queries', () => {
  assert.equal(_test.qlString('A";out;\\B\n'), '"A\\";out;\\\\B "');
  const query = _test.exactBoundaryQuery('A";out;\\B', 123);
  assert.match(query, /rel\(123\);map_to_area->\.region;/);
  assert.ok(query.includes('["name"="A\\";out;\\\\B"]'));
  assert.match(_test.businessQuery(456, 'dentists', 999), /out center tags 20;/);
  assert.match(_test.businessQuery(456, 'shops', -7), /out center tags 1;/);
  assert.throws(() => _test.businessQuery('1);out;', 'shops', 2), {code: 'INVALID_LOCATION'});
  assert.throws(() => _test.businessQuery(1, 'shops];out;', 2), {code: 'INVALID_CATEGORY'});
});

test('reader rejects local, credential-bearing and unsupported URLs before fetching', async () => {
  let calls = 0;
  const sources = create({fetchImpl: async () => { calls++; return response('unexpected'); }});
  for (const url of ['http://localhost/', 'http://127.0.0.1/', 'http://192.168.1.1/', 'https://user:pass@company.org', 'file:///etc/passwd', 'javascript:alert(1)']) {
    await assert.rejects(sources.readPage(url), {code: 'INVALID_URL'});
  }
  assert.equal(calls, 0);
});

test('region lookup excludes namesake localities without narrowing city boundaries', () => {
  const region = _test.exactBoundaryQuery('Texas', null, true);
  assert.ok(region.includes('["admin_level"~"^[2-6]$"]'));
  const city = _test.exactBoundaryQuery('Austin', 114690, false);
  assert.ok(!city.includes('admin_level'));
  assert.ok(city.includes('(area.region)'));
});

test('plain keyless reader responses are accurately labelled and cached', async () => {
  const calls = [];
  const sources = create({fetchImpl: async (url, options) => {
    calls.push({url, options});
    return response('Title: Business\n\nURL Source: https://company.org/\n\nMarkdown Content:\nCall +44 20 7946 0958');
  }});
  const page = await sources.readPage('https://company.org/#contact');
  const again = await sources.readPage('https://company.org/');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://r.jina.ai/https://company.org/');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.equal(calls[0].options.headers, undefined);
  assert.equal(page.format, 'markdown');
  assert.equal(page.html, '');
  assert.equal(page.sourceUrl, 'https://company.org/');
  assert.equal(page.text, again.content);
});

test('429 stops that source for the run without retries or rotating endpoints', async () => {
  let calls = 0;
  const sources = create({fetchImpl: async () => { calls++; return response('Rate limited', 429); }});
  await assert.rejects(sources.readPage('https://company.org'), {code: 'RATE_LIMIT'});
  await assert.rejects(sources.readPage('https://another-company.org'), {code: 'RATE_LIMIT'});
  assert.equal(calls, 1);
});

test('network errors and forbidden responses are explicit failures', async () => {
  await assert.rejects(create({fetchImpl: async () => { throw new TypeError('Failed to fetch'); }}).readPage('https://company.org'), {code: 'NETWORK'});
  await assert.rejects(create({fetchImpl: async () => response('Forbidden', 403)}).readPage('https://company.org'), {code: 'BLOCKED'});
  await assert.rejects(create({fetchImpl: async () => response('Unavailable', 503)}).readPage('https://company.org'), {code: 'SOURCE_UNAVAILABLE'});
  await assert.rejects(create({fetchImpl: async () => response('Title: Not found\nWarning: Target URL returned error 404: Not Found\nMarkdown Content:\nNo page')}).readPage('https://company.org'), {code: 'PAGE_UNAVAILABLE'});
});

test('timeout aborts the transport and does not become an empty result', async () => {
  const sources = create({fetchImpl: abortedFetch, timeoutMs: 15});
  await assert.rejects(sources.readPage('https://company.org'), {code: 'TIMEOUT'});
});

test('user abort is preserved before and during a request', async () => {
  const already = new AbortController(); already.abort();
  await assert.rejects(create({fetchImpl: abortedFetch}).readPage('https://company.org', {signal: already.signal}), {code: 'ABORTED', name: 'AbortError'});
  const controller = new AbortController();
  const pending = create({fetchImpl: abortedFetch}).readPage('https://company.org', {signal: controller.signal});
  setTimeout(() => controller.abort(), 15);
  await assert.rejects(pending, {code: 'ABORTED', name: 'AbortError'});
});

test('oversized responses are rejected', async () => {
  const sources = create({fetchImpl: async () => response('body', 200, {'content-length': String(2 * 1024 * 1024 + 1)})});
  await assert.rejects(sources.readPage('https://company.org'), {code: 'TOO_LARGE'});
});

test('ambiguous and missing boundaries do not widen or fetch businesses', async () => {
  let calls = 0;
  const sources = create({fetchImpl: async () => { calls++; return response({elements: [{type:'relation',id:10}, {type:'relation',id:20}]}); }});
  await assert.rejects(sources.discover({category: 'cafes', city: 'Springfield'}), {code: 'AMBIGUOUS_LOCATION'});
  assert.equal(calls, 1);
  await assert.rejects(create({fetchImpl: async () => response({elements:[]})}).discover({category:'cafes',city:'Unmapped'}), {code:'LOCATION_NOT_FOUND'});
});

test('discovery scopes city within region and maps only published business contacts', async () => {
  const queries = [];
  const replies = [
    {elements:[{type:'relation',id:100,tags:{name:'Country'}}]},
    {elements:[{type:'relation',id:200,tags:{name:'City'}}]},
    {elements:[{type:'node',id:300,tags:{name:'Actual Dentist',email:'office@dentist.org','contact:phone':'+44 20 7946 0958',website:'https://dentist.org','addr:city':'City'}}]}
  ];
  const sources = create({fetchImpl: async (url, options) => {
    assert.equal(url, 'https://overpass-api.de/api/interpreter');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(options.referrerPolicy, 'strict-origin-when-cross-origin');
    queries.push(decodeURIComponent(options.body.slice(5)));
    return response(replies.shift());
  }});
  const businesses = await sources.discover({category:'dentists',city:'City',region:'Country',limit:3});
  assert.equal(queries.length, 3);
  assert.ok(queries[0].includes('["admin_level"~"^[2-6]$"]'));
  assert.ok(!queries[1].includes('admin_level'));
  assert.match(queries[1], /rel\(100\);map_to_area->\.region;/);
  assert.match(queries[2], /rel\(200\);map_to_area->\.city;/);
  assert.equal(businesses[0].name, 'Actual Dentist');
  assert.equal(businesses[0].emails[0].value, 'office@dentist.org');
  assert.equal(businesses[0].emails[0].sourceUrl, 'https://www.openstreetmap.org/node/300');
  assert.deepEqual(businesses[0].people, []);
  assert.equal(businesses[0].website, 'https://dentist.org/');
});

test('incomplete Overpass replies and malformed JSON fail without returning partial leads', async () => {
  await assert.rejects(create({fetchImpl: async () => response({elements:[],remark:'runtime error: timed out'})}).discover({category:'cafes',city:'City'}), {code:'INCOMPLETE_RESPONSE'});
  await assert.rejects(create({fetchImpl: async () => response('<html>upstream error</html>')}).discover({category:'cafes',city:'City'}), {code:'INVALID_RESPONSE'});
});

test('website safety also applies to links in public listings', () => {
  const business = _test.toBusiness({type:'node', id:1, tags:{name:'Shop', website:'http://127.0.0.1/', email:'invalid',phone:'123'}});
  assert.equal(business.website, '');
  assert.deepEqual(business.emails, []);
  assert.deepEqual(business.phones, []);
});
