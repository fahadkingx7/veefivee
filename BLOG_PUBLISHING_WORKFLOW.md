# Publishing a new veefivee blog (required)

The **article HTML alone does not publish a blog to the archive**. The site reads `data/blog-posts.json`, `blog.html` contains initial pre-rendered cards and a JSON fallback, and Home/About/Services each contain their own static three-card “Stories from the Studio” section. If these are not updated together, the article URL works but readers cannot find it, or cached JSON can hide it.

## Exact sequence
1. Write a fully crawlable standalone `blogs/<slug>.html` page using the established veefivee theme. Include `blog:title`, description, category, `article:published_time`, image, accessible alt text, GA4, matching header/footer and SEO metadata.
2. Add/verify the actual WebP cover under `assets/`. A reference in the article HTML does not upload that file. **Verify its blob exists in the current target tree**.
3. In the complete working repo, run `python3 scripts/build_blog_index.py` **before committing**, and commit all generated changes together: `data/blog-posts.json`, `blog.html`, `index.html`, `about.html`, `services.html`, `sitemap.xml`.
4. Verify archive JSON and embedded fallback contain the new slug. Check the Stories from the Studio cards show the newest three posts. Keep the existing 3 / 6 / 9 card design rhythm.
5. Use the *current main commit's tree* as the base for all multi-file GitHub commits. Never use a previous revision's tree as `base_tree_sha` or silently drop other recently added files.
6. Check GitHub Pages and GA4 workflows after the push. Increment `js/blog.js` cache version when its code changes.

The blog listing's JS intentionally merges server JSON with its embedded fallback as protection against an older cached index. This is a safety net, not a substitute for regenerating the index.

## Quick verification
- `data/blog-posts.json` counts all current `blogs/*.html` plus seeded industry guides.
- `blog.html` first three links match JSON's latest three.
- `index.html`, `about.html` and `services.html` each show three latest articles.
- `assets/` contains all blog images referenced in the JSON.
- Sitemap includes each new article URL.
