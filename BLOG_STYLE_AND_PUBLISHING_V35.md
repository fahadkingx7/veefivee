# veefivee · Blog publishing and 3D SaaS artwork (v35)

## Visual direction
Use clean, rounded, friendly, polished 3D corporate/SaaS illustration artwork. Soft clay/plastic materials and pastel veefivee purple, lilac, mint, teal, peach, cream and subtle blue. Each blog cover should be an independent complete 16:9 composition, not a cropped triptych. Fresh characters and poses, no repeating the same person, no realistic background faces, no heavy photo-filter effects. Keep visual themes relevant to the article.

### Approved themes
- USA restaurant technology: illustrated restaurant owner with order, reservation and customer-management interfaces.
- USA custom software: illustrated executive with dashboard, software connections, and workflow icons.
- USA small-business website launch: illustrated founder with website preview, launch checklist, search and rocket imagery.
All 3 are optimized 960×540 WebP images in assets/ (~19–29KB), supplied by the user.

## Publishing
Author each blog as standalone, crawlable `blogs/slug.html` with metadata (title, description, blog:title, blog:category, article dates, OG preview, canonical, JSON-LD BlogPosting), shared site header/footer, and GA4 `G-086Y2TSZTM` exactly once.
Each article should be thorough and helpful, targeting actual business-owner needs (especially US intent), plain English, honest claims, useful examples, an opt-in interactive, FAQs and 2–3 meaningful Free Consultation CTAs.
Use `css/blog-article.css`, `css/blog-growth-guides.css` and `js/blog-growth-guides.js`. Keep all interactivity dependency-free; respect reduced motion.
Run `python3 scripts/build_blog_index.py` when new posts are added. That regenerates `data/blog-posts.json`, the static Blog listing, categories, noscript links and sitemap. Keep the static six-card first paint so posts are visible without depending on JavaScript.
Do not create fictional search-volume claims, outcomes, testimonials or locations. SEO is people-first. Do not replace or resize the glass header.
Keep the original Free Consultation form right-aligned on desktop, direct WhatsApp/email/phone cards on the left; mobile order is form first then contact cards. Web3Forms integration must remain functional.
