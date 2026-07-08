#!/usr/bin/env python3
import os, re, io

D = os.path.expanduser("~/wall-dash/")
html = open(D + "index.html", encoding="utf-8").read()
css  = open(D + "dashboard.css", encoding="utf-8").read()

panel_html = open(D + "pp-panel.html", encoding="utf-8").read()
panel_css  = open(D + "pp-panel.css", encoding="utf-8").read()
panel_js   = open(D + "pp-panel.js", encoding="utf-8").read()

report = []

# 1) HTML: inject panel markup right before </script> ... actually before the final </body>/</html>.
#    Insert just before the closing </script> is wrong (markup). Insert the panel HTML right
#    before the <script ...> that contains the app, i.e. just before "</script>\n</html>" we want
#    markup BEFORE <script>. Simplest robust anchor: insert before the line that opens the main app.
#    We inject markup immediately after the existing fan-panel-overlay block's closing.
#    Anchor: the fan-panel-overlay div ends; find it and inject after its matching close.
anchor = '<div id="purifier-panel-overlay"'
if anchor in html:
    report.append("PANEL HTML already present — skipping markup insert")
else:
    # find end of fan panel overlay: search for 'id="fan-panel-overlay"' then the next standalone
    # '</div>\n</div>' won't be reliable; instead inject right before the main app <script> tag.
    # The app script is the LAST <script> before </html>. Inject markup before it.
    idx = html.rfind("<script")
    assert idx != -1, "no <script> found"
    html = html[:idx] + panel_html + "\n" + html[idx:]
    report.append("PANEL HTML injected before final <script>")

# 2) JS: inject functions right before the final "</script>"
if "function openPurifierPanel" in html:
    report.append("PANEL JS already present — skipping JS insert")
else:
    idx = html.rfind("</script>")
    assert idx != -1, "no </script> found"
    html = html[:idx] + "\n" + panel_js + "\n" + html[idx:]
    report.append("PANEL JS injected before final </script>")

# 3) Rewire the Speed buttons: malformed nested double-quotes -> open the panel (single-quote arg)
#    living room
before_lr = 'onclick="cyclePurifierSpeed("fan.living_room")"'
after_lr  = "onclick=\"openPurifierPanel('living_room')\""
before_kt = 'onclick="cyclePurifierSpeed("fan.dining_room")"'
after_kt  = "onclick=\"openPurifierPanel('dining_room')\""
n1 = html.count(before_lr); html = html.replace(before_lr, after_lr)
n2 = html.count(before_kt); html = html.replace(before_kt, after_kt)
report.append(f"Speed button rewired: living_room x{n1}, dining_room x{n2}")
assert n1 == 1 and n2 == 1, f"speed rewire count off: lr={n1} kt={n2}"

# 4) CSS: append panel styles
if "#purifier-panel {" in css:
    report.append("PANEL CSS already present — skipping")
else:
    css = css.rstrip() + "\n" + panel_css + "\n"
    report.append("PANEL CSS appended")

# write back
open(D + "index.html", "w", encoding="utf-8").write(html)
open(D + "dashboard.css", "w", encoding="utf-8").write(css)

# integrity
print("\n".join(report))
print("--- integrity ---")
print("html <div open:", html.count("<div"), "close:", html.count("</div>"))
print("css braces:", css.count("{"), css.count("}"))
print("openPurifierPanel refs:", html.count("openPurifierPanel"))
print("cyclePurifierSpeed left:", html.count("cyclePurifierSpeed("))
