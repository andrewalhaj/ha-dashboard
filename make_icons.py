#!/usr/bin/env python3
"""Generate ember/frosted-glass PWA icons for the wall dashboard.
Maskable-safe: glyph kept within the inner 80% safe zone."""
import math
try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "Pillow"], check=True)
    from PIL import Image, ImageDraw

def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def make_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # ember diagonal gradient background (matches dashboard #160d12 -> ember)
    c0 = (0x16, 0x0d, 0x12)   # deep plum
    c1 = (0x3a, 0x1a, 0x22)
    c2 = (0xc4, 0x62, 0x3d)   # ember
    c3 = (0xe8, 0xa8, 0x5a)   # warm gold
    for y in range(size):
        for_t = y / size
        # blend along the diagonal-ish vertical
        if for_t < 0.5:
            col = lerp(c0, c1, for_t/0.5)
        elif for_t < 0.82:
            col = lerp(c1, c2, (for_t-0.5)/0.32)
        else:
            col = lerp(c2, c3, (for_t-0.82)/0.18)
        d.line([(0, y), (size, y)], fill=col + (255,))
    # rounded corners (non-maskable only; maskable fills full bleed)
    radius = int(size * 0.22)
    if not maskable:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
        img.putalpha(mask)
    # glyph: a stylized house/hearth in frosted white, within safe zone
    safe = 0.62 if maskable else 0.74
    cx, cy = size/2, size/2
    s = size * safe
    # house outline
    roof_h = s*0.34
    body_w = s*0.62
    body_h = s*0.46
    apex = (cx, cy - s*0.40)
    left = (cx - body_w/2, cy - s*0.40 + roof_h)
    right = (cx + body_w/2, cy - s*0.40 + roof_h)
    white = (255, 250, 244, 235)
    lw = max(3, int(size*0.025))
    # roof
    d.line([left, apex, right], fill=white, width=lw, joint="curve")
    # body
    bx0, by0 = cx - body_w/2, left[1]
    bx1, by1 = cx + body_w/2, by0 + body_h
    d.line([(bx0, by0), (bx0, by1), (bx1, by1), (bx1, by0)], fill=white, width=lw, joint="curve")
    # ember dot (hearth) glowing in the house
    r = s*0.085
    gx, gy = cx, by1 - body_h*0.40
    d.ellipse([gx-r, gy-r, gx+r, gy+r], fill=(255, 180, 90, 255))
    d.ellipse([gx-r*1.7, gy-r*1.7, gx+r*1.7, gy+r*1.7], outline=(255, 150, 60, 120), width=max(2, int(size*0.012)))
    return img

import os
out = os.path.expanduser("~/wall-dash")
for sz in (192, 512):
    make_icon(sz, maskable=False).save(os.path.join(out, f"icon-{sz}.png"))
    make_icon(sz, maskable=True).save(os.path.join(out, f"icon-{sz}-maskable.png"))
make_icon(180, maskable=False).save(os.path.join(out, "apple-touch-icon.png"))
print("ICONS WRITTEN:", [f for f in os.listdir(out) if f.startswith("icon-") or f.startswith("apple")])
