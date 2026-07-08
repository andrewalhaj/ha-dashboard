// ── Jarvis Mobile (Phase 2) ──────────────────────────────────────
// The Caddy reverse proxy at the same origin routes /ha-ws to the HA host,
// so the WS URL is derived from location.host at runtime — no hardcoded IP needed.
const HA_URL = "";
// ⚠️ WARNING: The HA long-lived access token stored in localStorage under key "ha_token"
// grants full access to your Home Assistant instance. Treat it as a secret.
let token = localStorage.getItem("ha_token") || "";
let ws = null, entities = {}, msgId = 0;

const $ = (id) => document.getElementById(id);
function state(e) { return entities[e]?.state ?? "unknown"; }
function attr(e, k) { return entities[e]?.attributes?.[k]; }
function known(v) { return v != null && v !== "unknown" && v !== "unavailable"; }

// Quick lights shown on Home (entity -> label)
const LIGHTS = [
  ["light.living_room_lamp", "LR Lamp"],
  ["light.lantern_lamp", "Lantern"],
  ["light.tv_bias_light", "TV Bias"],
  ["light.office_light", "Office"],
];

// Govee light -> live-state sensor (from wall)
const GOVEE_SENSOR = {
  "light.living_room_lamp": "sensor.govee_lrl",
  "light.lantern_lamp":     "sensor.govee_lantern",
  "light.office_light":     "sensor.govee_officelt",
  "light.bathroom_1":       "sensor.govee_bath1",
  "light.tv_bias_light":    "sensor.govee_tvbias",
};
// Govee scene input_select per controllable surface (from wall)
const GOVEE_SCENE = {
  "light.living_room_lamp": "input_select.govee_scene_lrl",
  "light.lantern_lamp":     "input_select.govee_scene_lantern",
  "light.tv_bias_light":    "input_select.govee_scene_tvbias",
  "light.office_light":     "input_select.govee_scene_officelt",
  "light.bathroom_1":       "input_select.govee_scene_bath1",
};

// ── Connection ──
function setConn(s) {
  const dot = $("conn-dot");
  if (dot) dot.className = "conn-dot " + (s === "connected" ? "ok" : (s === "connecting" ? "" : "bad"));
  const ms = $("more-status"); if (ms) ms.textContent = s;
}

function connect() {
  if (!token) { showTokenScreen(); return; }
  if (ws) { try { ws.close(); } catch (e) {} }
  setConn("connecting");
  ws = new WebSocket(HA_URL.replace("http", "ws") + "/api/websocket");
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "auth_required") {
      ws.send(JSON.stringify({ type: "auth", access_token: token }));
    } else if (msg.type === "auth_ok") {
      ws.send(JSON.stringify({ id: ++msgId, type: "subscribe_events", event_type: "state_changed" }));
      ws.send(JSON.stringify({ id: ++msgId, type: "get_states" }));
      setConn("connected");
      hideTokenScreen();
    } else if (msg.type === "auth_invalid") {
      localStorage.removeItem("ha_token"); token = "";
      setConn("auth-failed"); showTokenScreen("Token rejected. Paste a valid one.");
    } else if (msg.type === "event" && msg.event?.event_type === "state_changed") {
      entities[msg.event.data.entity_id] = msg.event.data.new_state;
      renderAll();
    } else if (msg.type === "result" && msg.success && Array.isArray(msg.result)) {
      msg.result.forEach(s => { if (s) entities[s.entity_id] = s; });
      renderAll();
    }
  };
  ws.onclose = () => { setConn("disconnected"); setTimeout(connect, 5000); };
  ws.onerror = () => { setConn("error"); };
}

function callService(domain, service, data = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    id: ++msgId, type: "call_service", domain, service,
    service_data: data, target: data.entity_id ? { entity_id: data.entity_id } : {}
  }));
}
function toggleLight(ent) {
  const on = state(ent) === "on";
  callService("light", on ? "turn_off" : "turn_on", { entity_id: ent });
}

// ── Token screen ──
function showTokenScreen(err) {
  $("app").style.display = "none";
  $("token-screen").style.display = "flex";
  if (err) $("token-err").textContent = err;
}
function hideTokenScreen() {
  $("token-screen").style.display = "none";
  $("app").style.display = "flex";
}

