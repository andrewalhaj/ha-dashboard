# HA Dashboard

A kiosk-style wall-mounted dashboard for Home Assistant — a plain HTML/CSS/JS single-page application served by nginx. No build step, no framework. Edit static files, restart nginx, done.

## Screenshots

> Screenshots live here. Drop in `screenshot-home.png`, `screenshot-rooms.png`, etc. and link them from this section when ready.

## Features

- **Home view** — now-playing TV snapshot, climate control (Sensi thermostat), media players (Nvidia Shield, Sonos), to-do list, energy usage, activity feed
- **Rooms view** — per-room device tiles: lights, fans, switches, brightness sliders, scenes
- **Cameras view** — security camera feeds (WIP / placeholder)
- **Media view** — media playback controls (WIP / placeholder)
- **Sidebar** — live clock + date, current weather + 5-day forecast, calendar with inline add/delete, server CPU/RAM sparklines (dual-host: main + HA host)
- **Real-time state** — WebSocket connection to Home Assistant pushes state changes instantly
- **Direct control** — toggle lights/fans/bias light, set brightness, cycle fan speeds, call scenes via HA service calls over the same WebSocket
- **Tweaks panel** — admin overlay (React/Babel loaded from CDN) for tuning dashboard parameters without editing files
- **System monitor** — optional [Glances](https://nicolargo.github.io/glances/) integration for live CPU/RAM/disk metrics
- **Govee lighting** — optional control of Govee LED devices (lights, strips, lamps) through the Govee public API
- **PWA support** — `manifest.webmanifest`, service worker, offline shell, installable on tablets and phones

## Architecture

```
Browser (kiosk / tablet / phone)
       │
       │  http://dashboard:5051
       ▼
┌──────────────────────┐
│  nginx (alpine)      │
│  default.conf        │
│  ─────────────────── │
│  / → static files    │
│  /ha-ws → HA WS      │
│  /ha-api/ → HA REST  │
│  /govee-api/ → Govee │
│  /glances-api/ ...   │  (optional, commented out)
│  /tv_snapshot.png →  │
│    HA /local/...     │
└──────┬───────────────┘
       │
       ├── ws://ha-host:8123/api/websocket          (Home Assistant)
       ├── http://ha-host:8123/api/                  (Home Assistant REST)
       ├── https://openapi.api.govee.com/...          (Govee cloud, optional)
       └── http://glances-host:61208/api/4/           (Glances, optional)
```

**No build step.** `index.html` + `dashboard.css` + `dashboard.js` are served directly. The HA WebSocket bridge is ~300 lines of self-contained JavaScript at the bottom of `index.html`.

**Auth.** You generate a [long-lived access token](https://www.home-assistant.io/docs/authentication/#your-account-profile) from your HA profile page. The dashboard prompts for it on first load and persists it in `localStorage`. Treat this token as a **secret** — it grants full API access to your Home Assistant instance.

## Setup

### 1. nginx + static files

Serve the dashboard directory with the provided `default.conf`:

```bash
docker run -d \
  --name ha-dashboard \
  -p 5051:5051 \
  -v /path/to/dashboard:/usr/share/nginx/html:ro \
  -v /path/to/default.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
```

### 2. Configure Home Assistant host

Edit `default.conf` — replace every `HA_HOST` placeholder with the hostname or IP of your Home Assistant server (e.g. `192.168.1.10` or `homeassistant.local`).

```nginx
proxy_pass http://HA_HOST:8123/api/websocket;   # → http://192.168.1.10:8123/...
```

Reload nginx after editing.

### 3. Long-lived access token

1. Open your Home Assistant profile at `http://ha-host:8123/profile`
2. Scroll to **Long-Lived Access Tokens**, click **Create Token**
3. Copy the generated token
4. Open the dashboard in a browser — paste the token when prompted
5. Token is saved in `localStorage` and reused on subsequent loads
6. To reset: clear `localStorage` or run `localStorage.removeItem("ha_token")` in the browser console

### 4. Govee lighting (optional)

1. Get a Govee API key from the [Govee Developer Console](https://developer.govee.com/)
2. Copy `govee_config.example.json` to `govee_config.json` and add your key:
   ```json
   {"govee_api_key": "YOUR_API_KEY_HERE"}
   ```
3. Place `govee_config.json` at the nginx web root alongside `index.html`

### 5. Glances system monitor (optional)

1. Install and run [Glances](https://nicolargo.github.io/glances/) on the machines you want to monitor:
   ```bash
   pip install glances
   glances -w
   ```
2. In `default.conf`, uncomment the `location /glances-api/` block and replace `GLANCES_HOST` with the Glances server address
3. Restart nginx

## Mobile / PWA

A lightweight mobile variant lives in `mobile/` (`mobile.js`, `mobile.css`, `mobile.html`) — a pared-down view with quick light toggles, Govee sensor status, and navigation suited to phone screens.

The dashboard is a fully installable **Progressive Web App**:

- `manifest.webmanifest` — app name "Jarvis Home", standalone display, dark theme
- `sw.js` — service worker caches only the UI shell; live-data endpoints (`/ha-api`, `/ha-ws`, `/govee-api`, `/glances-api`) always go to network to avoid stale state
- Install prompt appears on supported browsers (Chrome, Edge, Safari)

## Configuration Reference

| Parameter | File | Description |
|---|---|---|
| `HA_HOST` (4×) | `default.conf` | Home Assistant server address (replace all occurrences) |
| `govee_api_key` | `govee_config.json` | Govee Developer API key |
| `GLANCES_HOST` | `default.conf` | Glances server address (uncomment block first) |
| `listen 0.0.0.0:5051` | `default.conf` | Dashboard bind address and port |
| `ha_token` | browser `localStorage` | Home Assistant long-lived access token |

## Deploy Scripts

Utility Python scripts in the repo root assist with deploying or patching the dashboard onto a remote host:

| Script | Purpose |
|---|---|
| `pp-deploy.py` | Injects Purifier Panel HTML/CSS/JS into `index.html` |
| `dw-deploy.py` | Door/window deploy helper |
| `patch_widthfit.py`, `patch_fit.py`, `patch_fit2.py`, `patch_density.py` | Tile layout adjustments for different screen sizes |
| `patch_index_pwa.py` | Patches PWA manifest references into `index.html` |
| `patch_conf.py` | Patches nginx config placeholders |
| `make_icons.py` | Generates PWA icon PNGs from SVG |

## License

MIT
