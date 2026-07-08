import os
f = os.path.expanduser("~/wall-dash/index.html")
s = open(f).read()

old = """    // Reset zoom to measure natural size
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

new = """    var main   = document.getElementById('main');
    var scroll = document.getElementById('scroll');
    
    // Reset zoom + UNCLIP the layout so it expands to its natural full height.
    // (#app is height:100dvh and #main/#scroll clip internally; zooming that
    // shrinks the box but leaves content clipped + dead space below. To show
    // everything, let the layout grow naturally, THEN zoom the true height.)
    app.style.zoom = '1';
    app.style.height = 'auto';
    if (main)   main.style.overflow = 'visible';
    if (scroll) { scroll.style.overflow = 'visible'; scroll.style.minHeight = '0'; }
    
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var contentW = app.scrollWidth;
    var contentH = app.scrollHeight;   // now the real, unclipped height
    
    // Fit BOTH dimensions so all content is visible without scrolling.
    // Floor 0.4 lets tall content fully fit on the iPad; 1.0 ceiling.
    var zW = (vw - 4) / contentW;
    var zH = (vh - 4) / contentH;
    var zoom = Math.min(zW, zH, 1.0);
    
    app.style.zoom = String(Math.max(zoom, 0.4));"""

n = s.count(old)
assert n == 1, "expected exactly 1 match, got %d" % n
open(f, "w").write(s.replace(old, new))
print("fit() unclip+zoom rewrite OK")
