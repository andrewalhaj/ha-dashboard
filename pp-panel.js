
// ── Purifier panel logic (VeSync: preset auto/pet/sleep + manual Low/Med/High) ──
var _pp = { key: null, fan: null, timer: null };

function _ppCall(domain, service, data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    id: ++msgId, type: "call_service", domain: domain, service: service,
    target: { entity_id: data.entity_id }, service_data: data
  }));
}

function openPurifierPanel(key) {
  _pp.key = key;                       // "living_room" | "dining_room"
  _pp.fan = "fan." + key;
  updatePurifierPanel();
  var ov = document.getElementById("purifier-panel-overlay");
  if (ov) { ov.style.display = "flex"; document.body.style.overflow = "hidden"; }
  if (_pp.timer) clearInterval(_pp.timer);
  _pp.timer = setInterval(updatePurifierPanel, 2000);   // live ticks while open
}

function closePurifierPanel() {
  var ov = document.getElementById("purifier-panel-overlay");
  if (ov) { ov.style.display = "none"; document.body.style.overflow = ""; }
  if (_pp.timer) { clearInterval(_pp.timer); _pp.timer = null; }
}

function _ppPm25Color(pm) {
  if (pm == null || isNaN(pm)) return "#9a9a9a";
  if (pm <= 12) return "#5fd38a";            // good — green
  if (pm <= 35) return "#f0a546";            // fair — amber
  return "#e6584a";                          // bad — red
}

function _ppDrawRing(pm, aqWord) {
  var c = document.getElementById("pp-ring-canvas");
  if (!c) return;
  var ctx = c.getContext("2d");
  var W = c.width, cx = W / 2, cy = W / 2;
  ctx.clearRect(0, 0, W, W);
  var col = _ppPm25Color(pm);
  // fraction of the ring filled: 0 at pm 0, full at pm 150+
  var frac = Math.max(0.04, Math.min(1, (pm || 0) / 150));
  var rings = [ {r: 104, w: 10, a: 0.22}, {r: 88, w: 8, a: 0.16}, {r: 72, w: 6, a: 0.12} ];
  // faint backing rings
  rings.forEach(function(rg) {
    ctx.beginPath(); ctx.arc(cx, cy, rg.r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255," + rg.a + ")"; ctx.lineWidth = rg.w; ctx.stroke();
  });
  // active arc on the outer ring
  var start = -Math.PI / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 104, start, start + Math.PI * 2 * frac);
  ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.stroke();
  // inner glow dot ring
  ctx.beginPath();
  ctx.arc(cx, cy, 88, start, start + Math.PI * 2 * frac);
  ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = 1;
}

function updatePurifierPanel() {
  if (!_pp.fan) return;
  var k = _pp.key, fanId = _pp.fan;
  var fan = entities[fanId];
  var isOn = fan && fan.state === "on";
  var preset = fan && fan.attributes ? fan.attributes.preset_mode : null;
  var pct = fan && fan.attributes ? fan.attributes.percentage : null;

  var pm = parseFloat(state("sensor." + k + "_pm2_5"));
  var aqWord = state("sensor." + k + "_air_quality");
  if (aqWord === "unknown" || aqWord == null) aqWord = "--";
  var filt = state("sensor." + k + "_filter_lifetime");
  var lock = state("switch." + k + "_child_lock") === "on";
  var disp = state("switch." + k + "_display") === "on";

  var label = (k === "dining_room") ? "Kitchen" : "Living Room";
  _set("pp-name", label + " Purifier");
  _set("pp-sub", "PM2.5 " + (isNaN(pm) ? "--" : pm) + " · Air: " + aqWord);
  _set("pp-aq-word", aqWord);
  _set("pp-pm-num", "PM2.5 " + (isNaN(pm) ? "--" : pm));
  _set("pp-filter-val", (filt === "unknown" || filt == null) ? "--" : filt + "%");
  _ppDrawRing(isNaN(pm) ? 0 : pm, aqWord);

  // mode highlight
  ["auto", "sleep", "pet"].forEach(function(m) {
    _cls("pp-mode-" + m, "on", isOn && preset === m);
  });
  var manualActive = isOn && !preset;     // on but no preset = manual percentage
  _cls("pp-mode-manual", "on", manualActive);
  var sr = document.getElementById("pp-speed-row");
  if (sr) sr.style.display = manualActive ? "grid" : "none";
  if (manualActive) {
    _cls("pp-speed-low", "on", pct != null && pct <= 33);
    _cls("pp-speed-med", "on", pct != null && pct > 33 && pct <= 66);
    _cls("pp-speed-high", "on", pct != null && pct > 66);
  }

  _cls("pp-power", "on", isOn);
  _cls("pp-display", "on", disp);
  _cls("pp-lock", "on", lock);
}

function setPurifierPreset(mode) {
  if (!_pp.fan) return;
  _ppCall("fan", "set_preset_mode", { entity_id: _pp.fan, preset_mode: mode });
  setTimeout(updatePurifierPanel, 400);
}
function setPurifierManual() {
  if (!_pp.fan) return;
  // drop preset by setting a percentage; default to Med if currently off/auto
  var fan = entities[_pp.fan];
  var pct = (fan && fan.attributes && fan.attributes.percentage) || 66;
  _ppCall("fan", "set_percentage", { entity_id: _pp.fan, percentage: pct });
  setTimeout(updatePurifierPanel, 400);
}
function setPurifierSpeed(level) {
  if (!_pp.fan) return;
  var pct = level === "low" ? 33 : level === "high" ? 100 : 66;
  _ppCall("fan", "set_percentage", { entity_id: _pp.fan, percentage: pct });
  setTimeout(updatePurifierPanel, 400);
}
function togglePurifierPower() {
  if (!_pp.fan) return;
  var isOn = entities[_pp.fan] && entities[_pp.fan].state === "on";
  _ppCall("fan", isOn ? "turn_off" : "turn_on", { entity_id: _pp.fan });
  setTimeout(updatePurifierPanel, 400);
}
function togglePurifierSwitch(which) {
  if (!_pp.key) return;
  var sw = "switch." + _pp.key + "_" + which;
  var isOn = state(sw) === "on";
  _ppCall("switch", isOn ? "turn_off" : "turn_on", { entity_id: sw });
  setTimeout(updatePurifierPanel, 400);
}

// small DOM helpers (scoped to avoid clobbering existing names)
function _set(id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt; }
function _cls(id, c, on) { var e = document.getElementById(id); if (e) e.classList.toggle(c, !!on); }
