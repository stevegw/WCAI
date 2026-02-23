"""
Windchill Config-as-Code -- Local Web UI Wizard
=================================================
Run:  python run.py
Opens a browser-based wizard at http://localhost:8050

No dependencies beyond Python stdlib + pyyaml.
"""

import http.server
import json
import os
import socketserver
import sys
import threading
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs

# Add parent to path so wc_config is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wc_config.loader import load_config, save_config
from wc_config.validators import validate, Severity
from wc_config.generators import generate_all
from wc_config.model import ROLES, PREFERENCES, CHANGE_OBJECTS, ASSOCIATION_TYPES

PORT = 8050
CONFIG_FILE = "company_config.yaml"
OUTPUT_DIR = "generated"


def get_default_config():
    """Return a blank default config."""
    return {
        "company": {
            "name": "", "org": "", "site": "",
            "context_level": "organization",
            "lock_preferences": True,
            "use_flexible_change": True,
        },
        "groups": [],
        "people": [],
        "roles": {k: [] for k in ROLES},
        "preferences": {k: v.default for k, v in PREFERENCES.items()},
        "associations": {
            k: {"enabled": v["standard"], "cardinality": "many:1",
                "owning_role": "none", "required_role": "none"}
            for k, v in ASSOCIATION_TYPES.items()
        },
        "business_rules": {"rule_set_name": "", "rules": []},
        "custom_attributes": [],
    }


def get_model_metadata():
    """Return the Windchill model info for the UI to render."""
    return {
        "roles": {k: {
            "display_name": v.display_name,
            "description": v.description,
            "used_by": list(v.used_by),
        } for k, v in ROLES.items()},
        "preferences": {k: {
            "display_name": v.display_name,
            "description": v.description,
            "default": v.default,
        } for k, v in PREFERENCES.items()},
        "associations": {k: {
            "role_a": v["role_a"],
            "role_b": v["role_b"],
            "description": v["description"],
            "standard": v["standard"],
        } for k, v in ASSOCIATION_TYPES.items()},
        "change_objects": {k: {
            "name": v.name,
            "java_type": v.java_type,
            "default_lifecycle": v.default_lifecycle,
            "default_workflow": v.default_workflow,
            "default_team_template": v.default_team_template,
            "roles": list(v.roles),
        } for k, v in CHANGE_OBJECTS.items()},
    }


def validate_config(config):
    """Validate and return issues as dicts."""
    # Ensure _people_index exists
    config["_people_index"] = {p["id"]: p for p in config.get("people", [])}
    issues = validate(config)
    return [{
        "severity": i.severity.value,
        "section": i.section,
        "message": i.message,
        "fix_hint": i.fix_hint,
    } for i in issues]


# ============================================================
# HTML UI (single page app embedded as string)
# ============================================================

HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Windchill Config-as-Code Wizard</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }

