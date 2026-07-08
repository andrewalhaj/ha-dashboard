import os
f = os.path.expanduser("~/wall-dash/index.html")
s = open(f).read()

old = """    // Reset zoom to measure natural size
    app.style.zoom = '1';
    
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var sbW = sidebar ? sidebar.getBoundingClientRect().width : 332;
    var contentW = app.scrollWidth;
    var contentH = app.scrollHeight;
    
    // Zoom to fit, with 1.0 ceiling (don't zoom in past native)
    var zW = (vw - 4) / contentW;
    var zH = (vh - 4) / contentH;
    var zoom = Math.min(zW, zH, 1.0);
    
    app.style.zoom = String(Math.max(zoom, 0.5));"""

new = """    // Reset zoom to measure natural size
    app.style.zoom = '1';
    
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var contentW = app.scrollWidth;
    
    // TRUE content height: #scroll clips internally, so app.scrollHeight is
    // clamped to the viewport. Measure the real height of each column and
    // take the tallest. Main column = topbar + full (unclipped) scroll content.
    var main   = document.getElementById('main');
    var scroll = document.getElementById('scroll');
    var topbar = document.getElementById('topbar');
    var mainNeeded = 0;
    if (main && scroll) {
      var cs = getComputedStyle(main);
      var padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      var topH = topbar ? topbar.getBoundingClientRect().height : 0;
      mainNeeded = topH + scroll.scrollHeight + padV;
    }
    var sideNeeded = sidebar ? sidebar.scrollHeight : 0;
    var contentH = Math.max(mainNeeded, sideNeeded, app.scrollHeight);
    
    // Fit BOTH width and height so all content is visible without scrolling.
    // Floor 0.4 allows tall content to fully fit on the iPad; 1.0 ceiling.
    var zW = (vw - 4) / contentW;
    var zH = (vh - 4) / contentH;
    var zoom = Math.min(zW, zH, 1.0);
    
    app.style.zoom = String(Math.max(zoom, 0.4));"""

n = s.count(old)
assert n == 1, "expected exactly 1 match, got %d" % n
open(f, "w").write(s.replace(old, new))
print("fit() rewritten OK")
