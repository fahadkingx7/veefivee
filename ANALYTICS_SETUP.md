# veefivee Google Analytics tracking

Google Analytics 4 measurement ID: `G-086Y2TSZTM`.

- Include the provided async gtag.js snippet once within `<head>` of every HTML page, including articles and nested utility pages.
- The template `blog-templates/ARTICLE_TEMPLATE.html.txt` includes the tag.
- Run `python3 scripts/ensure_ga4.py` after adding or updating pages. The workflow `.github/workflows/ensure-ga4.yml` also checks on pushes to main.
- Never add a second tag or replace the configured ID without explicit approval.
- Verify collection after publishing in Google Analytics Realtime. Consider analytics disclosure and consent obligations for relevant visitor jurisdictions.