// ── Rendering ──
function pad(n) { return String(n).padStart(2, "0"); }
function renderClock() {
  const d = new Date();
  let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  $("tb-time").textContent = h + ":" + pad(d.getMinutes()) + " " + ap;
  $("tb-date").textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function fmtPct(v) { return known(v) ? Math.round(parseFloat(v)) + "%" : "--"; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function purTxt(key) {
  const fan = "fan." + key;
  const on = state(fan) === "on";
  const pm = state("sensor." + key + "_pm2_5");
  const aq = state("sensor." + key + "_air_quality");
  if (!on) return "Off";
  return (known(aq) ? aq : "On") + (known(pm) ? " · PM2.5 " + pm : "");
}

function dishText() {
  const op = state("sensor.dishwasher_operation_state");
  const m = { ready: "Ready", run: "Running", finished: "Finished", delayedstart: "Delayed", pause: "Paused", actionrequired: "Action needed", aborting: "Stopping", inactive: "Off", error: "Error" };
  const key = known(op) ? String(op).toLowerCase().replace(/[^a-z]/g, "") : "";
  let txt = m[key] || (known(op) ? cap(op) : "--");
  const prog = state("sensor.dishwasher_program_progress");
  if (key === "run" && known(prog)) txt = "Running " + prog + "%";
  return { txt, running: key === "run" };
}

function renderHome() {
  // weather (topbar)
  const w = "weather.forecast_forecast";
  const temp = attr(w, "temperature");
  $("tb-temp").textContent = known(temp) ? Math.round(temp) + "°" : "--°";
  $("tb-cond").textContent = known(state(w)) ? state(w) : "--";

  // climate hero
  const c = "climate.sensi_thermostat";
  $("ch-mode").textContent = known(state(c)) ? cap(state(c)) : "--";
  const cur = attr(c, "current_temperature");
  $("ch-cur").textContent = known(cur) ? Math.round(cur) : "--";
  const tgt = attr(c, "temperature");
  $("ch-target").textContent = known(tgt) ? Math.round(tgt) + "°" : "--°";

  // light chips
  const grid = $("light-chips");
  if (grid && !grid.dataset.built) {
    grid.innerHTML = LIGHTS.map(([e, l]) =>
      `<div class="lchip" data-ent="${e}"><span>${l}</span><span class="dot"></span></div>`).join("");
    grid.querySelectorAll(".lchip").forEach(ch =>
      ch.addEventListener("click", () => toggleLight(ch.dataset.ent)));
    grid.dataset.built = "1";
  }
  if (grid) grid.querySelectorAll(".lchip").forEach(ch =>
    ch.classList.toggle("on", state(ch.dataset.ent) === "on"));

  // purifiers
  setVal("pur-lr-val", purTxt("living_room"), state("fan.living_room") === "on");
  setVal("pur-kt-val", purTxt("dining_room"), state("fan.dining_room") === "on");

  // dishwasher
  const dw = dishText();
  setVal("dw-val", dw.txt, dw.running);

  // servers
  $("srv-main-cpu").textContent = fmtPct(state("sensor.main_cpu"));
  $("srv-main-ram").textContent = fmtPct(state("sensor.main_ram"));
  $("srv-bak-cpu").textContent = fmtPct(state("sensor.backup_cpu"));
  $("srv-bak-ram").textContent = fmtPct(state("sensor.backup_ram"));
}

function setVal(id, txt, on) {
  const e = $(id); if (!e) return;
  e.textContent = txt;
  e.classList.toggle("on", !!on);
}

// ── Rooms ──
// Each room is a list of cards. type drives the controls offered.
const ROOMS = {
  living_room: [
    { type: "govee", ent: "light.living_room_lamp", name: "Living Room Lamp" },
    { type: "purifier", key: "living_room", name: "Living Room Purifier" },
  ],
  master_bedroom: [
    { type: "govee", ent: "light.lantern_lamp", name: "Lantern Lamp" },
  ],
  office: [
    { type: "govee", ent: "light.office_light", name: "Office Light" },
  ],
  bathroom: [
    { type: "govee", ent: "light.bathroom_1", name: "Bathroom" },
  ],
  kitchen: [
    { type: "purifier", key: "dining_room", name: "Kitchen Purifier" },
    { type: "dishwasher", name: "Dishwasher" },
  ],
  basement: [
    { type: "info", name: "Basement Washer", entState: "sensor.dishwasher_operation_state", placeholder: "LG ThinQ washer — no remote control API" },
  ],
};
let curRoom = "living_room";

function lightCardHTML(c) {
  const on = state(c.ent) === "on";
  const bri = attr(c.ent, "brightness");
  const briPct = known(bri) ? Math.round(bri / 2.55) : null;
  return `<div class="rcard ${on ? "on" : ""}">
    <div class="rc-top">
      <div class="rc-name">${c.name}</div>
      <button class="rc-toggle ${on ? "on" : ""}" data-toggle="${c.ent}"></button>
    </div>
    <div class="rc-state">${on ? (briPct != null ? briPct + "%" : "On") : "Off"}</div>
    <div class="rc-actions">
      <button class="rc-btn" data-govee="${c.ent}" data-name="${c.name}">Light</button>
      <button class="rc-btn" data-scene="${GOVEE_SCENE[c.ent] || ""}">Scene</button>
    </div>
  </div>`;
}
function purCardHTML(c) {
  const on = state("fan." + c.key) === "on";
  return `<div class="rcard ${on ? "on" : ""}">
    <div class="rc-top">
      <div class="rc-name">${c.name}</div>
      <button class="rc-toggle ${on ? "on" : ""}" data-purtoggle="${c.key}"></button>
    </div>
    <div class="rc-state">${purTxt(c.key)}</div>
    <div class="rc-actions">
      <button class="rc-btn" data-pursheet="${c.key}">Controls</button>
    </div>
  </div>`;
}
function dishCardHTML(c) {
  const dw = dishText();
  return `<div class="rcard ${dw.running ? "on" : ""}">
    <div class="rc-top"><div class="rc-name">${c.name}</div></div>
    <div class="rc-state">${dw.txt}</div>
    <div class="rc-actions">
      <button class="rc-btn" data-dishsheet="1">Controls</button>
    </div>
  </div>`;
}
function infoCardHTML(c) {
  const s = c.entState ? state(c.entState) : "";
  return `<div class="rcard">
    <div class="rc-top"><div class="rc-name">${c.name}</div></div>
    <div class="rc-state">${known(s) ? cap(String(s)) : "--"}</div>
    <div class="rc-note">${c.placeholder || ""}</div>
  </div>`;
}

function renderRooms() {
  const wrap = $("room-cards");
  if (!wrap) return;
  const cards = ROOMS[curRoom] || [];
  wrap.innerHTML = cards.map(c => {
    if (c.type === "govee") return lightCardHTML(c);
    if (c.type === "purifier") return purCardHTML(c);
    if (c.type === "dishwasher") return dishCardHTML(c);
    return infoCardHTML(c);
  }).join("") || `<div class="placeholder">No devices in this room.</div>`;

  // wire card controls
  wrap.querySelectorAll("[data-toggle]").forEach(b =>
    b.addEventListener("click", () => toggleLight(b.dataset.toggle)));
  wrap.querySelectorAll("[data-govee]").forEach(b =>
    b.addEventListener("click", () => openGoveeSheet(b.dataset.govee, b.dataset.name)));
  wrap.querySelectorAll("[data-scene]").forEach(b =>
    b.addEventListener("click", () => { if (b.dataset.scene) openSceneSheet(b.dataset.scene); }));
  wrap.querySelectorAll("[data-purtoggle]").forEach(b =>
    b.addEventListener("click", () => togglePurFromKey(b.dataset.purtoggle)));
  wrap.querySelectorAll("[data-pursheet]").forEach(b =>
    b.addEventListener("click", () => openPurifierSheet(b.dataset.pursheet)));
  wrap.querySelectorAll("[data-dishsheet]").forEach(b =>
    b.addEventListener("click", () => openDishSheet()));
}
function togglePurFromKey(key) {
  const fan = "fan." + key;
  const on = state(fan) === "on";
  callService("fan", on ? "turn_off" : "turn_on", { entity_id: fan });
}

// ── Climate view ──
function renderClimate() {
  const c = "climate.sensi_thermostat";
  const md = state(c);
  $("cb-mode").textContent = known(md) ? cap(md) : "--";
  const cur = attr(c, "current_temperature");
  $("cb-cur").textContent = known(cur) ? Math.round(cur) : "--";
  const tgt = attr(c, "temperature");
  $("cb-target").textContent = known(tgt) ? Math.round(tgt) + "°" : "--°";
  document.querySelectorAll(".cb-modebtn").forEach(b =>
    b.classList.toggle("on", b.dataset.mode === md));
}
function climateStep(delta) {
  const c = "climate.sensi_thermostat";
  const tgt = attr(c, "temperature");
  if (!known(tgt)) return;
  callService("climate", "set_temperature", { entity_id: c, temperature: Math.round(tgt) + delta });
}
function climateMode(mode) {
  callService("climate", "set_hvac_mode", { entity_id: "climate.sensi_thermostat", hvac_mode: mode });
}

function renderAll() {
  renderHome();
  if (!$("view-rooms").hidden) renderRooms();
  if (!$("view-climate").hidden) renderClimate();
  if (_gp.ent) updateGoveeSheet();
  if (_pp.key) updatePurSheet();
  if (_dwOpen) updateDishSheet();
}

// ════════════════════════════════════════════════════════════════
//  GOVEE LIGHT SHEET (color canvas + brightness + presets + scene)
// ════════════════════════════════════════════════════════════════
const _gp = { ent: null, hue: 0, sat: 100, val: 100, pendingRgb: null, pendingBri: null };

function hsvToRgb(h, s, v) {
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0; const s = max ? d / max : 0, v = max;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}
function gpSwatch(r, g, b) { const s = $("gp-swatch"); if (s) s.style.background = `rgb(${r},${g},${b})`; }

function gpDrawCanvas() {
  const cv = $("gp-canvas"); if (!cv) return;
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  const hue = hsvToRgb(_gp.hue, 100, 100);
  ctx.fillStyle = `rgb(${hue[0]},${hue[1]},${hue[2]})`; ctx.fillRect(0, 0, W, H);
  const gh = ctx.createLinearGradient(0, 0, W, 0);
  gh.addColorStop(0, "rgba(255,255,255,1)"); gh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gh; ctx.fillRect(0, 0, W, H);
  const gv = ctx.createLinearGradient(0, 0, 0, H);
  gv.addColorStop(0, "rgba(0,0,0,0)"); gv.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = gv; ctx.fillRect(0, 0, W, H);
}
function gpCursor() {
  const c = $("gp-canvas-cursor"); if (!c) return;
  c.style.left = _gp.sat + "%"; c.style.top = (100 - _gp.val) + "%";
}
function gpHuePreview() {
  const sl = $("gp-hue-slider"), pv = $("gp-hue-preview");
  if (sl) sl.value = _gp.hue;
  const h = hsvToRgb(_gp.hue, 100, 100);
  if (pv) pv.style.background = `rgb(${h[0]},${h[1]},${h[2]})`;
}
function gpSendColour() {
  const rgb = hsvToRgb(_gp.hue, _gp.sat, _gp.val);
  gpSwatch(rgb[0], rgb[1], rgb[2]);
  if (_gp.pendingRgb) clearTimeout(_gp.pendingRgb);
  _gp.pendingRgb = setTimeout(() =>
    callService("light", "turn_on", { entity_id: _gp.ent, rgb_color: rgb }), 300);
}
function gpSendBri(pct) {
  if (_gp.pendingBri) clearTimeout(_gp.pendingBri);
  _gp.pendingBri = setTimeout(() =>
    callService("light", "turn_on", { entity_id: _gp.ent, brightness_pct: pct }), 350);
}

function openGoveeSheet(ent, name) {
  _gp.ent = ent;
  const sId = GOVEE_SENSOR[ent];
  let bri = 50, r = 255, g = 255, b = 255;
  if (sId && entities[sId]) {
    const sa = entities[sId].attributes || {};
    if (sa.brightness != null) bri = Math.round(sa.brightness);
    if (sa.rgb && sa.rgb.length === 3) { r = sa.rgb[0]; g = sa.rgb[1]; b = sa.rgb[2]; }
  }
  const hsv = rgbToHsv(r, g, b); _gp.hue = hsv.h; _gp.sat = hsv.s; _gp.val = hsv.v;
  $("gp-name").textContent = name || "Light";
  gpSwatch(r, g, b);
  const bs = $("gp-bri-slider"), bv = $("gp-bri-val");
  if (bs) bs.value = bri; if (bv) bv.textContent = bri + "%";
  gpDrawCanvas(); gpCursor(); gpHuePreview();
  // scene button -> open scene sheet for this surface
  const scBtn = $("gp-scene-btn");
  if (scBtn) scBtn.style.display = GOVEE_SCENE[ent] ? "block" : "none";
  updateGoveeSheet();
  $("govee-sheet").style.display = "flex"; document.body.style.overflow = "hidden";
}
function updateGoveeSheet() {
  if (!_gp.ent) return;
  const on = state(_gp.ent) === "on";
  const pb = $("gp-power-btn"), pl = $("gp-power-label");
  if (pb) pb.classList.toggle("on", on);
  if (pl) pl.textContent = on ? "ON" : "OFF";
}
function closeGoveeSheet() {
  $("govee-sheet").style.display = "none"; document.body.style.overflow = "";
  _gp.ent = null;
}

function initGoveeSheet() {
  const cv = $("gp-canvas");
  function pick(e) {
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    _gp.sat = Math.max(0, Math.min(100, Math.round((cx / rect.width) * 100)));
    _gp.val = Math.max(0, Math.min(100, Math.round((1 - cy / rect.height) * 100)));
    gpCursor(); gpSendColour();
  }
  let drag = false;
  if (cv) {
    cv.addEventListener("mousedown", e => { drag = true; pick(e); });
    cv.addEventListener("touchstart", e => { drag = true; pick(e); e.preventDefault(); }, { passive: false });
  }
  document.addEventListener("mousemove", e => { if (drag) pick(e); });
  document.addEventListener("touchmove", e => { if (drag) pick(e); }, { passive: false });
  document.addEventListener("mouseup", () => { drag = false; });
  document.addEventListener("touchend", () => { drag = false; });

  const hue = $("gp-hue-slider");
  if (hue) hue.addEventListener("input", () => {
    _gp.hue = parseInt(hue.value); gpHuePreview(); gpDrawCanvas(); gpSendColour();
  });
  const bri = $("gp-bri-slider");
  if (bri) bri.addEventListener("input", () => {
    $("gp-bri-val").textContent = bri.value + "%"; gpSendBri(parseInt(bri.value));
  });
  document.querySelectorAll(".gp-preset").forEach(btn =>
    btn.addEventListener("click", () => {
      const r = +btn.dataset.r, g = +btn.dataset.g, b = +btn.dataset.b;
      gpSwatch(r, g, b);
      const hsv = rgbToHsv(r, g, b); _gp.hue = hsv.h; _gp.sat = hsv.s; _gp.val = hsv.v;
      gpHuePreview(); gpDrawCanvas(); gpCursor();
      callService("light", "turn_on", { entity_id: _gp.ent, rgb_color: [r, g, b] });
    }));
  const pwr = $("gp-power-btn");
  if (pwr) pwr.addEventListener("click", () => {
    const on = !pwr.classList.contains("on");
    pwr.classList.toggle("on", on);
    $("gp-power-label").textContent = on ? "ON" : "OFF";
    callService("light", on ? "turn_on" : "turn_off", { entity_id: _gp.ent });
  });
  $("gp-close").addEventListener("click", closeGoveeSheet);
  $("govee-sheet").addEventListener("click", e => { if (e.target === $("govee-sheet")) closeGoveeSheet(); });
  $("gp-scene-btn").addEventListener("click", () => {
    if (_gp.ent && GOVEE_SCENE[_gp.ent]) openSceneSheet(GOVEE_SCENE[_gp.ent]);
  });
}

// ════════════════════════════════════════════════════════════════
//  SCENE SHEET
// ════════════════════════════════════════════════════════════════
let sceneArt = null;
function loadSceneArt(cb) {
  if (sceneArt) { cb(sceneArt); return; }
  fetch("/scene_art_map.json").then(r => r.json()).then(d => { sceneArt = d; cb(d); })
    .catch(() => { sceneArt = {}; cb({}); });
}
function openSceneSheet(entityId) {
  const grid = $("scene-grid");
  grid.innerHTML = `<div class="scene-loading">Loading scenes…</div>`;
  $("scene-sheet").style.display = "flex"; document.body.style.overflow = "hidden";
  loadSceneArt(art => {
    let opts = (entities[entityId]?.attributes?.options) || [];
    opts = opts.filter(s => !!art[s]);
    if (!opts.length) { grid.innerHTML = `<div class="scene-loading">No scenes found.</div>`; return; }
    const cur = entities[entityId]?.state;
    grid.innerHTML = "";
    opts.forEach(scene => {
      const card = document.createElement("div");
      card.className = "scene-card" + (scene === cur ? " sel" : "");
      card.innerHTML = `<img src="${art[scene]}" alt=""><span class="scene-lbl">${scene}</span>`;
      card.addEventListener("click", () => {
        callService("input_select", "select_option", { entity_id: entityId, option: scene });
        grid.querySelectorAll(".scene-card").forEach(c => c.classList.remove("sel"));
        card.classList.add("sel");
        setTimeout(closeSceneSheet, 350);
      });
      grid.appendChild(card);
    });
  });
}
function closeSceneSheet() { $("scene-sheet").style.display = "none"; document.body.style.overflow = ""; }

// ════════════════════════════════════════════════════════════════
//  PURIFIER SHEET (VeSync: auto/sleep/pet + manual Low/Med/High)
// ════════════════════════════════════════════════════════════════
const _pp = { key: null, fan: null, timer: null };
function _ppCall(domain, service, data) {
  callService(domain, service, data);
}
function ppRingColor(pm) {
  if (pm == null || isNaN(pm)) return "#9a9a9a";
  if (pm <= 12) return "#5fd38a";
  if (pm <= 35) return "#f0a546";
  return "#e6584a";
}
function ppDrawRing(pm) {
  const c = $("pp-ring-canvas"); if (!c) return;
  const ctx = c.getContext("2d"), W = c.width, cx = W / 2, cy = W / 2;
  ctx.clearRect(0, 0, W, W);
  const col = ppRingColor(pm);
  const frac = Math.max(0.04, Math.min(1, (pm || 0) / 150));
  [{ r: 104, w: 10, a: 0.22 }, { r: 88, w: 8, a: 0.16 }, { r: 72, w: 6, a: 0.12 }].forEach(rg => {
    ctx.beginPath(); ctx.arc(cx, cy, rg.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${rg.a})`; ctx.lineWidth = rg.w; ctx.stroke();
  });
  const start = -Math.PI / 2;
  ctx.beginPath(); ctx.arc(cx, cy, 104, start, start + Math.PI * 2 * frac);
  ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 88, start, start + Math.PI * 2 * frac);
  ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = 1;
}
function openPurifierSheet(key) {
  _pp.key = key; _pp.fan = "fan." + key;
  updatePurSheet();
  $("pur-sheet").style.display = "flex"; document.body.style.overflow = "hidden";
  if (_pp.timer) clearInterval(_pp.timer);
  _pp.timer = setInterval(updatePurSheet, 2000);
}
function closePurSheet() {
  $("pur-sheet").style.display = "none"; document.body.style.overflow = "";
  if (_pp.timer) { clearInterval(_pp.timer); _pp.timer = null; }
  _pp.key = null;
}
function updatePurSheet() {
  if (!_pp.fan) return;
  const k = _pp.key, fan = entities[_pp.fan];
  const isOn = fan && fan.state === "on";
  const preset = fan?.attributes?.preset_mode;
  const pct = fan?.attributes?.percentage;
  const pm = parseFloat(state("sensor." + k + "_pm2_5"));
  let aq = state("sensor." + k + "_air_quality");
  if (aq === "unknown" || aq == null) aq = "--";
  const filt = state("sensor." + k + "_filter_lifetime");
  const lock = state("switch." + k + "_child_lock") === "on";
  const disp = state("switch." + k + "_display") === "on";
  const label = (k === "dining_room") ? "Kitchen" : "Living Room";
  _set("pp-name", label + " Purifier");
  _set("pp-sub", "PM2.5 " + (isNaN(pm) ? "--" : pm) + " · Air: " + aq);
  _set("pp-aq-word", aq);
  _set("pp-pm-num", "PM2.5 " + (isNaN(pm) ? "--" : pm));
  _set("pp-filter-val", (filt === "unknown" || filt == null) ? "--" : filt + "%");
  ppDrawRing(isNaN(pm) ? 0 : pm);
  ["auto", "sleep", "pet"].forEach(m => _cls("pp-mode-" + m, "on", isOn && preset === m));
  const manual = isOn && !preset;
  _cls("pp-mode-manual", "on", manual);
  const sr = $("pp-speed-row"); if (sr) sr.style.display = manual ? "grid" : "none";
  if (manual) {
    _cls("pp-speed-low", "on", pct != null && pct <= 33);
    _cls("pp-speed-med", "on", pct != null && pct > 33 && pct <= 66);
    _cls("pp-speed-high", "on", pct != null && pct > 66);
  }
  _cls("pp-power", "on", isOn);
  _cls("pp-display", "on", disp);
  _cls("pp-lock", "on", lock);
}
function setPurPreset(mode) { if (_pp.fan) { _ppCall("fan", "set_preset_mode", { entity_id: _pp.fan, preset_mode: mode }); setTimeout(updatePurSheet, 400); } }
function setPurManual() {
  if (!_pp.fan) return;
  const fan = entities[_pp.fan];
  const pct = fan?.attributes?.percentage || 66;
  _ppCall("fan", "set_percentage", { entity_id: _pp.fan, percentage: pct });
  setTimeout(updatePurSheet, 400);
}
function setPurSpeed(level) {
  if (!_pp.fan) return;
  const pct = level === "low" ? 33 : level === "high" ? 100 : 66;
  _ppCall("fan", "set_percentage", { entity_id: _pp.fan, percentage: pct });
  setTimeout(updatePurSheet, 400);
}
function togglePurPower() {
  if (!_pp.fan) return;
  const on = entities[_pp.fan] && entities[_pp.fan].state === "on";
  _ppCall("fan", on ? "turn_off" : "turn_on", { entity_id: _pp.fan });
  setTimeout(updatePurSheet, 400);
}
function togglePurSwitch(which) {
  if (!_pp.key) return;
  const sw = "switch." + _pp.key + "_" + which;
  const on = state(sw) === "on";
  _ppCall("switch", on ? "turn_off" : "turn_on", { entity_id: sw });
  setTimeout(updatePurSheet, 400);
}

// ════════════════════════════════════════════════════════════════
//  DISHWASHER SHEET (Bosch Home Connect)
// ════════════════════════════════════════════════════════════════
let _dwOpen = false, _dwTimer = null;
function _dwCall(domain, service, data) { callService(domain, service, data); }
function _dwOp() {
  const s = state("sensor.dishwasher_operation_state");
  if (!known(s)) return "--";
  const m = { ready: "Ready", run: "Running", delayedstart: "Delayed", finished: "Finished", pause: "Paused", actionrequired: "Action needed", aborting: "Stopping", inactive: "Off", error: "Error" };
  const key = String(s).toLowerCase().replace(/[^a-z]/g, "");
  return m[key] || cap(s);
}
function _dwFinish() {
  const f = state("sensor.dishwasher_program_finish_time");
  if (!known(f)) return null;
  const d = new Date(f);
  return isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function dwDrawRing(pct) {
  const c = $("dw-ring-canvas"); if (!c) return;
  const ctx = c.getContext("2d"), W = c.width, cx = W / 2, cy = W / 2;
  ctx.clearRect(0, 0, W, W);
  const frac = Math.max(0, Math.min(1, (pct || 0) / 100));
  ctx.beginPath(); ctx.arc(cx, cy, 104, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 12; ctx.stroke();
  const start = -Math.PI / 2;
  const grad = ctx.createLinearGradient(0, 0, W, W);
  grad.addColorStop(0, "rgba(255,205,110,0.95)"); grad.addColorStop(1, "rgba(240,165,70,0.92)");
  ctx.beginPath(); ctx.arc(cx, cy, 104, start, start + Math.PI * 2 * frac);
  ctx.strokeStyle = grad; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.stroke();
}
function openDishSheet() {
  _dwOpen = true;
  updateDishSheet();
  $("dw-sheet").style.display = "flex"; document.body.style.overflow = "hidden";
  if (_dwTimer) clearInterval(_dwTimer);
  _dwTimer = setInterval(updateDishSheet, 3000);
}
function closeDishSheet() {
  _dwOpen = false;
  $("dw-sheet").style.display = "none"; document.body.style.overflow = "";
  if (_dwTimer) { clearInterval(_dwTimer); _dwTimer = null; }
}
function updateDishSheet() {
  const power = state("switch.dishwasher_power") === "on";
  const op = _dwOp();
  const running = op === "Running" || op === "Delayed" || op === "Paused";
  const door = state("sensor.dishwasher_door");
  const doorTxt = known(door) ? cap(String(door)) : "--";
  _setT("dw-sub", op + " · Door " + doorTxt);
  const prog = parseFloat(state("sensor.dishwasher_program_progress"));
  _setT("dw-pct", running ? ((isNaN(prog) ? 0 : Math.round(prog)) + "%") : op);
  const ft = _dwFinish();
  _setT("dw-finish-c", (running && ft) ? ("Done ~" + ft) : "");
  dwDrawRing(isNaN(prog) ? 0 : prog);
  const sel = state("select.dishwasher_selected_program");
  const act = state("select.dishwasher_active_program");
  const cur = known(act) ? act : sel;
  document.querySelectorAll("#dw-programs .dw-prog").forEach(b =>
    b.classList.toggle("on", b.dataset.prog === cur));
  _clsT("dw-opt-halfload", "on", state("switch.dishwasher_half_load") === "on");
  _clsT("dw-opt-hygiene", "on", state("switch.dishwasher_hygiene") === "on");
  _clsT("dw-opt-zeolite", "on", state("switch.dishwasher_zeolite_dry") === "on");
  _clsT("dw-power", "on", power);
  const armed = state("binary_sensor.dishwasher_remote_start") === "on";
  const hint = $("dw-remote-hint"); if (hint) hint.style.display = armed ? "none" : "block";
  const sb = $("dw-start"); if (sb) sb.classList.toggle("disabled", !armed);
  const saltLow = state("sensor.dishwasher_salt_nearly_empty") === "on";
  const rinseLow = state("sensor.dishwasher_rinse_aid_nearly_empty") === "on";
  const se = $("dw-salt"), re = $("dw-rinse");
  if (se) { se.textContent = saltLow ? "Salt LOW" : "Salt OK"; se.classList.toggle("warn", saltLow); }
  if (re) { re.textContent = rinseLow ? "Rinse aid LOW" : "Rinse aid OK"; re.classList.toggle("warn", rinseLow); }
}
function setDishProg(prog) { _dwCall("select", "select_option", { entity_id: "select.dishwasher_selected_program", option: prog }); setTimeout(updateDishSheet, 500); }
function toggleDishSwitch(ent) { const on = state(ent) === "on"; _dwCall("switch", on ? "turn_off" : "turn_on", { entity_id: ent }); setTimeout(updateDishSheet, 500); }
function toggleDishPower() { const on = state("switch.dishwasher_power") === "on"; _dwCall("switch", on ? "turn_off" : "turn_on", { entity_id: "switch.dishwasher_power" }); setTimeout(updateDishSheet, 500); }
function startDish() {
  if (state("binary_sensor.dishwasher_remote_start") !== "on") return;
  const sel = state("select.dishwasher_selected_program");
  if (known(sel)) _dwCall("select", "select_option", { entity_id: "select.dishwasher_active_program", option: sel });
  setTimeout(updateDishSheet, 600);
}
function stopDish() {
  callService("button", "press", { entity_id: "button.dishwasher_stop_program" });
  setTimeout(updateDishSheet, 600);
}

// small DOM helpers
function _set(id, txt) { const e = $(id); if (e) e.textContent = txt; }
function _cls(id, c, on) { const e = $(id); if (e) e.classList.toggle(c, !!on); }
function _setT(id, txt) { const e = $(id); if (e) e.textContent = txt; }
function _clsT(id, c, on) { const e = $(id); if (e) e.classList.toggle(c, !!on); }

// ── Nav ──
function switchView(v) {
  document.querySelectorAll(".view").forEach(s => s.hidden = (s.id !== "view-" + v));
  document.querySelectorAll(".bn-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  document.querySelector(".views").scrollTop = 0;
  if (v === "rooms") renderRooms();
  if (v === "climate") renderClimate();
}

// ── Boot ──
document.addEventListener("DOMContentLoaded", () => {
  $("token-save").addEventListener("click", () => {
    const t = $("token-input").value.trim();
    if (!t) { $("token-err").textContent = "Paste a token first."; return; }
    token = t; localStorage.setItem("ha_token", t);
    $("token-err").textContent = ""; connect();
  });
  document.querySelectorAll(".bn-btn").forEach(b =>
    b.addEventListener("click", () => switchView(b.dataset.view)));
  document.querySelectorAll(".rs-btn").forEach(b =>
    b.addEventListener("click", () => {
      curRoom = b.dataset.room;
      document.querySelectorAll(".rs-btn").forEach(x => x.classList.toggle("active", x === b));
      renderRooms();
    }));
  $("more-reconnect").addEventListener("click", connect);
  $("more-forget").addEventListener("click", () => {
    localStorage.removeItem("ha_token"); token = "";
    if (ws) try { ws.close(); } catch (e) {}
    showTokenScreen("Token cleared.");
  });

  // climate controls
  $("cb-down").addEventListener("click", () => climateStep(-1));
  $("cb-up").addEventListener("click", () => climateStep(1));
  document.querySelectorAll(".cb-modebtn").forEach(b =>
    b.addEventListener("click", () => climateMode(b.dataset.mode)));

  // sheets
  initGoveeSheet();
  $("scene-close").addEventListener("click", closeSceneSheet);
  $("scene-sheet").addEventListener("click", e => { if (e.target === $("scene-sheet")) closeSceneSheet(); });
  $("pp-close").addEventListener("click", closePurSheet);
  $("pur-sheet").addEventListener("click", e => { if (e.target === $("pur-sheet")) closePurSheet(); });
  $("dw-close").addEventListener("click", closeDishSheet);
  $("dw-sheet").addEventListener("click", e => { if (e.target === $("dw-sheet")) closeDishSheet(); });

  renderClock();
  setInterval(renderClock, 10000);

  if (token) { hideTokenScreen(); connect(); }
  else showTokenScreen();
});
