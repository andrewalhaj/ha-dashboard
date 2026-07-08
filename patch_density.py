import os
f = os.path.expanduser("~/wall-dash/dashboard.css")
s = open(f).read()

# Each tuple: (label, old, new) — surgical, unique anchors
edits = [
    # 1. Camera hero — the single biggest vertical hog. 16/8.5 -> 16/6.2
    ("camera aspect", "  aspect-ratio: 16 / 8.5;", "  aspect-ratio: 16 / 6.2;"),
    # 2. Home grid row gap 1.3rem -> 0.85rem
    ("grid gap", "  grid-template-rows: auto auto auto;\n  gap: 1.3rem;", "  grid-template-rows: auto auto auto;\n  gap: 0.85rem;"),
    # 3. Media tiles (shield/sonos/desktop/phone) min-height 12rem -> 9.2rem
    ("media min-height", "  min-height: 12rem;\n}\n.media-head", "  min-height: 9.2rem;\n}\n.media-head"),
    # 4. #main top padding 1.5rem -> 0.8rem
    ("main padding", "  padding: 1.5rem 2.4rem 0;", "  padding: 0.8rem 2.4rem 0;"),
    # 5. #scroll padding top/bottom trim
    ("scroll padding", "#scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0.9rem 0.4rem 2rem 0; }",
     "#scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0.4rem 0.4rem 0.6rem 0; }"),
]

applied = []
for label, old, new in edits:
    n = s.count(old)
    if n != 1:
        print("SKIP/ERROR [%s]: expected 1 match, got %d" % (label, n))
        continue
    s = s.replace(old, new)
    applied.append(label)

open(f, "w").write(s)
print("APPLIED:", applied)
print("TOTAL applied:", len(applied), "of", len(edits))
