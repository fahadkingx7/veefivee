/* Progressive navigation for the six script-compatible marketing pages.
 * Keep the WebView/document and fixed header alive across page switches.
 * Other pages, downloads, modified clicks and failed requests remain native. */
(function () {
  'use strict';
  if (!window.fetch || !window.DOMParser || !window.VFPage || !history.pushState) return;
  var routes = new Set(['/', '/index.html', '/about.html', '/industries.html', '/services.html', '/products.html', '/contact.html', '/free-consultation.html']);
  if (!routes.has(location.pathname)) return;
  window.VFNavigation = true;
  var active = location.href, pending = null, generation = 0;
  var metadata = 'title,meta[name="description"],meta[name="robots"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[type="application/ld+json"]';
  var announcer = document.createElement('span');
  announcer.className = 'sr-only'; announcer.setAttribute('aria-live', 'polite');
  document.body.appendChild(announcer);
  history.scrollRestoration = 'manual';
  function saveScroll() {
    if (new URL(active).pathname !== location.pathname) return;
    history.replaceState(Object.assign({}, history.state, { vfScroll: [scrollX, scrollY] }), '', location.href);
  }
  function position(url, saved) {
    var anchor;
    try { anchor = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (_) {}
    if (anchor) anchor.scrollIntoView({ behavior: 'instant' });
    else window.scrollTo({ left: saved ? saved[0] : 0, top: saved ? saved[1] : 0, behavior: 'instant' });
  }
  window.addEventListener('pagehide', saveScroll);
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted && history.state && history.state.vfScroll)
      position(new URL(location.href), history.state.vfScroll);
  });
  function stylesheet(href) {
    var existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(function (link) { return link.href === href; });
    if (existing && existing.sheet) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var link = existing || document.createElement('link');
      var timer = setTimeout(function () { finish(new Error('Stylesheet timeout')); }, 8000);
      function finish(error) {
        clearTimeout(timer); link.removeEventListener('load', loaded); link.removeEventListener('error', failed);
        if (error) { if (!existing) link.remove(); reject(error); } else resolve();
      }
      function loaded() { finish(); }
      function failed() { finish(new Error('Stylesheet unavailable')); }
      link.addEventListener('load', loaded); link.addEventListener('error', failed);
      if (!existing) { link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link); }
    });
  }
  async function navigate(url, traversal, saved) {
    var current = ++generation;
    if (pending) pending.abort();
    pending = new AbortController();
    var request = pending;
    var timeout = setTimeout(function () { request.abort(); }, 10000);
    try {
      var response = await fetch(url.href, { signal: request.signal, credentials: 'same-origin' });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html') ||
          (new URL(response.url).origin !== location.origin || !routes.has(new URL(response.url).pathname))) throw new Error('Unsupported response');
      var next = new DOMParser().parseFromString(await response.text(), 'text/html');
      var shell = next.querySelector('.vf-site-shell'), main = next.querySelector('main'), footer = next.querySelector('.site-footer'), pill = next.querySelector('[data-nav-pill]');
      if (!shell || !main || !footer || !pill || !document.querySelector('.vf-site-shell')) throw new Error('Incomplete page');
      // Do not silently skip new page-specific functionality added in the future.
      var supported = Array.from(next.querySelectorAll('body script[src]')).every(function (script) {
        return /\/js\/(main|home-journal|site-navigation)\.js$/.test(new URL(script.getAttribute('src'), url).pathname);
      });
      if (!supported) throw new Error('Page requires native initialization');
      await Promise.all(Array.from(next.querySelectorAll('link[rel="stylesheet"]')).map(function (link) {
        var href = new URL(link.getAttribute('href'), url);
        return href.origin === location.origin ? stylesheet(href.href) : Promise.resolve();
      }));
      if (current !== generation) return;
      if (!traversal) { saveScroll(); history.pushState({ vfScroll: [0, 0] }, '', url.href); }
      window.VFPage.unmount();
      document.querySelector('.vf-site-shell').replaceWith(document.importNode(shell, true));
      // Page-specific body theme must follow the destination when navigating without reload.
      document.body.classList.toggle('vf-consultation-page', next.body.classList.contains('vf-consultation-page'));
      // Keep the glass header node itself; only selected link content changes.
      var currentPill = document.querySelector('[data-nav-pill]');
      currentPill.replaceChildren.apply(currentPill, Array.from(pill.childNodes).map(function (node) { return document.importNode(node, true); }));
      document.querySelectorAll(metadata).forEach(function (node) { node.remove(); });
      next.querySelectorAll(metadata).forEach(function (node) { document.head.appendChild(document.importNode(node, true)); });
      active = url.href;
      position(url, traversal ? saved : null);
      window.VFPage.mount();
      // Refresh the optional journal feed just as a direct page load does.
      var journal = next.querySelector('script[src*="home-journal.js"]');
      if (journal) {
        var enhancement = document.createElement('script');
        enhancement.src = new URL(journal.getAttribute('src'), url).href;
        enhancement.onload = enhancement.onerror = function () { enhancement.remove(); };
        document.body.appendChild(enhancement);
      }
      announcer.textContent = document.title;
      // GA4's enhanced measurement observes pushState; do not send a duplicate page_view.
    } catch (_) {
      if (current === generation) location.assign(url.href);
    } finally {
      clearTimeout(timeout);
      if (current === generation) pending = null;
    }
  }
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !routes.has(url.pathname)) {
      ++generation; if (pending) pending.abort(); return;
    }
    var from = new URL(active);
    var same = url.pathname.replace(/index\.html$/, '') === from.pathname.replace(/index\.html$/, '') && url.search === from.search;
    if (same && url.hash) { saveScroll(); return; }
    event.preventDefault();
    if (same) { ++generation; if (pending) pending.abort(); return; }
    navigate(url, false);
  });
  window.addEventListener('popstate', function (event) {
    var url = new URL(location.href), from = new URL(active);
    if (!routes.has(url.pathname)) { location.reload(); return; }
    if (url.pathname === from.pathname && url.search === from.search) {
      ++generation; if (pending) pending.abort(); active = url.href;
      position(url, event.state && event.state.vfScroll); return;
    }
    navigate(url, true, event.state && event.state.vfScroll);
  });
})();
