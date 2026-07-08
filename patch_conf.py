import os
f = os.path.expanduser("~/wall-dash/default.conf")
s = open(f).read()

# SACROSANCT: do not touch the listen bind. Add /ha-ws before the /ha-api block.
anchor = "    location /ha-api/ {"
ws_block = (
    "    location /ha-ws {\n"
    "        proxy_pass http://HA_HOST:8123/api/websocket;\n"
    "        proxy_http_version 1.1;\n"
    "        proxy_set_header Upgrade $http_upgrade;\n"
    "        proxy_set_header Connection \"upgrade\";\n"
    "        proxy_set_header Host $host;\n"
    "        proxy_read_timeout 86400;\n"
    "        proxy_send_timeout 86400;\n"
    "    }\n\n"
    "    location /ha-api/ {"
)

# guardrail: bind line should be generic
assert "listen 0.0.0.0:5051;" in s, "BIND LINE MISSING — abort"
n = s.count(anchor)
assert n == 1, "expected 1 anchor, got %d" % n
s = s.replace(anchor, ws_block)
# re-verify bind is generic
assert "listen 0.0.0.0:5051;" in s, "bind integrity broken — abort"
open(f, "w").write(s)
print("APPLIED /ha-ws; bind intact:", "listen 0.0.0.0:5051;" in s)
