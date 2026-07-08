
// ── Dishwasher (Bosch Home Connect) ──────────────────────────────
var _dw = { timer: null };
var DW_PROG_NAMES = {
  "dishcare_dishwasher_program_intensiv_70": "Intensive 70°",
  "dishcare_dishwasher_program_auto_2": "Auto",
  "dishcare_dishwasher_program_eco_50": "Eco 50°",
  "dishcare_dishwasher_program_glas_40": "Glass 40°",
  "dishcare_dishwasher_program_quick_45": "Quick 45°",
  "dishcare_dishwasher_program_pre_rinse": "Pre-Rinse",
  "dishcare_dishwasher_program_quick_65": "Quick 65°",
  "dishcare_dishwasher_program_machine_care": "Machine Care"
};

function _dwCall(domain, service, data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    id: ++msgId, type: "call_service", domain: domain, service: service,
    target: { entity_id: data.entity_id }, service_data: data
  }));
}

function _dwOpState() {
  // map Home Connect operation_state enum to a friendly word
  var s = state("sensor.dishwasher_operation_state");
  if (!s || s === "unknown" || s === "unavailable") return "--";
  var m = {
    "ready": "Ready", "run": "Running", "delayedstart": "Delayed",
    "finished": "Finished", "pause": "Paused", "actionrequired": "Action needed",
    "aborting": "Stopping", "inactive": "Off", "error": "Error"
  };
  var key = String(s).toLowerCase().replace(/[^a-z]/g, "");
  return m[key] || (s.charAt(0).toUpperCase() + s.slice(1));
}

