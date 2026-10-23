#!/usr/bin/env python3
"""Build lightweight homepage-only industry previews without editing originals."""
from pathlib import Path
from PIL import Image
import re

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "index.html"
SOURCE = ROOT / "assets"
NAMES = ("software", "creators", "government", "callcenter", "education", "business", "localshops", "freelancers")
html = PAGE.read_text(encoding="utf-8")
total_old = total_new = 0
for name in NAMES:
    source = SOURCE / f"industry-{name}.webp"
    target = SOURCE / f"industry-{name}-home.webp"
    if not source.is_file():
        raise FileNotFoundError(source)
    with Image.open(source) as image:
        image.load()
        # Two columns top out near 560px each; 1080px leaves ample DPR headroom.
        if image.width > 1080:
            ratio = 1080 / image.width
            image = image.resize((1080, round(image.height * ratio)), Image.Resampling.LANCZOS)
        image.save(target, format="WEBP", quality=88, method=6)
    old = source.stat().st_size
    new = target.stat().st_size
    total_old += old
    total_new += new
    print(f"{name}: {old:,} -> {new:,} bytes ({new/old:.1%})")
    if new >= old:
        target.unlink()
        raise RuntimeError(f"Homepage version for {name} is not smaller than original")
    original_url = f"assets/industry-{name}.webp?v=10"
    if original_url not in html:
        raise RuntimeError(f"Homepage image reference missing: {original_url}")
    html = html.replace(original_url, f"assets/industry-{name}-home.webp?v=1")
if 'loading="lazy"' in html:
    raise RuntimeError("Homepage must not have lazy images")
PAGE.write_text(html, encoding="utf-8")
print(f"Homepage industry bytes: {total_old:,} -> {total_new:,} ({100*(1-total_new/total_old):.1f}% saved)")
