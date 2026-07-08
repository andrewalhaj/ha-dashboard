import os
f = os.path.expanduser("~/wall-dash/index.html")
s = open(f).read()
old = (
    "    // Zoom to fit, with 1.0 ceiling (don't zoom in past native)\n"
    "    var zW = (vw - 4) / contentW;\n"
    "    var zH = (vh - 4) / contentH;\n"
    "    var zoom = Math.min(zW, zH, 1.0);"
)
new = (
    "    // Fit to WIDTH only (1.0 ceiling); height overflows into #scroll (scroll down)\n"
    "    var zW = (vw - 4) / contentW;\n"
    "    var zoom = Math.min(zW, 1.0);"
)
n = s.count(old)
assert n == 1, "expected exactly 1 match, got %d" % n
open(f, "w").write(s.replace(old, new))
print("PATCHED OK")