function _dwFinish() {
  var f = state("sensor.dishwasher_program_finish_time");
  if (!f || f === "unknown" || f === "unavailable") return null;
  var d = new Date(f);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── Kitchen tile sync (called from refreshAll) ──
function refreshDishwasherTile() {
  var icon = document.getElementById("kt-dw-icon");
  var st = document.getElementById("kt-dw-state");
  var pg = document.getElementById("kt-dw-progress");
  var fin = document.getElementById("kt-dw-finish");
  if (!st) return;
  var power = state("switch.dishwasher_power") === "on";
  var op = _dwOpState();
  var running = op === "Running" || op === "Delayed" || op === "Paused";
  if (icon) icon.className = "rt-icon " + (power || running ? "on" : "");
  st.textContent = op;
  var prog = state("sensor.dishwasher_program_progress");
  if (pg) pg.textContent = (running && prog && prog !== "unknown") ? (prog + "%") : "";
  var ft = _dwFinish();
  if (fin) fin.textContent = (running && ft) ? ("~" + ft) : "";
}

// ── Panel ──
function openDishwasherPanel() {
  updateDishwasherPanel();
  var ov = document.getElementById("dishwasher-panel-overlay");
  if (ov) { ov.style.display = "flex"; document.body.style.overflow = "hidden"; }
  if (_dw.timer) clearInterval(_dw.timer);
  _dw.timer = setInterval(updateDishwasherPanel, 3000);
}
function closeDishwasherPanel() {
  var ov = document.getElementById("dishwasher-panel-overlay");
  if (ov) { ov.style.display = "none"; document.body.style.overflow = ""; }
  if (_dw.timer) { clearInterval(_dw.timer); _dw.timer = null; }
}

function _dwDrawRing(pct) {
  var c = document.getElementById("dw-ring-canvas");
  if (!c) return;
  var ctx = c.getContext("2d");
  var W = c.width, cx = W / 2, cy = W / 2;
  ctx.clearRect(0, 0, W, W);
  var frac = Math.max(0, Math.min(1, (pct || 0) / 100));
  // backing ring
  ctx.beginPath(); ctx.arc(cx, cy, 104, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 12; ctx.stroke();
  // progress arc (ember)
  var start = -Math.PI / 2;
  var grad = ctx.createLinearGradient(0, 0, W, W);
  grad.addColorStop(0, "rgba(255,205,110,0.95)");
  grad.addColorStop(1, "rgba(240,165,70,0.92)");
  ctx.beginPath();
  ctx.arc(cx, cy, 104, start, start + Math.PI * 2 * frac);
  ctx.strokeStyle = grad; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.stroke();
}

function updateDishwasherPanel() {
  var power = state("switch.dishwasher_power") === "on";
  var op = _dwOpState();
  var running = op === "Running" || op === "Delayed" || op === "Paused";
  var door = state("sensor.dishwasher_door");
  var doorTxt = (door && door !== "unknown") ? (door.charAt(0).toUpperCase() + door.slice(1)) : "--";
  _setT("dw-sub", op + " · Door " + doorTxt);

  var prog = parseFloat(state("sensor.dishwasher_program_progress"));
  _setT("dw-pct", running ? ((isNaN(prog) ? 0 : Math.round(prog)) + "%") : op);
  var ft = _dwFinish();
  _setT("dw-finish-c", (running && ft) ? ("Done ~" + ft) : "");
  _dwDrawRing(isNaN(prog) ? 0 : prog);

  // selected program highlight
  var sel = state("select.dishwasher_selected_program");
  var act = state("select.dishwasher_active_program");
  var current = (act && act !== "unknown" && act !== "unavailable") ? act : sel;
  document.querySelectorAll("#dw-programs .dw-prog").forEach(function(b) {
    b.classList.toggle("on", b.dataset.prog === current);
  });

  // options
  _clsT("dw-opt-halfload", "on", state("switch.dishwasher_half_load") === "on");
  _clsT("dw-opt-hygiene", "on", state("switch.dishwasher_hygiene") === "on");
  _clsT("dw-opt-zeolite", "on", state("switch.dishwasher_zeolite_dry") === "on");

  // power
  _clsT("dw-power", "on", power);

  // remote start gate
  var remoteArmed = state("binary_sensor.dishwasher_remote_start") === "on";
  var hint = document.getElementById("dw-remote-hint");
  var startBtn = document.getElementById("dw-start");
  if (hint) hint.style.display = remoteArmed ? "none" : "block";
  if (startBtn) startBtn.classList.toggle("disabled", !remoteArmed);

  // consumables
  var saltLow = state("sensor.dishwasher_salt_nearly_empty") === "on";
  var rinseLow = state("sensor.dishwasher_rinse_aid_nearly_empty") === "on";
  var saltEl = document.getElementById("dw-salt");
  var rinseEl = document.getElementById("dw-rinse");
  if (saltEl) { saltEl.textContent = saltLow ? "Salt LOW" : "Salt OK"; saltEl.classList.toggle("warn", saltLow); }
  if (rinseEl) { rinseEl.textContent = rinseLow ? "Rinse aid LOW" : "Rinse aid OK"; rinseEl.classList.toggle("warn", rinseLow); }
}

function setDishwasherProgram(prog) {
  _dwCall("select", "select_option", { entity_id: "select.dishwasher_selected_program", option: prog });
  setTimeout(updateDishwasherPanel, 500);
}
function setDishwasherDelay(seconds) {
  _dwCall("number", "set_value", { entity_id: "number.dishwasher_start_in_relative", value: seconds });
  setTimeout(updateDishwasherPanel, 500);
}
function toggleDishwasherSwitch(entId) {
  var isOn = state(entId) === "on";
  _dwCall("switch", isOn ? "turn_off" : "turn_on", { entity_id: entId });
  setTimeout(updateDishwasherPanel, 500);
}
function toggleDishwasherPower() {
  var isOn = state("switch.dishwasher_power") === "on";
  _dwCall("switch", isOn ? "turn_off" : "turn_on", { entity_id: "switch.dishwasher_power" });
  setTimeout(function(){ updateDishwasherPanel(); refreshDishwasherTile(); }, 500);
}
function startDishwasher() {
  // gated by remote-start; UI disables button when not armed
  if (state("binary_sensor.dishwasher_remote_start") !== "on") return;
  var sel = state("select.dishwasher_selected_program");
  if (sel && sel !== "unknown" && sel !== "unavailable") {
    _dwCall("select", "select_option", { entity_id: "select.dishwasher_active_program", option: sel });
  }
  setTimeout(updateDishwasherPanel, 600);
}
function stopDishwasher() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ id: ++msgId, type: "call_service", domain: "button", service: "press",
    target: { entity_id: "button.dishwasher_stop_program" } }));
  setTimeout(updateDishwasherPanel, 600);
}

// scoped DOM helpers (avoid clobbering existing names)
function _setT(id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt; }
function _clsT(id, c, on) { var e = document.getElementById(id); if (e) e.classList.toggle(c, !!on); }
