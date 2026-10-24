'use strict';
const assert = require('node:assert/strict');
const {parsePage, validatePublicUrl, escapeCsvCell, emailValue, phoneValue} = require('../js/leadextract-parser.js');
const source = 'https://acme.studio/team';
let passed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { console.error('FAIL ' + name); throw error; }
}
function structured(data) {
  return parsePage({url:source, html:'<script type="application/ld+json">' + JSON.stringify(data) + '</script>'});
}
function text(value) { return parsePage({url:source, text:value}); }

test('JSON-LD graph resolves organization employee and founder references', () => {
  const result = structured({'@graph':[
    {'@id':'#company', '@type':'LocalBusiness', name:'Acme Studio', founder:{'@id':'#jane'}, employee:['#sam'], email:'hello@acme.studio', telephone:'+44 20 7946 0101'},
    {'@id':'#jane', '@type':'Person', name:'Jane Doe', jobTitle:'Owner', email:'jane@acme.studio', telephone:'+44 20 7946 0102'},
    {'@id':'#sam', '@type':'Person', name:'Sam Patel', jobTitle:'Manager', email:'sam@acme.studio'},
  ]});
  assert.equal(result.businessName, 'Acme Studio');
  assert.deepEqual(result.people.map(person => person.name), ['Jane Doe', 'Sam Patel']);
  assert.equal(result.people[0].email, 'jane@acme.studio');
  assert.equal(result.people[0].phone, '+442079460102');
  assert.equal(result.people[1].phone, '');
  assert.equal(result.people[0].emailSourceUrl, source);
  assert.ok(result.emails.some(item => item.value === 'hello@acme.studio'));
});

test('JSON-LD excludes article authors and testimonial authors referenced by @id', () => {
  const result = structured({'@graph':[
    {'@id':'#company', '@type':'Organization', name:'Acme Studio', employee:{'@id':'#staff'}},
    {'@id':'#staff', '@type':'Person', name:'Jane Doe', jobTitle:'Owner'},
    {'@type':'Article', author:{'@id':'#writer'}},
    {'@type':'Review', author:'#reviewer'},
    {'@id':'#writer', '@type':'Person', name:'Alex Writer', jobTitle:'Consultant', email:'alex@acme.studio', worksFor:{'@id':'#company'}},
    {'@id':'#reviewer', '@type':'Person', name:'Chris Reader', jobTitle:'Manager', email:'chris@acme.studio', worksFor:{'@id':'#company'}},
  ]});
  assert.deepEqual(result.people.map(person => person.name), ['Jane Doe']);
  assert.equal(result.emails.length, 0);
});

test('JSON-LD worksFor references establish staff affiliation', () => {
  const result = structured({'@graph':[
    {'@id':'https://acme.studio/#company', '@type':'ProfessionalService', name:'Acme Studio'},
    {'@type':'Person', name:'Élodie D’Arcy', jobTitle:'Managing Director', worksFor:{'@id':'https://acme.studio/#company'}, email:'elodie@acme.studio'},
    {'@type':'Person', name:'Unrelated Visitor', jobTitle:'CEO', email:'visitor@acme.studio'},
  ]});
  assert.deepEqual(result.people.map(person => person.name), ['Élodie D’Arcy']);
});

test('a published single given name is preserved without inventing a surname', () => {
  const result = structured({'@type':'Organization', name:'Acme Studio', founder:{'@type':'Person', name:'Fahad', email:'fahad@acme.studio'}});
  assert.equal(result.people[0].name, 'Fahad');
  assert.equal(result.people[0].role, 'Founder');
  assert.equal(result.people[0].email, 'fahad@acme.studio');
  assert.equal(text('## Fahad\nFounder\nEmail: fahad@acme.studio').people[0].name, 'Fahad');
});

test('organization and contactPoint details do not become employee contacts', () => {
  const result = structured({'@graph':[
    {'@type':'LocalBusiness', name:'Acme Studio', employee:[{'@type':'Person', name:'Jane Doe', jobTitle:'Owner', email:'hello@acme.studio', telephone:'+92 300 1234567'}], contactPoint:{'@id':'#contact'}},
    {'@id':'#contact', '@type':'ContactPoint', email:'hello@acme.studio', telephone:'+92 300 1234567'},
  ]});
  assert.equal(result.people[0].email, '');
  assert.equal(result.people[0].phone, '');
  assert.equal(result.emails[0].value, 'hello@acme.studio');
  assert.equal(result.phones[0].value, '+923001234567');
});

