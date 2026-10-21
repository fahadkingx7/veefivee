# Featured stories on veefivee

The **Stories from the Studio** sections on the Home, About and Services pages show **exactly three articles**:

1. The pinned article defined in `data/blog-featured.json` (always first).
2. The most recently updated other article.
3. The second-most recently updated other article.

To change the pinned story, edit `pinned_url` to an existing article URL as stored in `data/blog-posts.json` (for example, `blogs/restaurant-technology-for-small-business-usa.html`). Use a relative URL, not the full domain.

After adding or editing articles, run:

```bash
python scripts/build_blog_index.py
```

Commit the resulting changes to `data/blog-posts.json`, `blog.html`, `index.html`, `about.html`, `services.html`, and `sitemap.xml` as applicable.

The script validates that the pinned article exists, prevents duplicate featured cards, and fails loudly if the configuration is invalid. The main Blog archive still uses its normal newest-updated-first ordering; only the three featured cards are affected. This uses the existing card markup and styling, without any runtime network request.
