# LeadExtract × veefivee integration

**Page:** `/leadextract.html`

## What's new
- veefivee native floating header navigation and footer, identical to the website.
- Original LeadExtract app shell styled to match Inter typography, purple/aurora accents, frosted glass cards, and rounded controls.
- Original demo functionality preserved: search simulation, filtering, results, saved vault, 14-column CSV, test parser, blocklist, queue log.
- Original 90 KB inline JS extracted to `js/leadextract.js` for cacheability.
- Old Tailwind runtime CDN dependency replaced by compiled `css/leadextract.css` (no Tailwind browser compiler).
- Dedicated page metadata, canonical, OpenGraph, and schema.org demo SoftwareApplication structured data.
- Entry link added to `products.html`; update sitemap.xml, llms.txt and llms-full.txt.

## Important source behavior
The uploaded HTML is a **synthetic interactive demonstration**. It generates fictitious local-business profiles and contact information in browser JavaScript. It does not perform live Google searches or retrieve verified businesses from the public Internet. This limitation is prominent on the new page. Real live data acquisition would require a separate backend and legally compliant data services, not merely a theme change.

## Deployment
Upload this folder to the web root of veefivee.com (or merge changes from the changes-only package). Preview with a local HTTP server rather than relying on `file://` when testing links. The existing site is not changed on GitHub until you merge/upload.

## Files added/modified
New: leadextract.html, css/leadextract.css, js/leadextract.js.
Modified: products.html, sitemap.xml, llms.txt, llms-full.txt.