test('a shared switchboard repeated for multiple people is a company contact', () => {
  const result = structured({'@type':'Organization', name:'Acme Studio', employee:[
    {'@type':'Person', name:'Jane Doe', jobTitle:'Owner', telephone:'+1 212 555 0191'},
    {'@type':'Person', name:'Sam Patel', jobTitle:'Manager', telephone:'+1 212 555 0191'},
  ]});
  assert.deepEqual(result.people.map(person => person.phone), ['', '']);
  assert.equal(result.phones.length, 1);
});

test('separate markdown staff headings preserve contact associations', () => {
  const result = text('# Acme Studio\n\n## Jane Doe\nOwner\nEmail: jane@acme.studio\nPhone: +44 20 7946 0102\n\n## Sam Patel\nOperations Manager\n[Email](mailto:sam@acme.studio)\n[Call](tel:+923001234567)\n\n## Contact us\nhello@acme.studio\nPhone: +44 20 7946 0101');
  assert.deepEqual(result.people.map(person => [person.name, person.email, person.phone]), [
    ['Jane Doe', 'jane@acme.studio', '+442079460102'],
    ['Sam Patel', 'sam@acme.studio', '+923001234567'],
  ]);
  assert.ok(result.emails.some(item => item.value === 'hello@acme.studio'));
});

test('markdown inline role headings and deobfuscated emails are recognized', () => {
  const result = text('## Jane Doe — Co-founder\nEmail: jane [at] acme [dot] studio\nDirect: +49 (0)30 1234 5678 ext. 19');
  assert.equal(result.people[0].name, 'Jane Doe');
  assert.equal(result.people[0].email, 'jane@acme.studio');
  assert.equal(result.people[0].phone, '+493012345678 ext. 19');
});

test('bold markdown job titles remain in their staff section', () => {
  const result = text('## Our Team\n\n**Fahad**\n**Founder**\nEmail: fahad@acme.studio\n\n**Sam Patel**\n**Manager**\nEmail: sam@acme.studio');
  assert.deepEqual(result.people.map(person => [person.name, person.email]), [['Fahad', 'fahad@acme.studio'], ['Sam Patel', 'sam@acme.studio']]);
});

test('markdown job-title subheadings retain the named person and direct contacts', () => {
  const result = text('## Jane Doe\n\n###### Business Manager\n\nEmail jane@acme.studio\n\n## Sam Patel\n### Owner\nPhone: +44 20 7946 0102\n\n## Contact us\nEmail: hello@acme.studio');
  assert.deepEqual(result.people.map(person => [person.name, person.role, person.email, person.phone]), [
    ['Jane Doe', 'Business Manager', 'jane@acme.studio', ''],
    ['Sam Patel', 'Owner', '', '+442079460102'],
  ]);
});

test('markdown emphasis and adjacent labels never become part of an email address', () => {
  const result = text('## Fahad\nFounder\n**Email**fahad@acme.studio\n\n**Email**fahad@acme.studio\n**fahad@acme.studio**\n*sam@acme.studio*\n__alex_rowan@acme.studio__\n`jane@acme.studio`\n[Email](mailto:fahad@acme.studio)');
  assert.deepEqual(result.emails.map(item => item.value), ['fahad@acme.studio', 'sam@acme.studio', 'alex_rowan@acme.studio', 'jane@acme.studio']);
  assert.equal(result.people[0].email, 'fahad@acme.studio');
  assert.equal(emailValue('mailto:first*last@acme.studio'), 'first*last@acme.studio');
  assert.equal(text('Email: first_last@acme.studio').emails[0].value, 'first_last@acme.studio');
  const linkedCard = text('[✳CALL**+92 325 4891223**_Chat_](https://acme.studio/contact)[✉EMAIL**fahad@acme.studio**_Get in touch_](mailto:fahad@acme.studio)');
  assert.deepEqual(linkedCard.emails.map(item => item.value), ['fahad@acme.studio']);
});

test('markdown a later company contact section does not fill person blanks', () => {
  const result = text('## Jane Doe\nOwner\nJane has worked in design for twenty years.\n\nContact us\nEmail: hello@acme.studio\nPhone: +44 20 7946 0101');
  assert.equal(result.people[0].email, '');
  assert.equal(result.people[0].phone, '');
});

test('markdown a different name on a contact line is not associated with the heading', () => {
  const result = text('## Jane Doe\nOwner\nSam Patel: sam@acme.studio\nPhone: +44 20 7946 0101');
  assert.equal(result.people[0].email, '');
  assert.equal(result.people[0].phone, '');
});

test('markdown generic inboxes remain company contacts', () => {
  const result = text('## Jane Doe\nOwner\nEmail: info@acme.studio');
  assert.equal(result.people[0].email, '');
  assert.equal(result.emails[0].value, 'info@acme.studio');
});

