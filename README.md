# HA Dashboard

A wall-mounted smart home control panel — a single-page vanilla HTML/CSS/JS app that connects to Home Assistant via WebSocket for live device state, real-time updates, and direct control.

## What it does

Serves as the primary physical interface for a smart home. Mounted on a wall display, it provides at-a-glance awareness and touch control for every room, device, and service in the house — without opening an app.

### Views

| Tab | Content |
|---|---|
| **Home** | Overview grid — now playing (TV snapshot), climate dial, Nvidia Shield, Sonos, to-do list, device status, energy usage, activity feed |
| **Rooms** | Per-room device tiles — Living Room, Master Bedroom, Office, Bathroom. Each tile shows on/off state, brightness slider, scene/light controls |
| **Media** | Media playback controls (placeholder — WIP) |
| **Cameras** | Security camera feeds (placeholder — WIP) |

### Sidebar

- **Clock + date** — live updating
- **Weather** — current conditions + 5-day forecast
- **Calendar** — upcoming events with inline add/delete
- **Server monitors** — CPU/RAM sparklines for main + backup servers

### Live Features

- **Real-time state:** WebSocket connection to Home Assistant — state changes push instantly, no polling
- **Direct control:** Toggle lights, fans, TV bias light, set brightness, cycle fan speeds, call scenes — all via HA service calls over the same WebSocket
- **TV snapshot:** Pulls a still from the living room TV for "now playing" awareness
- **Climate:** Thermostat target temperature, current temp, humidity, mode (cooling/heating/idle)
- **Device presence:** Desktop online/offline, phone home/away, battery levels

## Architecture

```
Wall-mounted display (browser)
        │
        │  http://dashboard-host:5051
        ▼
┌──────────────────────────────┐
│  Dashboard host               │
│  nginx:alpine (wall-dash)    │
│  ~/wall-dash/                │
│    ├── index.html  (40KB)    │
│    ├── dashboard.css (23KB)  │
│    └── nginx.conf            │
└──────────────────────────────┘
        │
        │  ws://home-assistant-host:8123
        ▼
┌──────────────────────────────┐
│  Home Assistant              │
│  (Docker, host network)      │
│  Entities + Automations      │
└──────────────────────────────┘
```

- **No framework.** Vanilla JS — the HA WebSocket bridge is ~300 lines of self-contained JavaScript at the bottom of `index.html`. No React for the dashboard itself (the Tweaks panel uses React/Babel loaded from CDN for the admin overlay).
- **No build step.** Edit `index.html` or `dashboard.css` directly on the host, restart the nginx container, done.
- **Network:** nginx binds a local address — configure your firewall/tailscale as needed. Only devices on your private network can reach it.
- **Auth via HA long-lived token.** Stored in `localStorage`. First load prompts for the token; subsequent loads reuse it.
