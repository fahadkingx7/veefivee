#!/usr/bin/env python3
"""Create visually lossless-looking, appropriately sized mobile homepage industry art."""
from pathlib import Path
from io import BytesIO
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "assets"
NAMES = ("software", "creators", "government", "callcenter",
         "education", "business", "localshops", "freelancers")
for name in NAMES:
    src = ASSETS / f"industry-{name}.webp"
    dst = ASSETS / f"industry-{name}-mobile.webp"
    with Image.open(src) as im:
        im.load()
        target_width = min(960, im.width)
        target_height = round(im.height * target_width / im.width)
        im = im.resize((target_width, target_height), Image.Resampling.LANCZOS)
        im.save(dst, "WEBP", quality=90, method=6, exact=True)
    print(f"{dst.name}: {src.stat().st_size:,} -> {dst.stat().st_size:,} bytes")