/* Layout */
.app { display: flex; min-height: 100vh; }
.sidebar { width: 260px; background: #1e293b; border-right: 1px solid #334155; padding: 20px 0; position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto; }
.main { flex: 1; margin-left: 260px; padding: 32px 40px; max-width: 900px; }

/* Sidebar */
.sb-logo { padding: 0 20px 20px; border-bottom: 1px solid #334155; margin-bottom: 16px; }
.sb-logo h2 { font-size: 15px; font-weight: 700; color: #f1f5f9; }
.sb-logo p { font-size: 11px; color: #64748b; margin-top: 2px; }
.sb-nav { list-style: none; }
.sb-nav li { padding: 10px 20px; font-size: 13px; cursor: pointer; border-left: 3px solid transparent; color: #94a3b8; transition: all 0.15s; display: flex; align-items: center; gap: 10px; }
.sb-nav li:hover { background: #1a2744; color: #e2e8f0; }
.sb-nav li.active { background: rgba(34, 197, 94, 0.06); color: #22c55e; border-left-color: #22c55e; font-weight: 600; }
.sb-nav li .num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #334155; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.sb-nav li.active .num { background: #22c55e; color: #0f172a; }
.sb-nav li.done .num { background: #166534; color: #22c55e; }
.sb-status { padding: 16px 20px; margin-top: 12px; border-top: 1px solid #334155; }
.sb-status p { font-size: 11px; color: #64748b; }
.sb-status .bar { height: 4px; background: #334155; border-radius: 2px; margin-top: 6px; overflow: hidden; }
.sb-status .fill { height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); border-radius: 2px; transition: width 0.3s; }

/* Section */
.section { display: none; animation: fadeIn 0.2s ease; }
.section.active { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.sec-title { font-size: 20px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
.sec-desc { font-size: 13px; color: #64748b; margin-bottom: 24px; line-height: 1.7; }

/* Form elements */
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
.field input, .field select { width: 100%; padding: 10px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; font-size: 13px; font-family: inherit; outline: none; transition: border-color 0.15s; }
.field input:focus, .field select:focus { border-color: #22c55e; }
.field input::placeholder { color: #475569; }
.row { display: flex; gap: 12px; }
.row > .field { flex: 1; }

/* Cards */
.card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 10px; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-head span { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
.card .remove-btn { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
.card .remove-btn:hover { background: rgba(239, 68, 68, 0.2); }

/* Buttons */
.add-btn { width: 100%; padding: 12px; background: transparent; border: 2px dashed #334155; border-radius: 8px; color: #22c55e; font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 600; transition: all 0.15s; }
.add-btn:hover { border-color: #22c55e; background: rgba(34, 197, 94, 0.04); }
.btn { padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; transition: all 0.15s; }
.btn-primary { background: #22c55e; color: #0f172a; }
.btn-primary:hover { background: #16a34a; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-secondary { background: #334155; color: #e2e8f0; }
.btn-secondary:hover { background: #475569; }
.nav-btns { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 20px; border-top: 1px solid #334155; }

/* Toggle */
.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; margin-bottom: 8px; }
.toggle-info { flex: 1; }
.toggle-info .name { font-size: 13px; font-weight: 600; color: #e2e8f0; }
.toggle-info .desc { font-size: 11px; color: #64748b; margin-top: 2px; }
.toggle-ctrl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.toggle-val { font-size: 11px; font-weight: 700; }
.toggle-val.on { color: #22c55e; }
.toggle-val.off { color: #64748b; }
.switch { width: 40px; height: 22px; border-radius: 11px; background: #334155; cursor: pointer; position: relative; transition: background 0.2s; border: none; padding: 0; }
.switch.on { background: #22c55e; }
.switch .dot { width: 16px; height: 16px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: left 0.2s; }
.switch.on .dot { left: 21px; }

/* Role mapping */
.role-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 10px; }
.role-name { font-size: 14px; font-weight: 700; color: #f1f5f9; }
.role-desc { font-size: 11px; color: #64748b; margin: 2px 0 4px; }
.role-used { font-size: 10px; color: #475569; margin-bottom: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #334155; background: transparent; color: #94a3b8; font-family: inherit; transition: all 0.1s; }
.chip.selected { background: rgba(34, 197, 94, 0.1); border-color: #22c55e; color: #22c55e; }
.chip:hover { border-color: #22c55e; }
.no-people { font-size: 12px; color: #475569; font-style: italic; }

/* Validation */
.issue { padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; }
.issue.ERROR { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: #fca5a5; }
.issue.WARNING { background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); color: #fcd34d; }
.issue.INFO { background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); color: #93c5fd; }
.issue .hint { font-size: 11px; color: #64748b; margin-top: 3px; }

/* Generate results */
.file-list { margin-top: 16px; }
.file-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; margin-bottom: 6px; }
.file-name { font-size: 13px; font-weight: 600; color: #22c55e; font-family: 'Consolas', 'Courier New', monospace; }
.file-size { font-size: 11px; color: #64748b; }
.success-box { padding: 16px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 8px; margin-top: 16px; }
.success-box h3 { color: #22c55e; font-size: 14px; margin-bottom: 6px; }
.success-box p { font-size: 12px; color: #94a3b8; }
.success-box code { background: #0f172a; padding: 2px 6px; border-radius: 3px; font-size: 11px; color: #22c55e; }

/* Assoc */
.assoc-arrow { color: #22c55e; font-weight: 700; margin: 0 6px; }
</style>
</head>
<body>
<div class="app">
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sb-logo">
      <h2>WC Config-as-Code</h2>
      <p>Define once, deploy everywhere</p>
    </div>
    <ul class="sb-nav" id="nav"></ul>
    <div class="sb-status">
      <p>Progress</p>
      <div class="bar"><div class="fill" id="progress-fill"></div></div>
    </div>
  </div>

  <!-- Main -->
  <div class="main" id="main"></div>
</div>

<script>
// ============================================================
// State
// ============================================================
let config = null;
let model = null;
let currentStep = 0;

const STEPS = [
  { id: "company", label: "Company & Org" },
  { id: "groups", label: "Groups" },
  { id: "people", label: "People" },
  { id: "roles", label: "Role Mapping" },
  { id: "prefs", label: "Preferences" },
  { id: "assoc", label: "Associations" },
  { id: "validate", label: "Validate" },
  { id: "generate", label: "Generate" },
];

// ============================================================
// API calls
// ============================================================
async function api(endpoint, data = null) {
  const opts = data !== null
    ? { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data) }
    : { method: "GET" };
  const res = await fetch("/api/" + endpoint, opts);
  return res.json();
}

// ============================================================
// Init
// ============================================================
async function init() {
  const data = await api("init");
  config = data.config;
  model = data.model;
  renderNav();
  goToStep(0);
}

// ============================================================
// Navigation
// ============================================================
function renderNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = STEPS.map((s, i) => `
    <li id="nav-${i}" onclick="goToStep(${i})" class="${i === currentStep ? 'active' : ''}">
      <span class="num">${i + 1}</span> ${s.label}
    </li>
  `).join("");

  const pct = Math.round((currentStep / (STEPS.length - 1)) * 100);
  document.getElementById("progress-fill").style.width = pct + "%";
}

function goToStep(i) {
  currentStep = i;
  renderNav();
  const renderers = [renderCompany, renderGroups, renderPeople, renderRoles, renderPrefs, renderAssoc, renderValidate, renderGenerate];
  renderers[i]();
}

function navButtons(backEnabled = true) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;
  return `<div class="nav-btns">
    <button class="btn btn-secondary" onclick="goToStep(${currentStep - 1})" ${isFirst || !backEnabled ? 'disabled' : ''}>Back</button>
    ${!isLast ? `<button class="btn btn-primary" onclick="saveAndNext()">Save & Continue</button>` : ''}
  </div>`;
}

async function saveAndNext() {
  await api("save", config);
  goToStep(currentStep + 1);
}

// ============================================================
// Step 1: Company
// ============================================================
function renderCompany() {
  const c = config.company;
  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Company & Organization</h1>
    <p class="sec-desc">Define your Windchill site and organization context. These values determine where configuration artifacts are deployed in the Windchill context hierarchy.</p>
    <div class="row">
      <div class="field"><label>Company Name *</label>
        <input id="c-name" value="${esc(c.name)}" placeholder="e.g. Acme Engineering" oninput="config.company.name=this.value"></div>
      <div class="field"><label>Windchill Organization *</label>
        <input id="c-org" value="${esc(c.org)}" placeholder="e.g. AcmeOrg" oninput="config.company.org=this.value"></div>
    </div>
    <div class="row">
      <div class="field"><label>Windchill Site</label>
        <input id="c-site" value="${esc(c.site)}" placeholder="e.g. acme-wc-prod" oninput="config.company.site=this.value"></div>
      <div class="field"><label>Context Level</label>
        <select onchange="config.company.context_level=this.value">
          <option value="organization" ${c.context_level==='organization'?'selected':''}>Organization</option>
          <option value="site" ${c.context_level==='site'?'selected':''}>Site</option>
        </select></div>
    </div>
    <div style="margin-top:12px">
      ${toggleRow('Lock preferences at context level', 'Prevent lower contexts from overriding', c.lock_preferences, "config.company.lock_preferences=!config.company.lock_preferences; renderCompany();")}
      ${toggleRow('Use flexible change items', 'Windchill 11.2+ flexible change objects', c.use_flexible_change, "config.company.use_flexible_change=!config.company.use_flexible_change; renderCompany();")}
    </div>
    ${navButtons(false)}
  `;
}

// ============================================================
// Step 2: Groups
// ============================================================
function renderGroups() {
  const groups = config.groups || [];
  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Groups & Departments</h1>
    <p class="sec-desc">Define organizational groups. People will be assigned to these groups for organization.</p>
    <div id="groups-list">
      ${groups.map((g, i) => `
        <div class="card">
          <div class="card-head"><span>Group ${i+1}</span><button class="remove-btn" onclick="config.groups.splice(${i},1); renderGroups();">Remove</button></div>
          <div class="row">
            <div class="field"><label>Group ID</label><input value="${esc(g.id)}" placeholder="eng" oninput="config.groups[${i}].id=this.value"></div>
            <div class="field"><label>Name</label><input value="${esc(g.name)}" placeholder="Engineering" oninput="config.groups[${i}].name=this.value"></div>
            <div class="field"><label>Description</label><input value="${esc(g.description||'')}" placeholder="Product engineering team" oninput="config.groups[${i}].description=this.value"></div>
          </div>
        </div>
      `).join("")}
    </div>
    <button class="add-btn" onclick="config.groups.push({id:'',name:'',description:''}); renderGroups();">+ Add Group</button>
    ${navButtons()}
  `;
}

// ============================================================
// Step 3: People
// ============================================================
function renderPeople() {
  const people = config.people || [];
  const groups = config.groups || [];
  const groupOpts = groups.map(g => `<option value="${esc(g.id)}">${esc(g.name || g.id)}</option>`).join("");

  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">People</h1>
    <p class="sec-desc">Add team members who will participate in the change process. Usernames must match their Windchill login.</p>
    <div id="people-list">
      ${people.map((p, i) => `
        <div class="card">
          <div class="card-head"><span>Person ${i+1}</span><button class="remove-btn" onclick="removePerson(${i})">Remove</button></div>
          <div class="row">
            <div class="field"><label>Full Name</label><input value="${esc(p.name)}" placeholder="Jane Smith" oninput="config.people[${i}].name=this.value"></div>
            <div class="field"><label>Username *</label><input value="${esc(p.username)}" placeholder="jsmith" oninput="updatePersonId(${i}, this.value)"></div>
            <div class="field"><label>Email</label><input value="${esc(p.email||'')}" placeholder="jsmith@company.com" oninput="config.people[${i}].email=this.value"></div>
          </div>
          <div class="row">
            <div class="field"><label>Group</label>
              <select onchange="config.people[${i}].group=this.value">
                <option value="">-- None --</option>
                ${groups.map(g => `<option value="${esc(g.id)}" ${p.group===g.id?'selected':''}>${esc(g.name || g.id)}</option>`).join("")}
              </select></div>
            <div class="field"></div>
            <div class="field"></div>
          </div>
        </div>
      `).join("")}
    </div>
    <button class="add-btn" onclick="config.people.push({id:'',name:'',username:'',email:'',group:''}); renderPeople();">+ Add Person</button>
    ${navButtons()}
  `;
}

function updatePersonId(i, val) {
  config.people[i].username = val;
  config.people[i].id = val;
}

function removePerson(i) {
  const pid = config.people[i].id;
  config.people.splice(i, 1);
  // Clean up role assignments
  for (const role in config.roles) {
    config.roles[role] = (config.roles[role] || []).filter(id => id !== pid);
  }
  renderPeople();
}

// ============================================================
// Step 4: Role Mapping
// ============================================================
function renderRoles() {
  const people = config.people || [];
  const roles = config.roles || {};

  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Role Mapping</h1>
    <p class="sec-desc">Map your team members to Windchill change management roles. Click a person to toggle their assignment. Each role controls who receives workflow tasks.</p>
    ${Object.entries(model.roles).map(([rid, r]) => {
      const assigned = roles[rid] || [];
      return `<div class="role-card">
        <div class="role-name">${esc(r.display_name)}</div>
        <div class="role-desc">${esc(r.description)}</div>
        <div class="role-used">Used by: ${r.used_by.join(' / ')}</div>
        <div class="chips">
          ${people.length === 0
            ? '<span class="no-people">Add people in the previous step first</span>'
            : people.map(p => {
                const sel = assigned.includes(p.id);
                return `<button class="chip ${sel?'selected':''}" onclick="toggleRole('${rid}','${esc(p.id)}')">
                  ${sel ? '&#10003; ' : ''}${esc(p.name || p.username || '?')}
                </button>`;
              }).join("")
          }
        </div>
      </div>`;
    }).join("")}
    ${navButtons()}
  `;
}

function toggleRole(roleId, personId) {
  if (!config.roles[roleId]) config.roles[roleId] = [];
  const arr = config.roles[roleId];
  const idx = arr.indexOf(personId);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(personId);
  renderRoles();
}

// ============================================================
// Step 5: Preferences
// ============================================================
function renderPrefs() {
  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Change Management Preferences</h1>
    <p class="sec-desc">Configure preferences that control your change process behavior. These map directly to Windchill Preference Management settings.</p>
    ${Object.entries(model.preferences).map(([pk, p]) => {
      const val = config.preferences[pk] || p.default;
      const isYes = val === "Yes";
      return toggleRow(p.display_name, p.description, isYes,
        `config.preferences['${pk}'] = config.preferences['${pk}']==='Yes' ? 'No' : 'Yes'; renderPrefs();`);
    }).join("")}
    ${navButtons()}
  `;
}

// ============================================================
// Step 6: Associations
// ============================================================
function renderAssoc() {
  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Change Association Rules</h1>
    <p class="sec-desc">Define which change objects can be linked together. PTC recommends disabling the OOB rules and defining only what your process requires.</p>
    ${Object.entries(model.associations).map(([ak, a]) => {
      const ua = config.associations[ak] || {};
      const enabled = ua.enabled !== false;
      const tag = a.standard ? '' : ' <span style="color:#f59e0b;font-size:10px;font-weight:700">NON-STANDARD</span>';
      return `<div class="toggle-row">
        <div class="toggle-info">
          <div class="name">${esc(a.role_a)} <span class="assoc-arrow">-></span> ${esc(a.role_b)}${tag}</div>
          <div class="desc">${esc(a.description)}</div>
        </div>
        <div class="toggle-ctrl">
          <span class="toggle-val ${enabled?'on':'off'}">${enabled?'Enabled':'Disabled'}</span>
          <button class="switch ${enabled?'on':''}" onclick="config.associations['${ak}'].enabled=!config.associations['${ak}'].enabled; renderAssoc();">
            <span class="dot"></span>
          </button>
        </div>
      </div>`;
    }).join("")}
    ${navButtons()}
  `;
}

// ============================================================
// Step 7: Validate
// ============================================================
async function renderValidate() {
  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Validate Configuration</h1>
    <p class="sec-desc">Checking your configuration for errors and warnings...</p>
    <p style="color:#64748b">Running validation...</p>
  `;

  const result = await api("validate", config);
  const issues = result.issues || [];
  const errors = issues.filter(i => i.severity === "ERROR");
  const warnings = issues.filter(i => i.severity === "WARNING");
  const infos = issues.filter(i => i.severity === "INFO");

  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Validate Configuration</h1>
    <p class="sec-desc">${errors.length} errors, ${warnings.length} warnings, ${infos.length} info</p>
    ${issues.length === 0
      ? '<div class="success-box"><h3>All clear!</h3><p>No issues found. Ready to generate.</p></div>'
      : issues.map(i => `<div class="issue ${i.severity}">
          <strong>[${i.section}]</strong> ${esc(i.message)}
          ${i.fix_hint ? `<div class="hint">Fix: ${esc(i.fix_hint)}</div>` : ''}
        </div>`).join("")
    }
    ${navButtons()}
  `;
}

// ============================================================
// Step 8: Generate
// ============================================================
async function renderGenerate() {
  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Generate Deployment Artifacts</h1>
    <p class="sec-desc">Save your YAML config and generate all Windchill deployment files.</p>
    <div style="text-align:center; padding: 40px 0;">
      <button class="btn btn-primary" onclick="doGenerate()" style="padding:14px 32px;font-size:15px;">
        Save Config & Generate All Files
      </button>
    </div>
    ${navButtons()}
  `;
}

async function doGenerate() {
  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Generating...</h1>
    <p class="sec-desc">Saving config and generating deployment artifacts...</p>
  `;

  const result = await api("generate", config);
  if (result.error) {
    document.getElementById("main").innerHTML = `
      <h1 class="sec-title">Generation Failed</h1>
      <div class="issue ERROR">${esc(result.error)}</div>
      ${navButtons()}
    `;
    return;
  }

  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Generation Complete!</h1>
    <p class="sec-desc">All artifacts generated for ${esc(config.company.name)}.</p>
    <div class="success-box">
      <h3>Config saved to: ${esc(result.config_file)}</h3>
      <p>Artifacts written to: <code>${esc(result.output_dir)}</code></p>
    </div>
    <div class="file-list">
      ${(result.files || []).map(f => `
        <div class="file-item">
          <span class="file-name">${esc(f.name)}</span>
          <span class="file-size">${f.size.toLocaleString()} bytes</span>
        </div>
      `).join("")}
    </div>
    <div class="success-box" style="margin-top:16px;">
      <h3>Next Steps</h3>
      <p>1. Review generated files in <code>${esc(result.output_dir)}</code></p>
      <p>2. On your Windchill server:</p>
      <p><code>cd ${esc(result.output_dir)}</code></p>
      <p><code>source $WT_HOME/bin/adminTools/windchillenv.sh</code></p>
      <p><code>bash deploy_all.sh --dry-run</code></p>
    </div>
    ${navButtons()}
  `;
}

// ============================================================
// Helpers
// ============================================================
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function toggleRow(name, desc, isOn, onclick) {
  return `<div class="toggle-row">
    <div class="toggle-info">
      <div class="name">${name}</div>
      <div class="desc">${desc}</div>
    </div>
    <div class="toggle-ctrl">
      <span class="toggle-val ${isOn?'on':'off'}">${isOn?'Yes':'No'}</span>
      <button class="switch ${isOn?'on':''}" onclick="${onclick}">
        <span class="dot"></span>
      </button>
    </div>
  </div>`;
}

// ============================================================
// Boot
// ============================================================
init();
</script>
</body>
</html>
"""


# ============================================================
# HTTP Server
# ============================================================

class WizardHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet logging
        pass

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))

        elif self.path == "/api/init":
            # Load existing config or create default
            config = get_default_config()
            config_path = Path(CONFIG_FILE)
            if config_path.exists():
                try:
                    config = load_config(config_path)
                    # Remove internal keys for JSON
                    config.pop("_people_index", None)
                    print(f"  Loaded existing config: {CONFIG_FILE}")
                except Exception as e:
                    print(f"  Warning: Could not load {CONFIG_FILE}: {e}")

            self.send_json({"config": config, "model": get_model_metadata()})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        data = json.loads(body) if body else {}

        if self.path == "/api/save":
            try:
                data["_people_index"] = {p["id"]: p for p in data.get("people", [])}
                save_config(data, CONFIG_FILE)
                self.send_json({"ok": True})
            except Exception as e:
                self.send_json({"error": str(e)})

        elif self.path == "/api/validate":
            try:
                issues = validate_config(data)
                self.send_json({"issues": issues})
            except Exception as e:
                self.send_json({"issues": [{"severity": "ERROR", "section": "system", "message": str(e)}]})

        elif self.path == "/api/generate":
            try:
                data["_people_index"] = {p["id"]: p for p in data.get("people", [])}
                save_config(data, CONFIG_FILE)
                files = generate_all(data, OUTPUT_DIR)
                file_info = [{"name": f.name, "size": f.stat().st_size} for f in files]
                self.send_json({
                    "ok": True,
                    "config_file": str(Path(CONFIG_FILE).resolve()),
                    "output_dir": str(Path(OUTPUT_DIR).resolve()),
                    "files": file_info,
                })
            except Exception as e:
                self.send_json({"error": str(e)})
        else:
            self.send_response(404)
            self.end_headers()

    def send_json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))


def main():
    print("")
    print("  ============================================")
    print("  Windchill Config-as-Code -- Web Wizard")
    print("  ============================================")
    print(f"  Starting on http://localhost:{PORT}")
    print(f"  Config file: {Path(CONFIG_FILE).resolve()}")
    print(f"  Output dir:  {Path(OUTPUT_DIR).resolve()}")
    print("  Press Ctrl+C to stop")
    print("")

    # Open browser after a short delay
    threading.Timer(1.0, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()

    with socketserver.TCPServer(("", PORT), WizardHandler) as httpd:
        httpd.allow_reuse_address = True
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Stopped.")


if __name__ == "__main__":
    main()
