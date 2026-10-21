# veefivee Blog layout and performance rules (v32)

- Keep the original veefivee desktop navigation and six-link mobile header; highlight Blog on desktop only when selected.
- The compact Blog intro must show the first article image on the initial viewport at desktop and mobile sizes. Do not restore the giant hero.
- Preserve the pastel gradients, drifting auras, staggered fade-ins, card hover effects, existing imagery and reduced-motion support.
- Styles: css/blog.css. Interactions: js/blog.js. Shared header: css/blog-nav.css, loaded last.
- Maintain the statically rendered fallback six stories for SEO, and update from data/blog-posts.json as new posts arrive. Do not rerender identical data.
- Keep standard browser caching for the JSON index; GitHub Pages CDN may delay new posts briefly.
- Avoid GPU-expensive blur on the oversized radial gradient auras and repeated card badges; radial color softness is retained.
- Do not add animation libraries or remove existing design features. Cache-bust modified assets via query versions.
- Include GA4 G-086Y2TSZTM on all existing and future HTML pages.
