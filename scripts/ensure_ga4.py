#!/usr/bin/env python3
"""Ensure every static veefivee HTML page has the GA4 Google tag, once."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MEASUREMENT_ID = "G-086Y2TSZTM"
TAG = """<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-086Y2TSZTM"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-086Y2TSZTM');
</script>"""

def main():
    paths = sorted(ROOT.rglob("*.html")) + sorted((ROOT / "blog-templates").glob("*.html.txt"))
    changed = 0
    for path in paths:
        text = path.read_text(encoding="utf-8")
        head = re.search(r"<head(?:\s[^>]*)?>", text, re.I)
        end = re.search(r"</head\s*>", text, re.I)
        if not head or not end or head.end() >= end.start():
            raise ValueError(f"Missing HTML head in {path.relative_to(ROOT)}")
        if MEASUREMENT_ID in text[head.end():end.start()]:
            continue
        text = text[:head.end()] + "\n" + TAG + "\n" + text[head.end():]
        path.write_text(text, encoding="utf-8")
        changed += 1
    print(f"GA4: inspected {len(paths)} HTML pages/templates, updated {changed}")

if __name__ == "__main__":
    main()