test('markdown testimonial and article sections do not create staff', () => {
  const result = text('## Alex Writer\nConsultant\nArticle by Alex Writer\nEmail: alex@acme.studio\n\n## Chris Reader\nManager\nTestimonial\nEmail: chris@acme.studio');
  assert.equal(result.people.length, 0);
});

test('markdown nested reviewer headings do not create staff', () => {
  const result = text('## Testimonials\n### Chris Reader\nManager\nEmail: chris@acme.studio\n## Our Team\n### Jane Doe\nOwner\nEmail: jane@acme.studio');
  assert.deepEqual(result.people.map(person => person.name), ['Jane Doe']);
});

test('international phones normalize optional trunk prefixes and extensions', () => {
  const result = text('Phone: +44 (0)20 7946 0102\nPhone: +92 (300) 123-4567\nPhone: 0049 30 1234 5678\nPhone: (212) 555-0191 ext. 7');
  assert.deepEqual(result.phones.map(item => item.value), ['+442079460102', '+923001234567', '+493012345678', '2125550191 ext. 7']);
});

test('dates, placeholder emails, and repeated dummy numbers are ignored', () => {
  const result = text('Phone: 2026-10-21\nPhone: 1111111111\nEmail: person@example.com\nEmail: jane@acme.studio');
  assert.equal(result.phones.length, 0);
  assert.deepEqual(result.emails.map(item => item.value), ['jane@acme.studio']);
});

test('exported contact validators reject placeholders and normalize published values', () => {
  for (const value of ['person@example.com', 'person@example.org', 'test@acme.studio', 'not-an-email']) assert.equal(emailValue(value), '');
  for (const value of ['1111111111', '+9999999999', '2026-10-21', '123']) assert.equal(phoneValue(value), '');
  assert.equal(emailValue('mailto:JANE@ACME.STUDIO?subject=Hello'), 'jane@acme.studio');
  assert.equal(phoneValue('tel:+49%2030%2012345678;ext=19'), '+493012345678 ext. 19');
});

test('every extracted contact includes its source and evidence', () => {
  const result = text('Email: jane@acme.studio\nPhone: +1 212 555 0191');
  for (const contact of [...result.emails, ...result.phones]) {
    assert.equal(contact.sourceUrl, source);
    assert.ok(contact.evidence.length > 0);
  }
});

test('relative public links resolve and fragments are removed', () => {
  const result = text('[Team](/team#people) [Contact](https://acme.studio/contact) [Mail](mailto:hello@acme.studio)');
  assert.deepEqual(result.links.map(link => link.url), [source, 'https://acme.studio/contact']);
});

test('public URLs are normalized', () => {
  assert.equal(validatePublicUrl('https://ACME.studio:443/team#owner'), source);
  assert.equal(validatePublicUrl('/contact', source), 'https://acme.studio/contact');
  assert.equal(validatePublicUrl('https://8.8.8.8/'), 'https://8.8.8.8/');
});

test('private, loopback, reserved, and alternate numeric IP spellings are rejected', () => {
  for (const url of [
    'http://localhost/', 'http://localhost.localdomain/', 'http://intranet/', 'http://service.internal/',
    'http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/',
    'http://10.1.2.3/', 'http://172.16.0.1/', 'http://192.168.1.1/', 'http://169.254.169.254/',
    'http://100.64.0.1/', 'http://192.0.2.1/', 'http://198.18.0.1/', 'http://198.51.100.1/', 'http://203.0.113.1/',
    'http://224.0.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/',
  ]) assert.equal(validatePublicUrl(url), null, url);
});

test('credentials, non-http schemes, control characters, and alternate ports are rejected', () => {
  for (const url of [
    'https://user:password@acme.studio/', 'https://user@acme.studio/',
    'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hello', 'ftp://acme.studio/',
    'https://acme.studio:8080/', 'https://acme.studio/\ncontact', '',
  ]) assert.equal(validatePublicUrl(url), null, url);
});

test('CSV escapes quotes and preserves commas and newlines inside quoted cells', () => {
  assert.equal(escapeCsvCell('Jane "JJ", Doe\nOwner'), '"Jane ""JJ"", Doe\nOwner"');
  assert.equal(escapeCsvCell(null), '""');
});

test('CSV neutralizes spreadsheet formulas including whitespace-prefixed payloads', () => {
  for (const value of ['=HYPERLINK("https://evil.invalid")', '+1234567', '-1+2', '@SUM(A1)', '  =1+1', '\t=1+1', '\nplain', '\u0001=1+1', '\uFEFF=1+1']) {
    assert.ok(escapeCsvCell(value).startsWith('"\''), JSON.stringify(value));
  }
  assert.equal(escapeCsvCell('Jane Doe'), '"Jane Doe"');
});

console.log('\n' + passed + ' parser tests passed. Browser DOM fixtures: /scripts/test-leadextract-parser.html');
