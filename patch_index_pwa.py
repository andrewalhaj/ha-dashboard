import os
f = os.path.expanduser("~/wall-dash/index.html")
s = open(f).read()
edits = []

# --- 1. <head>: add manifest + apple-touch-icon (theme-color already present) ---
old1 = '<meta name="theme-color" content="#160d12">'
new1 = ('<meta name="theme-color" content="#160d12">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
        '<meta name="apple-mobile-web-app-title" content="Jarvis">')
edits.append(("head meta", old1, new1))

# --- 2. WebSocket: protocol-aware. HTTP path byte-identical; HTTPS -> same-origin /ha-ws ---
old2 = '  ws = new WebSocket(HA_URL.replace("http", "ws") + "/api/websocket");'
new2 = ('  // Protocol-aware: over HTTPS use a same-origin secure proxy (mixed-content safe);\n'
        '  // over HTTP keep the original direct connection unchanged.\n'
        '  var wsUrl = (location.protocol === "https:")\n'
        '    ? "wss://" + location.host + "/ha-ws"\n'
        '    : HA_URL.replace("http", "ws") + "/api/websocket";\n'
        '  ws = new WebSocket(wsUrl);')
edits.append(("websocket", old2, new2))

# --- 3. Camera img: absolute http URL -> same-origin relative (nginx already proxies it) ---
old3 = 'src="http://HA_HOST:8123/local/tv_snapshot.png"'
new3 = 'src="/tv_snapshot.png"'
edits.append(("camera img", old3, new3))

# --- 4. Register service worker (before </body>) ---
old4 = "</body>"
new4 = ('<script>\n'
        'if ("serviceWorker" in navigator) {\n'
        '  window.addEventListener("load", function () {\n'
        '    navigator.serviceWorker.register("sw.js").catch(function () {});\n'
        '  });\n'
        '}\n'
        '</script>\n</body>')
edits.append(("sw register", old4, new4))

applied = []
for label, old, new in edits:
    n = s.count(old)
    if n != 1:
        print("HALT [%s]: expected 1 match, got %d — aborting, no write" % (label, n))
        raise SystemExit(1)
    s = s.replace(old, new)
    applied.append(label)

open(f, "w").write(s)
print("APPLIED:", applied)
