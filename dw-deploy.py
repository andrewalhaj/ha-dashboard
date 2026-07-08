#!/usr/bin/env python3
import os
D = os.path.expanduser("~/wall-dash/")
html = open(D + "index.html", encoding="utf-8").read()
css  = open(D + "dashboard.css", encoding="utf-8").read()
tile  = open(D + "dw-tile.html", encoding="utf-8").read()
panel = open(D + "dw-panel.html", encoding="utf-8").read()
pjs   = open(D + "dw-panel.js", encoding="utf-8").read()
pcss  = open(D + "dw-panel.css", encoding="utf-8").read()
rep = []

# 1) idempotency guards
if "kt-dishwasher-card" in html:
    print("ABORT: dishwasher tile already present"); raise SystemExit(1)

# 2) Remove `single` from grid-kitchen (1 tile -> 2 tiles)
old_grid = '<div class="rooms-unified-grid single" id="grid-kitchen" style="display:none;">'
new_grid = '<div class="rooms-unified-grid" id="grid-kitchen" style="display:none;">'
assert html.count(old_grid) == 1, "grid-kitchen anchor count != 1"
html = html.replace(old_grid, new_grid)
rep.append("grid-kitchen: removed 'single' class")

# 3) Insert dishwasher tile right before grid-kitchen's closing.
#    The kitchen grid's purifier tile ends with its </div>; we inject the tile before
#    the </div> that closes #grid-kitchen. Anchor on the purifier meta + closing pattern.
#    Simplest robust anchor: the grid-kitchen block ends at the FIRST '</div>\n        </div>'
#    after new_grid. We find new_grid, then locate the closing of the grid div by matching.
gi = html.index(new_grid)
# find the kt-pm25 meta line, then the tile's closing, then the grid's closing
# We inject after the purifier tile's closing </div> (the one before grid close).
# Locate 'kt-air-quality' (last span of purifier meta) -> next '</div>' closes meta,
# next '</div>' closes the purifier tile. Insert tile after that.
aq = html.index('id="kt-air-quality"', gi)
# meta close
c1 = html.index("</div>", aq)            # closes the <span>... no, closes meta div
c2 = html.index("</div>", c1 + 6)        # closes purifier tile
insert_at = c2 + len("</div>")
html = html[:insert_at] + "\n" + tile.rstrip("\n") + html[insert_at:]
rep.append("dishwasher tile inserted into grid-kitchen")

# 4) Panel HTML — inject before final <script>
idx = html.rfind("<script")
html = html[:idx] + panel + "\n" + html[idx:]
rep.append("panel HTML injected before final <script>")

# 5) Panel JS — inject before final </script>
idx = html.rfind("</script>")
html = html[:idx] + "\n" + pjs + "\n" + html[idx:]
rep.append("panel JS injected before final </script>")

# 6) Hook refreshDishwasherTile() into refreshAll, after the purifier refresh calls
hook_anchor = 'refreshPurifier("fan.dining_room", "kt-purifier-icon", "kt-purifier-state", "kt-pm25", "kt-air-quality");'
n = html.count(hook_anchor)
assert n >= 1, "purifier refresh hook anchor not found"
# add our call after the FIRST occurrence (inside refreshAll)
first = html.index(hook_anchor) + len(hook_anchor)
html = html[:first] + "\n  refreshDishwasherTile();" + html[first:]
rep.append("refreshDishwasherTile() hooked after kitchen purifier refresh (1 of %d anchors)" % n)

# 7) CSS append
if "Dishwasher panel (Bosch Home Connect)" not in css:
    css = css.rstrip() + "\n" + pcss + "\n"
    rep.append("panel CSS appended")

open(D + "index.html", "w", encoding="utf-8").write(html)
open(D + "dashboard.css", "w", encoding="utf-8").write(css)

print("\n".join(rep))
print("--- integrity ---")
print("html <div open:", html.count("<div"), "close:", html.count("</div>"))
print("css braces:", css.count("{"), css.count("}"))
print("openDishwasherPanel refs:", html.count("openDishwasherPanel"))
print("kt-dishwasher-card:", html.count("kt-dishwasher-card"))
print("grid-kitchen single left:", html.count('rooms-unified-grid single" id="grid-kitchen'))
