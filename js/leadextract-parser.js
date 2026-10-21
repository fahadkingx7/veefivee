/* Public-page parsing only. Published contacts are evidence, not deliverability checks. */
(function (root) {
  'use strict';
  const ROLE_SOURCE = '(?:co[ -]?)?(?:owner|founder)|(?:general |office |practice |sales |marketing |operations |account |business |regional |branch |property |store )?manager|(?:managing |medical |creative |executive |sales |marketing |operations )?director|managing partner|partner|principal|president|vice president|chief [a-z ]{2,35} officer|CEO|COO|CFO|CTO|CMO|head of [a-z ]{2,30}|(?:senior |lead |master )?(?:stylist|dentist|physician|consultant|advisor|architect|engineer|realtor|attorney|lawyer|therapist|designer|receptionist)|team member';
  const ROLE = new RegExp('(?:^|\\b)(' + ROLE_SOURCE + ')(?:\\b|$)', 'i');
  const NON_NAMES = /\b(?:about|contact|welcome|meet|team|staff|our|your|services|solutions|business|company|privacy|policy|terms|website|email|phone|call|support|copyright|customer|client|review|testimonial|news|article|read|more|follow|join|careers|management|leadership|all rights)\b/i;
  const EXCLUDED_EMAIL_DOMAINS = /(?:^|\.)(?:example\.(?:com|org|net)|sentry\.io|wixpress\.com|schema\.org|domain\.com|yoursite\.com)$/i;
  const MAX_SOURCE_LENGTH = 2 * 1024 * 1024;
  const STAFF_CARD_SELECTOR = '[itemtype$="/Person"], [class*="team-member"], [class*="staff-member"], [class*="person-card"], [class*="team-card"], [class*="staff-card"], [class*="profile-card"]';
  const GENERAL_CONTACT = /\b(?:contact us|get in touch|head office|main office|our office|office (?:phone|number|telephone)|general (?:enquiries|inquiries|contact)|reception|switchboard|customer (?:service|support)|company (?:email|phone|telephone)|business (?:email|phone|telephone))\b/i;
  const GENERAL_MAILBOX = /^(?:info|hello|contact|office|admin|support|sales|enquiries|inquiries|reception|booking|bookings|team|service|customerservice|help|mail|accounts|billing|careers|jobs)(?:[._-].*)?@/i;

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }
  function decode(value) {
    return String(value || '').replace(/&#(x[0-9a-f]+|\d+);?/gi, function (_, code) {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    }).replace(/&commat;/gi, '@').replace(/&(?:period|dot);/gi, '.')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'");
  }
  function deobfuscate(value) {
    return decode(value).replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@')
      .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
  }
  function validatePublicUrl(value, base) {
    try {
      const raw = String(value || '').trim();
      if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) return null;
      const parsed = new URL(raw, base || undefined);
      if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return null;
      const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
      if (!host.includes('.') || host.includes(':') || host.startsWith('[')) return null;
      if (/(?:^|\.)(?:localhost|localdomain|local|internal|intranet|lan|home|home\.arpa|test|invalid|example|onion)$/.test(host)) return null;
      const ip = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (ip) {
        const n = ip.slice(1).map(Number);
        if (n.some(x => x > 255) || n[0] === 0 || n[0] === 10 || n[0] === 127 || n[0] >= 224 ||
          (n[0] === 100 && n[1] >= 64 && n[1] <= 127) || (n[0] === 169 && n[1] === 254) ||
          (n[0] === 172 && n[1] >= 16 && n[1] <= 31) ||
          (n[0] === 192 && (n[1] === 168 || (n[1] === 0 && (n[2] === 0 || n[2] === 2)))) ||
          (n[0] === 198 && (n[1] === 18 || n[1] === 19 || (n[1] === 51 && n[2] === 100))) ||
          (n[0] === 203 && n[1] === 0 && n[2] === 113)) return null;
      }
      if (parsed.port && !['80', '443'].includes(parsed.port)) return null;
      parsed.hash = '';
      return parsed.href;
    } catch (_) { return null; }
  }
  function escapeCsvCell(value) {
    let text = String(value == null ? '' : value).replace(/\u0000/g, '');
    if (/^[\s\u0000-\u001f\u007f\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function emailValue(value) {
    let candidate = deobfuscate(value).replace(/^mailto:/i, '').split('?')[0].trim();
    try { candidate = decodeURIComponent(candidate); } catch (_) {}
    candidate = candidate.toLowerCase();
    if (candidate.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(candidate)) return '';
    const parts = candidate.split('@');
    if (parts.length !== 2 || parts[0].length > 64 || parts[0].startsWith('.') || parts[0].endsWith('.') || parts[0].includes('..')) return '';
    if (parts[1].split('.').some(label => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) return '';
    if (EXCLUDED_EMAIL_DOMAINS.test(parts[1]) || /\.(?:png|jpg|jpeg|webp|gif|svg|woff2?|css|js)$/i.test(candidate)) return '';
    if (/^(?:noreply|no-reply|donotreply|yourname|example|test)$/i.test(parts[0]) || /^[a-f0-9]{24,}$/i.test(parts[0])) return '';
    return candidate;
  }
  function phoneValue(value) {
    let raw = decode(value).replace(/^tel:/i, '').trim();
    try { raw = decodeURIComponent(raw); } catch (_) {}
    const extension = raw.match(/(?:;ext=|\bext\.?\s*|\bextension\s*|\bx\s*)(\d{1,8})\s*$/i);
    if (extension) raw = raw.slice(0, extension.index).trim();
    if (!/^[+\d() .\-/]+$/.test(raw) || /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(raw)) return '';
    // Optional national trunk prefixes are not part of an international number.
    raw = raw.replace(/^(\+\d{1,3})\s*\(0\)/, '$1');
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15 || /^(\d)\1+$/.test(digits)) return '';
    const normalized = raw.startsWith('+') ? '+' + digits : digits.startsWith('00') ? '+' + digits.slice(2) : digits;
    return normalized + (extension ? ' ext. ' + extension[1] : '');
  }
  function nameValue(value) {
    const name = clean(decode(value)).replace(/^[#*\s]+|[*\s]+$/g, '');
    if (name.length < 2 || name.length > 100 || NON_NAMES.test(name) || /[\d@<>:/|]/.test(name)) return '';
    if (!/^[\p{L}\p{M}.'’\-\s]+$/u.test(name) || name.split(/\s+/).length > 7) return '';
    if (ROLE.test(name)) return '';
    return name;
  }
  function snippet(text) { return clean(text).slice(0, 360); }
  function roleValue(value) {
    const role = clean(value).replace(/^\*+|\*+$/g, '');
    const match = ROLE.exec(role);
    // A biography mentioning an owner is not a job-title label.
    return role.length <= 100 && match && match.index === 0 && !/[.!?@\d]/.test(role) ? role : '';
  }
  function elementText(element) {
    // textContent joins adjacent elements without spaces, corrupting contacts.
    const parts = [];
    function visit(node) {
      if (node.nodeType === 3) parts.push(node.nodeValue);
      else if (node.nodeType === 1) {
        Array.from(node.childNodes).forEach(visit);
        parts.push('\n');
      }
    }
    visit(element);
    return parts.join('');
  }
  function extractContacts(text, sourceUrl, explicit) {
    const emails = [], phones = [];
    const input = deobfuscate(text);
    let match;
    const emailPattern = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}/gi;
    while ((match = emailPattern.exec(input))) {
      const value = emailValue(match[0]);
      if (value && !emails.some(item => item.value === value)) emails.push({value, sourceUrl, evidence:snippet(input.slice(Math.max(0, match.index - 60), match.index + match[0].length + 60))});
    }
    const phonePattern = /(?:\+?\(?\d[\d(). /\t-]{5,}\d)(?:[ \t]*(?:ext\.?|extension|x)[ \t]*\d{1,8})?/gi;
    while ((match = phonePattern.exec(input))) {
      const value = phoneValue(match[0]);
      const context = input.slice(Math.max(0, match.index - 45), match.index + match[0].length + 30);
      const looksLikePhone = explicit || /(?:phone|telephone|tel\b|mobile|cell|call|fax|contact|whatsapp)/i.test(context) || /^(?:\+|00)/.test(match[0]) || /\(\d{2,5}\)/.test(match[0]) || /^\d{3}[-.]\d{3}[-.]\d{4}$/.test(match[0]);
      if (value && looksLikePhone && !phones.some(item => item.value === value)) phones.push({value, sourceUrl, evidence:snippet(context)});
    }
    return {emails, phones};
  }
  function parsePage(options) {
    options = options || {};
    const sourceUrl = validatePublicUrl(options.url) || '';
    const html = String(options.html || '').slice(0, MAX_SOURCE_LENGTH);
    const text = String(options.text || '').slice(0, MAX_SOURCE_LENGTH);
    const result = {businessName:'', people:[], emails:[], phones:[], links:[]};
    const organizationContacts = {emails:new Set(), phones:new Set()};
    function addContact(kind, value, evidence) {
      const parsed = kind === 'emails' ? emailValue(value) : phoneValue(value);
      if (parsed && !result[kind].some(item => item.value === parsed)) result[kind].push({value:parsed, sourceUrl, evidence:snippet(evidence || value)});
      return parsed;
    }
    function absorbContacts(content) {
      const contacts = extractContacts(content, sourceUrl);
      contacts.emails.forEach(item => addContact('emails', item.value, item.evidence));
      contacts.phones.forEach(item => addContact('phones', item.value, item.evidence));
      return contacts;
    }
    function addPerson(person) {
      const name = nameValue(person.name);
      if (!name) return;
      const normalized = {name, role:clean(person.role).slice(0, 100), email:emailValue(person.email), phone:phoneValue(person.phone), sourceUrl, evidence:snippet(person.evidence)};
      if (normalized.email) { normalized.emailSourceUrl = sourceUrl; normalized.emailEvidence = snippet(person.emailEvidence || person.evidence); }
      if (normalized.phone) { normalized.phoneSourceUrl = sourceUrl; normalized.phoneEvidence = snippet(person.phoneEvidence || person.evidence); }
      const existing = result.people.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing) {
        ['role','email','phone','emailSourceUrl','phoneSourceUrl','emailEvidence','phoneEvidence'].forEach(key => { if (!existing[key] && normalized[key]) existing[key] = normalized[key]; });
      } else result.people.push(normalized);
    }
    function addLink(href, label) {
      const url = validatePublicUrl(decode(href), sourceUrl);
      if (url && !result.links.some(link => link.url === url)) result.links.push({url, label:clean(label).slice(0, 120)});
    }
    function parseStructuredData(payloads) {
      const nodes = [], ids = new Map(), excluded = new Set(), excludedIds = new Set(), businessNodes = new Set();
      function walk(value, path, depth) {
        const excludedPath = path.some(key => /^(?:author|creator|review|reviewer|customer|testimonial|comment|publisher)$/i.test(key));
        if (excludedPath && typeof value === 'string') excludedIds.add(value);
        if (!value || typeof value !== 'object' || depth > 24 || nodes.length > 3000) return;
        if (Array.isArray(value)) { value.forEach(item => walk(item, path, depth + 1)); return; }
        nodes.push(value);
        if (typeof value['@id'] === 'string') ids.set(value['@id'], Object.assign({}, ids.get(value['@id']) || {}, value));
        if (excludedPath) {
          excluded.add(value);
          if (typeof value['@id'] === 'string') excludedIds.add(value['@id']);
        }
        Object.entries(value).forEach(([key, child]) => walk(child, path.concat(key), depth + 1));
      }
      payloads.forEach(payload => walk(payload, [], 0));
      const types = node => (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).map(type => String(type || '').split(/[\/#]/).pop());
      const resolve = value => typeof value === 'string' ? ids.get(value) : value && value['@id'] && ids.has(value['@id']) ? Object.assign({}, ids.get(value['@id']), value) : value;
      const values = value => Array.isArray(value) ? value : value == null ? [] : [value];
      const firstContact = (node, key) => values(node[key]).map(value => typeof value === 'string' ? value : '').find(Boolean) || '';
      function addOrganizationContact(kind, value, evidence) {
        if (typeof value !== 'string') return;
        const parsed = addContact(kind, value, evidence);
        if (parsed) organizationContacts[kind].add(parsed);
      }
      function isExcluded(person) { return excluded.has(person) || (person && excludedIds.has(person['@id'])); }
      nodes.forEach(node => {
        if (types(node).some(type => /(?:Organization|LocalBusiness|Corporation|Store|Restaurant|Salon|Dentist|MedicalBusiness|ProfessionalService|Agency|Hotel|Company|CafeOrCoffeeShop|RealEstateAgent|LegalService|AutoRepair|Electrician|Plumber|School|HealthClub)$/i.test(type))) businessNodes.add(node);
      });
      for (const org of businessNodes) {
        if (!result.businessName && typeof org.name === 'string') result.businessName = clean(org.name).slice(0, 160);
        values(org.email).forEach(value => addOrganizationContact('emails', value, 'Published organization email: ' + value));
        values(org.telephone).forEach(value => addOrganizationContact('phones', value, 'Published organization telephone: ' + value));
        values(org.contactPoint).map(resolve).filter(Boolean).forEach(contact => {
          values(contact.email).forEach(value => addOrganizationContact('emails', value, 'Organization contact point: ' + value));
          values(contact.telephone).forEach(value => addOrganizationContact('phones', value, 'Organization contact point: ' + value));
        });
        ['founder', 'founders', 'employee', 'employees', 'member'].forEach(relation => {
          values(org[relation]).map(resolve).filter(Boolean).forEach(person => {
            if (typeof person !== 'object' || (person['@type'] && !types(person).includes('Person'))) return;
            structuredPerson(person, /founder/.test(relation) ? 'Founder' : relation === 'member' ? 'Team member' : 'Staff');
          });
        });
      }
      function structuredPerson(person, fallbackRole) {
        if (!person || isExcluded(person) || typeof person.name !== 'string') return;
        const role = typeof person.jobTitle === 'string' ? person.jobTitle : fallbackRole || '';
        const email = firstContact(person, 'email'), phone = firstContact(person, 'telephone');
        const evidence = 'JSON-LD Person: ' + person.name + (role ? ' — ' + role : '');
        if (email) addContact('emails', email, evidence + '; email: ' + email);
        if (phone) addContact('phones', phone, evidence + '; telephone: ' + phone);
        addPerson({name:person.name, role, email, phone, evidence, emailEvidence:evidence + '; email: ' + email, phoneEvidence:evidence + '; telephone: ' + phone});
      }
      nodes.forEach(node => {
        if (!types(node).includes('Person') || isExcluded(node)) return;
        const hasWork = values(node.worksFor).map(resolve).some(org => org && (businessNodes.has(org) || (org['@id'] && [...businessNodes].some(biz => biz['@id'] === org['@id'])) || (org.name && [...businessNodes].some(biz => biz.name === org.name))));
        // A job title alone does not prove that an article's author works for the site.
        if (hasWork) structuredPerson(resolve(node), 'Staff');
      });
    }

    function personFromLines(lines) {
      const cleaned = lines.map(line => clean(line).replace(/^[#>*\-\s]+/, '').replace(/\*\*/g, '')).filter(Boolean);
      let name = '', role = '', nameIndex = -1;
      for (let i = 0; i < Math.min(cleaned.length, 8); i++) {
        const line = cleaned[i];
        const pieces = line.split(/\s*(?:—|–|\||,)\s*|\s+-\s+/);
        if (pieces.length >= 2 && nameValue(pieces[0]) && roleValue(pieces.slice(1).join(' '))) {
          name = nameValue(pieces[0]); role = pieces.slice(1).join(' '); nameIndex = i; break;
        }
        if (nameValue(line) && roleValue(cleaned[i + 1])) {
          name = nameValue(line); role = cleaned[i + 1]; nameIndex = i; break;
        }
        if (roleValue(line) && nameValue(cleaned[i + 1] || '')) {
          name = nameValue(cleaned[i + 1]); role = line; nameIndex = i + 1; break;
        }
      }
      if (!name) return null;
      return {name, role, nameIndex, lines:cleaned};
    }

    if (html && typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const payloads = [];
      doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => { try { payloads.push(JSON.parse(script.textContent)); } catch (_) {} });
      parseStructuredData(payloads);
      if (!result.businessName) result.businessName = clean(doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || doc.title || '').slice(0, 160);
      doc.querySelectorAll('script,style,noscript,template,iframe,svg,[hidden],[aria-hidden="true"],[class*="testimonial"],[class*="review-"]').forEach(node => node.remove());
      const visibleText = doc.body ? elementText(doc.body) : '';
      absorbContacts(visibleText);
      // Contacts explicitly labelled as organization details or placed in the
      // site footer stay in the company list, even if repeated beside staff.
      doc.querySelectorAll('footer,[role="contentinfo"]').forEach(block => {
        const contacts = extractContacts(elementText(block), sourceUrl);
        contacts.emails.forEach(item => organizationContacts.emails.add(item.value));
        contacts.phones.forEach(item => organizationContacts.phones.add(item.value));
        block.querySelectorAll('a[href]').forEach(anchor => {
          const href = anchor.getAttribute('href');
          if (/^mailto:/i.test(href)) { const value = emailValue(href); if (value) organizationContacts.emails.add(value); }
          if (/^tel:/i.test(href)) { const value = phoneValue(href); if (value) organizationContacts.phones.add(value); }
        });
      });
      doc.querySelectorAll('a[href]').forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (/^mailto:/i.test(href)) href.slice(7).split('?')[0].split(/[;,]/).forEach(value => addContact('emails', value, anchor.parentElement?.textContent || value));
        else if (/^tel:/i.test(href)) addContact('phones', href, anchor.parentElement?.textContent || href);
        else addLink(href, anchor.textContent);
      });
      const seenBlocks = new Set();
      doc.querySelectorAll(STAFF_CARD_SELECTOR).forEach(block => parseStaffBlock(block, true));
      doc.querySelectorAll('h2,h3,h4,h5').forEach(heading => {
        if (!nameValue(heading.textContent)) return;
        const parent = heading.parentElement;
        if (!parent || /^(?:BODY|MAIN|SECTION)$/.test(parent.tagName) || parent.querySelectorAll('h2,h3,h4,h5').length > 1) return;
        if (parent.textContent.length <= 1800) parseStaffBlock(parent, false);
      });
      function parseStaffBlock(block, isExplicitCard) {
        if (seenBlocks.has(block) || block.closest('header,footer,nav,blockquote,[class*="testimonial"],[class*="review"],article[itemtype*="Article"],[itemprop="author"],[rel="author"],.author,[class*="byline"],[class*="author-"],[class*="-author"]')) return;
        seenBlocks.add(block);
        if (block.querySelector(STAFF_CARD_SELECTOR) || block.querySelectorAll('[itemprop="name"],h2,h3,h4,h5').length > 1) return;
        const heading = block.querySelector('[itemprop="name"],h2,h3,h4,h5');
        const name = heading && nameValue(heading.textContent);
        if (!name) return;
        const title = block.querySelector('[itemprop="jobTitle"],[class*="role"],[class*="position"],[class*="job-title"]');
        const lines = [name];
        if (title) lines.push(title.textContent);
        block.querySelectorAll('p,span,div,a').forEach(node => { if (node !== heading && !node.contains(heading) && node.children.length === 0) lines.push(node.textContent); });
        const parsed = personFromLines(lines);
        if ((!parsed && !isExplicitCard) || (parsed && parsed.name !== name)) return;
        for (let i = 1; i < lines.length; i++) {
          const other = personFromLines(lines.slice(i, i + 2));
          if (other && other.name !== name) return;
        }
        const role = parsed?.role || (title ? clean(title.textContent) : 'Team member');
        // Keep contacts inside a single named staff card; never copy global footer contacts.
        const personalBlock = block.cloneNode(true);
        personalBlock.querySelectorAll('footer,nav,blockquote,[role="contentinfo"],[class*="testimonial"],[class*="review"]').forEach(node => node.remove());
        const evidence = snippet(elementText(personalBlock));
        const contacts = extractContacts(elementText(personalBlock), sourceUrl);
        let email = '', phone = '', emailEvidence = '', phoneEvidence = '';
        personalBlock.querySelectorAll('a[href]').forEach(anchor => {
          const href = anchor.getAttribute('href');
          const parent = anchor.parentElement;
          const context = parent && parent !== personalBlock && parent.querySelectorAll('a').length <= 1 ? elementText(parent) : (anchor.previousSibling?.textContent || '') + ' ' + anchor.textContent;
          if (GENERAL_CONTACT.test(context)) {
            const kind = /^mailto:/i.test(href) ? 'emails' : /^tel:/i.test(href) ? 'phones' : '';
            const value = kind === 'emails' ? emailValue(href) : kind === 'phones' ? phoneValue(href) : '';
            if (value) organizationContacts[kind].add(value);
            return;
          }
          if (!email && /^mailto:/i.test(href)) { const value = emailValue(href); if (value && !GENERAL_MAILBOX.test(value)) { email = value; emailEvidence = context; } }
          if (!phone && /^tel:/i.test(href)) { phone = phoneValue(href); phoneEvidence = context; }
        });
        if (!email) { const candidate = contacts.emails.find(item => !GENERAL_MAILBOX.test(item.value) && !GENERAL_CONTACT.test(item.evidence)); if (candidate) { email = candidate.value; emailEvidence = candidate.evidence; } }
        if (!phone) { const candidate = contacts.phones.find(item => !GENERAL_CONTACT.test(item.evidence)); if (candidate) { phone = candidate.value; phoneEvidence = candidate.evidence; } }
        addPerson({name, role, email, phone, evidence, emailEvidence, phoneEvidence});
      }
    } else if (html) {
      const payloads = [];
      for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
        try { payloads.push(JSON.parse(match[1])); } catch (_) {}
      }
      parseStructuredData(payloads);
    }

    if (text) {
      // Reader markdown is parsed as text, never injected into the page.
      const lines = text.replace(/\r\n?/g, '\n').split('\n');
      const title = text.match(/^Title:\s*(.+)$/m) || text.match(/^#\s+(.+)$/m);
      if (!result.businessName && title) result.businessName = clean(title[1]).slice(0, 160);
      absorbContacts(text);
      for (const match of text.matchAll(/\[([^\]\n]{0,200})\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g)) addLink(match[2], match[1]);
      for (const match of text.matchAll(/\[[^\]\n]*\]\((mailto:[^\s)]+|tel:[^\s)]+)\)/gi)) {
        if (/^mailto:/i.test(match[1])) addContact('emails', match[1], match[0]);
        else addContact('phones', match[1], match[0]);
      }
      const headingIndices = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*#{1,6}\s+/.test(lines[i]) || (/^\s*\*\*[^*]+\*\*\s*$/.test(lines[i]) && !roleValue(lines[i])) || (i + 1 < lines.length && /^\s*[-=]{3,}\s*$/.test(lines[i + 1]))) headingIndices.push(i);
      }
      const sectionStack = [];
      for (let h = 0; h < headingIndices.length; h++) {
        const start = headingIndices[h], end = headingIndices[h + 1] || lines.length;
        const headingMatch = lines[start].match(/^\s*(#{1,6})\s+/);
        const level = headingMatch ? headingMatch[1].length : /^\s*=/.test(lines[start + 1] || '') ? 1 : /^\s*-{3,}/.test(lines[start + 1] || '') ? 2 : 6;
        while (sectionStack.length && sectionStack[sectionStack.length - 1].level >= level) sectionStack.pop();
        sectionStack.push({level, excluded:/\b(?:testimonials?|reviews?|customer stories|article authors?|blog authors?|written by|posted by)\b/i.test(lines[start])});
        if (sectionStack.some(section => section.excluded)) continue;
        const blockLines = lines.slice(start, Math.min(end, start + 18));
        const parsed = personFromLines(blockLines);
        if (!parsed || parsed.nameIndex > 1) continue;
        const content = blockLines.join('\n');
        if (/\b(?:testimonial|reviewed by|review by|article by|written by|posted by)\b/i.test(content)) continue;
        // Only the short contiguous header/role/contact area establishes personal association.
        // Later contact sections or biographies are intentionally excluded.
        const contactLines = [];
        let beganContacts = false;
        for (const line of blockLines.slice(1)) {
          const value = clean(line).replace(/^[>*\-\s]+/, '').replace(/\*\*/g, '');
          if (!value) { if (beganContacts) break; continue; }
          if (roleValue(value) && !beganContacts) continue;
          if (GENERAL_CONTACT.test(value) || /^(?:office|address|copyright)/i.test(value)) break;
          if (value.length > 180 || (!/@|\bat\b|mailto:|tel:|\b(?:phone|mobile|email|tel|direct|call)\b|\+\d/i.test(value) && !phoneValue(value))) break;
          // A differently named contact in this section must never be attached
          // to the heading's person. Only contact labels and values qualify.
          const remainder = deobfuscate(value).replace(/\[([^\]]*)\]\((?:mailto:|tel:)[^)]+\)/gi, '$1')
            .replace(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}/gi, '')
            .replace(/(?:\+?\(?\d[\d(). /\t-]{5,}\d)(?:[ \t]*(?:ext\.?|extension|x)[ \t]*\d{1,8})?/gi, '')
            .replace(/\b(?:email|e-mail|phone|telephone|tel|mobile|cell|direct|line|contact|call|whatsapp|me|work)\b/gi, '')
            .replace(/[\s:;|/()[\]*+.-]/g, '');
          if (remainder) break;
          beganContacts = true; contactLines.push(value);
        }
        const contacts = extractContacts(contactLines.join('\n'), sourceUrl);
        const inlineEmail = contactLines.join('\n').match(/mailto:([^\s)]+)/i);
        const inlinePhone = contactLines.join('\n').match(/tel:([^\s)]+)/i);
        const email = emailValue(inlineEmail?.[1]) || contacts.emails[0]?.value || '';
        addPerson({name:parsed.name, role:parsed.role, email:GENERAL_MAILBOX.test(email) ? '' : email, phone:phoneValue(inlinePhone?.[1]) || contacts.phones[0]?.value || '', evidence:content});
      }
    }
    // Repeated staff contacts and explicitly published company contacts cannot
    // establish an individual match. They remain available as company contacts.
    for (const [field, kind] of [['email', 'emails'], ['phone', 'phones']]) {
      const counts = new Map();
      result.people.forEach(person => { if (person[field]) counts.set(person[field], (counts.get(person[field]) || 0) + 1); });
      result.people.forEach(person => {
        if (person[field] && (organizationContacts[kind].has(person[field]) || counts.get(person[field]) > 1)) {
          person[field] = '';
          delete person[field + 'SourceUrl'];
          delete person[field + 'Evidence'];
        }
      });
    }
    return result;
  }
  const api = Object.freeze({parsePage, validatePublicUrl, escapeCsvCell, emailValue, phoneValue});
  root.LeadExtractParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
