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

/* Best Practice Expander */
.bp-expander { margin-bottom: 10px; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
.bp-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(59, 130, 246, 0.06); cursor: pointer; transition: background 0.15s; }
.bp-header:hover { background: rgba(59, 130, 246, 0.1); }
.bp-icon { width: 24px; height: 24px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.bp-header-text { font-size: 13px; font-weight: 600; color: #93c5fd; flex: 1; }
.bp-arrow { color: #60a5fa; font-size: 12px; transition: transform 0.2s; }
.bp-expander.open .bp-arrow { transform: rotate(90deg); }
.bp-body { display: none; padding: 0 16px 16px; }
.bp-expander.open .bp-body { display: block; }
.bp-body p { font-size: 12.5px; color: #cbd5e1; line-height: 1.7; margin-bottom: 10px; }
.bp-body p:last-child { margin-bottom: 0; }
.bp-quote { border-left: 3px solid #3b82f6; padding: 8px 14px; background: rgba(59, 130, 246, 0.04); border-radius: 0 6px 6px 0; margin: 10px 0; }
.bp-quote p { font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 4px; }
.bp-quote .bp-source { font-size: 10px; color: #64748b; font-style: normal; font-weight: 600; }
.bp-tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.bp-tag.preferred { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
.bp-tag.alternative { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.bp-tag.warning { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.bp-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.bp-option { padding: 12px; border-radius: 6px; border: 1px solid #334155; }
.bp-option.recommended { border-color: rgba(34, 197, 94, 0.3); background: rgba(34, 197, 94, 0.04); }
.bp-option.alternative { border-color: rgba(245, 158, 11, 0.2); background: rgba(245, 158, 11, 0.03); }
.bp-option h4 { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
.bp-option.recommended h4 { color: #22c55e; }
.bp-option.alternative h4 { color: #f59e0b; }
.bp-option ul { list-style: none; padding: 0; }
.bp-option li { font-size: 11.5px; color: #94a3b8; padding: 2px 0; padding-left: 12px; position: relative; }
.bp-option li::before { content: ''; position: absolute; left: 0; top: 8px; width: 4px; height: 4px; border-radius: 50%; }
.bp-option.recommended li::before { background: #22c55e; }
.bp-option.alternative li::before { background: #f59e0b; }

/* Advanced collapsible section */
.cl-advanced { margin-top: 8px; margin-bottom: 20px; border: 1px dashed #334155; border-radius: 8px; overflow: hidden; }
.cl-advanced-header { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #f59e0b; }
.cl-advanced-header:hover { background: rgba(245, 158, 11, 0.04); }
.cl-advanced-body { display: none; padding: 0 16px 12px; }
.cl-advanced.open .cl-advanced-body { display: block; }
.cl-advanced .bp-arrow { color: #f59e0b; }
.cl-advanced.open .bp-arrow { transform: rotate(90deg); }

/* Checklist */
.cl-section { margin-bottom: 24px; }
.cl-section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.cl-section-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.cl-section-num.auto { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.cl-section-num.manual { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.cl-section-title { font-size: 15px; font-weight: 700; color: #f1f5f9; }
.cl-section-subtitle { font-size: 12px; color: #64748b; }
.cl-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-left: 8px; }
.cl-badge.done { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.cl-badge.todo { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.cl-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; margin-bottom: 6px; cursor: pointer; transition: all 0.15s; }
.cl-item:hover { border-color: #475569; }
.cl-item.checked { opacity: 0.6; }
.cl-item.checked .cl-box { background: #22c55e; border-color: #22c55e; }
.cl-box { width: 20px; height: 20px; border-radius: 4px; border: 2px solid #475569; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #0f172a; font-weight: 700; margin-top: 1px; transition: all 0.15s; }
.cl-content { flex: 1; }
.cl-task { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 2px; }
.cl-detail { font-size: 11.5px; color: #94a3b8; line-height: 1.6; }
.cl-nav { display: inline-block; background: #0f172a; padding: 3px 8px; border-radius: 3px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; color: #22c55e; margin-top: 4px; }
.cl-people { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
.cl-person { padding: 2px 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 3px; font-size: 10px; color: #93c5fd; }
.cl-divider { height: 1px; background: #334155; margin: 20px 0; }
.cl-progress { display: flex; align-items: center; gap: 12px; padding: 16px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-bottom: 24px; }
.cl-progress-bar { flex: 1; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; }
.cl-progress-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); border-radius: 4px; transition: width 0.3s; }
.cl-progress-text { font-size: 13px; font-weight: 700; color: #22c55e; min-width: 45px; text-align: right; }
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
  { id: "checklist", label: "Deploy Checklist" },
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
  const renderers = [renderCompany, renderGroups, renderPeople, renderRoles, renderPrefs, renderAssoc, renderValidate, renderGenerate, renderChecklist];
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
  config.people.splice(i, 1);
  renderPeople();
}

// ============================================================
// Step 4: Role Mapping (Groups -> Roles)
// ============================================================
function renderRoles() {
  const groups = config.groups || [];
  const roles = config.roles || {};

  document.getElementById("main").innerHTML = `
    <h1 class="sec-title">Role Mapping (Groups to Roles)</h1>
    <p class="sec-desc">Map your Windchill groups to change management roles. In Windchill, the best practice is: <strong>Users -> Groups -> Roles</strong>. You add users to groups (or sync from LDAP/AD), then assign groups to roles in team templates or context teams. Click a group to toggle its assignment to each role.</p>
    ${Object.entries(model.roles).map(([rid, r]) => {
      const assigned = roles[rid] || [];
      return `<div class="role-card">
        <div class="role-name">${esc(r.display_name)}</div>
        <div class="role-desc">${esc(r.description)}</div>
        <div class="role-used">Used by: ${r.used_by.join(' / ')}</div>
        <div class="chips">
          ${groups.length === 0
            ? '<span class="no-people">Add groups in Step 2 first</span>'
            : groups.map(g => {
                const sel = assigned.includes(g.id);
                return `<button class="chip ${sel?'selected':''}" onclick="toggleRole('${rid}','${esc(g.id)}')">
                  ${sel ? '&#10003; ' : ''}${esc(g.name || g.id)}
                </button>`;
              }).join("")
          }
        </div>
        ${assigned.length > 0 ? `<div style="margin-top:8px;font-size:11px;color:#64748b;">Members: ${
          assigned.map(gid => {
            const members = (config.people || []).filter(p => p.group === gid).map(p => p.name || p.username);
            return members.length > 0 ? '<strong>' + esc(groups.find(g=>g.id===gid)?.name || gid) + '</strong>: ' + members.map(m => esc(m)).join(', ') : '';
          }).filter(Boolean).join(' | ')
        }</div>` : ''}
      </div>`;
    }).join("")}
    ${navButtons()}
  `;
}

function toggleRole(roleId, groupId) {
  if (!config.roles[roleId]) config.roles[roleId] = [];
  const arr = config.roles[roleId];
  const idx = arr.indexOf(groupId);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(groupId);
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
      <p>1. Copy the <code>generated</code> folder to your Windchill server</p>
      <p>2. Open your Windchill shell on the server</p>
      <p>3. <code>cd [path-to-generated-folder]</code></p>
      <p>4. <code>deploy_all.bat --dry-run</code> (preview)</p>
      <p>5. <code>deploy_all.bat</code> (deploy for real)</p>
      <p style="margin-top:10px">6. Then continue to the <strong>Deploy Checklist</strong> for manual steps:</p>
    </div>
    <div style="text-align:center; margin-top:16px;">
      <button class="btn btn-primary" onclick="goToStep(${STEPS.length - 1})" style="padding:12px 28px;">
        Open Post-Deploy Checklist ->
      </button>
    </div>
    ${navButtons()}
  `;
}

// ============================================================
// Step 9: Post-Deployment Checklist
// ============================================================
let checklistState = {};

function renderChecklist() {
  try {
  const org = esc(config.company.org || 'YourOrg');
  const name = esc(config.company.name || 'Your Company');
  const people = config.people || [];
  const roles = config.roles || {};

  function roleGroups(roleId) {
    const gids = roles[roleId] || [];
    return gids.map(gid => {
      const g = (config.groups || []).find(gg => gg.id === gid);
      return g ? (g.name || g.id) : gid;
    });
  }

  function roleMembers(roleId) {
    const gids = roles[roleId] || [];
    const members = [];
    gids.forEach(gid => {
      people.filter(p => p.group === gid).forEach(p => {
        members.push(p.name || p.username);
      });
    });
    return [...new Set(members)];
  }

  function clItem(id, task, detail, nav, ppl, autoCheck) {
    var checked = checklistState[id] || autoCheck;
    var h = '<div class="cl-item' + (checked ? ' checked' : '') + '" onclick="toggleCheck(\'' + id + '\')">';
    h += '<div class="cl-box">' + (checked ? 'X' : '') + '</div>';
    h += '<div class="cl-content">';
    h += '<div class="cl-task">' + task + '</div>';
    h += '<div class="cl-detail">' + detail + '</div>';
    h += '<div class="cl-nav">' + nav + '</div>';
    if (ppl && ppl.length > 0) {
      h += '<div class="cl-people">';
      var unique = [];
      ppl.forEach(function(p) { if (unique.indexOf(p) < 0) unique.push(p); });
      unique.forEach(function(p) { h += '<span class="cl-person">' + esc(p) + '</span>'; });
      h += '</div>';
    }
    h += '</div></div>';
    return h;
  }

  function bp(title, body) {
    return '<div class="bp-expander">' +
      '<div class="bp-header">' +
        '<div class="bp-icon">?</div>' +
        '<div class="bp-header-text">' + title + '</div>' +
        '<span class="bp-arrow">&#9654;</span>' +
      '</div>' +
      '<div class="bp-body">' + body + '</div>' +
    '</div>';
  }

  function sectionHead(num, title, subtitle, type) {
    var badge = type === 'auto' ? '<span class="cl-badge done">Automated</span>' : '<span class="cl-badge todo">Manual</span>';
    return '<div class="cl-section"><div class="cl-section-head">' +
      '<div class="cl-section-num ' + type + '">' + num + '</div>' +
      '<div><div class="cl-section-title">' + title + ' ' + badge + '</div>' +
      '<div class="cl-section-subtitle">' + subtitle + '</div></div></div>';
  }

  // Count items for progress
  var allIds = [];

  // Build HTML
  var html = '<h1 class="sec-title">Post-Deployment Checklist</h1>' +
    '<p class="sec-desc">Work through each step in order. Click items to mark them complete. Blue panels contain best-practice guidance from PTC training material.</p>';

  // === STEP 1: Verify Org ===
  var s1 = '';
  s1 += sectionHead(1, 'Verify Organization Exists', 'PREREQUISITE: Must exist before anything else', 'manual');
  s1 += bp('Why does the organization matter?',
    '<p>In Windchill, everything is scoped to a context hierarchy: <strong>Site &rarr; Organization &rarr; Product/Library</strong>. Change management configuration is set at the Organization level and inherited downward.</p>' +
    '<p>If your organization does not exist yet, none of the subsequent steps will work.</p>'
  );
  s1 += clItem('org_exists', 'Verify organization \'' + org + '\' exists', 'Navigate to Site level and confirm your org is listed. If missing, create it now.', 'Site &rarr; Utilities &rarr; Organization Administration');
  allIds.push('org_exists');
  s1 += '</div>';
  html += s1;

  // === STEP 2: Verify Users ===
  var s2 = '';
  s2 += sectionHead(2, 'Verify User Accounts Exist', 'Users must exist before they can join groups or teams', 'manual');
  s2 += bp('Where do Windchill users come from?',
    '<p><strong>LDAP/Active Directory sync</strong> &mdash; Most common in enterprise environments. Users are managed in AD and synced automatically.</p>' +
    '<p><strong>Manual creation</strong> &mdash; For smaller or dev/test environments via Participant Administration.</p>'
  );
  people.forEach(function(p, i) {
    var id = 'user_' + i;
    s2 += clItem(id, 'Verify user: ' + esc(p.name || p.username) + ' (' + esc(p.username) + ')', 'Search in Participant Administration.', 'Site &rarr; Utilities &rarr; Participant Administration &rarr; Search \'' + esc(p.username) + '\'');
    allIds.push(id);
  });
  s2 += '</div>';
  html += s2;

  // === STEP 3: Create Groups ===
  var s3 = '';
  s3 += sectionHead(3, 'Create Groups and Add Users', 'Create Windchill groups, add users. Groups are assigned to roles.', 'manual');
  s3 += bp('Best Practice: Why groups instead of individual users?',
    '<p>The Windchill best practice pattern is:</p>' +
    '<p style="text-align:center;font-size:14px;font-weight:700;color:#22c55e;padding:8px 0;">Users &rarr; Groups &rarr; Roles</p>' +
    '<p><strong>Maintainability:</strong> When someone joins or leaves, update group membership in one place. Every context team referencing that group reflects the change automatically.</p>' +
    '<p><strong>LDAP alignment:</strong> If Windchill groups map to AD groups, membership stays in sync with no manual administration.</p>' +
    '<p><strong>Auditability:</strong> Much easier to audit access when permissions flow through named groups.</p>'
  );
  (config.groups || []).forEach(function(g, i) {
    var id = 'grp_create_' + i;
    s3 += clItem(id, 'Create group: \'' + esc(g.name || g.id) + '\'', 'Create this internal group in your organization.', org + ' &rarr; Utilities &rarr; Participant Administration &rarr; Internal Groups &rarr; Create');
    allIds.push(id);
    var members = people.filter(function(p) { return p.group === g.id; });
    if (members.length > 0) {
      var mid = 'grp_members_' + i;
      s3 += clItem(mid, 'Add users to \'' + esc(g.name || g.id) + '\'', 'Add: ' + members.map(function(p) { return esc(p.name || p.username); }).join(', '), org + ' &rarr; Utilities &rarr; Participant Administration &rarr; Internal Groups &rarr; \'' + esc(g.name || g.id) + '\' &rarr; Add Members', members.map(function(p) { return p.name || p.username; }));
      allIds.push(mid);
    }
  });
  var unassigned = people.filter(function(p) { return !p.group; });
  if (unassigned.length > 0) {
    s3 += clItem('grp_unassigned', 'WARNING: Users without group assignment', unassigned.map(function(p) { return esc(p.name || p.username); }).join(', '), 'Update config or assign in Windchill UI');
    allIds.push('grp_unassigned');
  }
  s3 += '</div>';
  html += s3;

  // === STEP 4: Add Groups to OOTB Team Template Roles ===
  var s4 = '';
  s4 += sectionHead(4, 'Add Groups to OOTB Team Template Roles', 'Populate the existing Site-level team templates with your groups', 'manual');
  s4 += bp('Understanding Team Templates',
    '<p>Windchill ships with <strong>4 out-of-the-box team templates</strong> at the Site level. They are already bound to change objects through OIRs and already contain the correct role definitions:</p>' +
    '<p style="font-size:12px;color:#94a3b8;padding:4px 0 8px;">Problem Report Team &bull; Change Request Team &bull; Change Notice Team &bull; Change Activity Team</p>' +
    '<p>However, these templates have <strong>no participants assigned to the roles</strong> by default. You need to open each template and add your groups to the appropriate roles. This sets the default participant assignments that all new change objects will inherit.</p>' +
    '<p>You do <strong>not</strong> need to create new team templates. Just edit the existing ones.</p>'
  );

  // Team template items - grouped by template
  var ttItems = [
    ['tt_pr', 'Edit: Problem Report Team', 'Open this OOTB template and assign groups to its roles:', [
      ['Change Admin I', 'change_admin_1'],
      ['Problem Report Author', 'pr_author'],
    ]],
    ['tt_cr', 'Edit: Change Request Team', 'Open this OOTB template and assign groups to its roles:', [
      ['Change Admin I', 'change_admin_1'],
      ['Change Admin II', 'change_admin_2'],
      ['Change Review Board', 'change_review_board'],
      ['Change Request Author', 'cr_author'],
    ]],
    ['tt_cn', 'Edit: Change Notice Team', 'Open this OOTB template and assign groups to its roles:', [
      ['Change Admin II', 'change_admin_2'],
      ['Change Admin III', 'change_admin_3'],
      ['Change Implementation', 'change_impl'],
    ]],
    ['tt_ca', 'Edit: Change Activity Team', 'Open this OOTB template and assign groups to its roles:', [
      ['Assignee', 'assignee'],
      ['Reviewer', 'reviewer'],
    ]],
  ];
  ttItems.forEach(function(tt) {
    var roleDetail = tt[2] + ' ' + tt[3].map(function(r) {
      return r[0] + ' &larr; ' + (roleGroups(r[1]).join(', ') || '(none)');
    }).join(' | ');
    var ppl = [];
    tt[3].forEach(function(r) { ppl = ppl.concat(roleMembers(r[1])); });
    s4 += clItem(tt[0], tt[1], roleDetail, 'Site &rarr; Templates &rarr; Team Templates &rarr; ' + tt[1].replace('Edit: ',''), ppl);
    allIds.push(tt[0]);
  });
  s4 += '</div>';
  html += s4;

  // === STEP 5: Context Teams (per Product/Library) ===
  var s5 = '';
  s5 += sectionHead(5, 'Configure Context Teams (per Product/Library)', 'PREFERRED: Override team template assignments at each Product/Library', 'manual');
  s5 += bp('Best Practice: Context Teams vs. Custom Team Templates',
    '<p>After populating the OOTB team templates (Step 4), you can further customize participant assignments per Product or Library using <strong>context teams</strong>.</p>' +
    '<div class="bp-comparison">' +
      '<div class="bp-option recommended">' +
        '<h4>Context Teams <span class="bp-tag preferred">PTC Preferred</span></h4>' +
        '<ul>' +
          '<li>Override template assignments at each Product/Library</li>' +
          '<li>Easier to implement and maintain</li>' +
          '<li>Different Products can have different groups in same role</li>' +
          '<li>Limitation: shared roles (e.g. Change Admin II) use same group across workflows within a Product</li>' +
        '</ul>' +
      '</div>' +
      '<div class="bp-option alternative">' +
        '<h4>Skip (use template defaults) <span class="bp-tag alternative">Also Valid</span></h4>' +
        '<ul>' +
          '<li>If all Products use the same teams, Step 4 may be sufficient</li>' +
          '<li>Context teams are only needed if Products differ</li>' +
        '</ul>' +
      '</div>' +
    '</div>' +
    '<div class="bp-quote"><p>The context team method is easier to implement and maintain. It is preferable to specify participants in a context team.</p>' +
    '<div class="bp-source">&mdash; PTC Windchill Change Implementation Training Guide</div></div>'
  );

  var ctxRoles = [
    ['ctx_ca1', 'Change Admin I', 'Manages PRs, analyzes CRs.', 'change_admin_1'],
    ['ctx_ca2', 'Change Admin II', 'Creates CNs, manages CRB, audits. Shared across CR and CN workflows.', 'change_admin_2'],
    ['ctx_ca3', 'Change Admin III', 'Oversees CN execution and release.', 'change_admin_3'],
    ['ctx_crb', 'Change Review Board', 'Reviews and votes on CRs.', 'change_review_board'],
    ['ctx_pra', 'Problem Report Author', 'Creates and submits PRs.', 'pr_author'],
    ['ctx_cra', 'Change Request Author', 'Creates and submits CRs.', 'cr_author'],
    ['ctx_ci', 'Change Implementation', 'Executes implementation plan tasks.', 'change_impl'],
    ['ctx_assign', 'Assignee', 'Assigned to CN tasks.', 'assignee'],
    ['ctx_rev', 'Reviewer', 'Reviews CN task deliverables.', 'reviewer'],
  ];
  ctxRoles.forEach(function(r) {
    var grps = roleGroups(r[3]).join(', ') || '(none assigned)';
    s5 += clItem(r[0], 'Assign group(s) to ' + r[1], r[2] + ' Group: ' + grps, '[Product/Library] &rarr; Team &rarr; Edit Team &rarr; ' + r[1], roleMembers(r[3]));
    allIds.push(r[0]);
  });

  // Advanced: Override team templates at org level
  s5 += '<div class="cl-advanced">' +
    '<div class="cl-advanced-header"><span class="bp-arrow">&#9654;</span> Alternative: Create Org-Level Team Template Overrides (only if needed)</div>' +
    '<div class="cl-advanced-body">';
  s5 += bp('When would you create org-level overrides?',
    '<p>Only when <strong>the same role name needs different groups in different workflows</strong>. The most common case: Change Admin II appears in both the Change Request Team and Change Notice Team.</p>' +
    '<p>With context teams, Change Admin II is always the same group. If your process requires different people for CR vs CN management, create org-level templates with the exact same names as the Site-level ones. The org-level template overrides the Site-level one.</p>' +
    '<p>PTC notes a third option: <em>You can customize workflows so they do not share role names, letting you keep using context teams while separating participants per workflow.</em></p>'
  );
  var overrides = [
    ['tt_ov_pr', 'Create org override: Problem Report Team', 'Create at ' + org + ' org level with exact name &quot;Problem Report Team&quot;. Add roles: Change Admin I, PR Author. Assign groups.'],
    ['tt_ov_cr', 'Create org override: Change Request Team', 'Exact name &quot;Change Request Team&quot;. Roles: Change Admin I, Change Admin II, CRB, CR Author.'],
    ['tt_ov_cn', 'Create org override: Change Notice Team', 'Exact name &quot;Change Notice Team&quot;. Here you can assign a DIFFERENT group to Change Admin II.'],
    ['tt_ov_ca', 'Create org override: Change Activity Team', 'Exact name &quot;Change Activity Team&quot;. Roles: Assignee, Reviewer.'],
  ];
  overrides.forEach(function(ov) {
    s5 += clItem(ov[0], ov[1], ov[2], org + ' &rarr; Templates &rarr; Team Templates &rarr; New Team Template');
    allIds.push(ov[0]);
  });
  s5 += '</div></div>';
  s5 += '</div>';
  html += s5;

  // === STEP 5: Automated Deployment ===
  var s6_d = '';
  s6_d += sectionHead(6, 'Run Automated Deployment', 'Loads OIR, business rules, and preferences', 'auto');
  s6_d += bp('What does deploy_all.bat actually do?',
    '<p><strong>Object Initialization Rules (OIR)</strong> &mdash; Binds each change object to its lifecycle, workflow, and team template.</p>' +
    '<p><strong>Business Rules</strong> &mdash; CHANGEABLE_PRE_RELEASE validates objects before release (not checked out, valid release targets).</p>' +
    '<p><strong>Preferences</strong> &mdash; The 8 change management preferences controlling process behavior.</p>' +
    '<p>Groups, team membership, and association rules require the Windchill UI.</p>'
  );
  var deployItems = [
    ['deploy_copy', 'Copy generated folder to Windchill server', 'Copy to a location accessible from Windchill shell.', 'Copy to server'],
    ['deploy_dry', 'Run deploy_all.bat --dry-run first', 'Preview without making changes.', 'Windchill shell &rarr; deploy_all.bat --dry-run'],
    ['oir', 'Object Initialization Rules loaded', 'Binds PR, CR, CN, CA to lifecycles/workflows/team templates.', 'windchill wt.load.LoadFromFile'],
    ['bizrules', 'Business Rules loaded', 'CHANGEABLE_PRE_RELEASE rule set.', 'windchill wt.load.LoadFromFile'],
    ['prefs', 'Preferences set', 'All 8 preferences at ' + esc(config.company.context_level) + ' level' + (config.company.lock_preferences ? ', locked.' : '.'), 'windchill wt.pref.PrefCmd'],
  ];
  deployItems.forEach(function(d) {
    s6_d += clItem(d[0], d[1], d[2], d[3], null, true);
    allIds.push(d[0]);
  });
  s6_d += '</div>';
  html += s6_d;

  // === STEP 6: Association Rules ===
  var s7_a = '';
  s7_a += sectionHead(7, 'Configure Association Rules', 'Disable OOB rules and create yours', 'manual');
  s7_a += bp('Best Practice: Why disable the out-of-the-box rules?',
    '<div class="bp-quote"><p>In most cases, PTC recommends customers to disable the out-of-the-box rules and define the rules they want for their change process.</p>' +
    '<div class="bp-source">&mdash; PTC Windchill Change Implementation Training Guide</div></div>' +
    '<p>Association rules control which change objects can be linked and their cardinality. Starting clean prevents unexpected associations.</p>'
  );
  s7_a += clItem('assoc_disable', 'Disable out-of-the-box rules', 'Uncheck Enabled for each OOB rule.', org + ' &rarr; Utilities &rarr; Business Rules &rarr; Change Association Rules');
  allIds.push('assoc_disable');
  var ac = config.associations || {};
  if (ac.pr_to_cr && ac.pr_to_cr.enabled) { s7_a += clItem('assoc_pr_cr', 'Create: Problem Report &rarr; Change Request', 'Type: Change Process, Cardinality: ' + (ac.pr_to_cr.cardinality||'many:1'), org + ' &rarr; Utilities &rarr; Business Rules &rarr; New Change Association Rule'); allIds.push('assoc_pr_cr'); }
  if (ac.cr_to_cn && ac.cr_to_cn.enabled) { s7_a += clItem('assoc_cr_cn', 'Create: Change Request &rarr; Change Notice', 'Type: Change Process, Cardinality: ' + (ac.cr_to_cn.cardinality||'many:1'), org + ' &rarr; Utilities &rarr; Business Rules &rarr; New Change Association Rule'); allIds.push('assoc_cr_cn'); }
  if (ac.cn_to_task && ac.cn_to_task.enabled) { s7_a += clItem('assoc_cn_task', 'Create: Change Notice &rarr; Change Activity', 'Type: Change Process, Cardinality: ' + (ac.cn_to_task.cardinality||'1:many'), org + ' &rarr; Utilities &rarr; Business Rules &rarr; New Change Association Rule'); allIds.push('assoc_cn_task'); }
  if (ac.pr_to_cn && ac.pr_to_cn.enabled) { s7_a += clItem('assoc_pr_cn', 'Create: Problem Report &rarr; Change Notice (non-standard)', 'Type: Change Process, Cardinality: ' + (ac.pr_to_cn.cardinality||'many:1'), org + ' &rarr; Utilities &rarr; Business Rules &rarr; New Change Association Rule'); allIds.push('assoc_pr_cn'); }
  s7_a += '</div>';
  html += s7_a;

  // === STEP 8: Access Control ===
  var s8_ac = '';
  s8_ac += sectionHead(8, 'Verify Access Control Policies', 'Ensure lifecycle states have correct permissions per role', 'manual');
  s8_ac += bp('What do access control policies affect?',
    '<p>Access control policies determine who can read, modify, or delete objects at each lifecycle state. Pay attention to Change Admin roles having modify access where they act.</p>' +
    '<p>The OOTB policies are generally reasonable, but verify they align with your process.</p>'
  );
  var acpItems = [
    ['acp_pr', 'Review: Problem Report Life Cycle', 'States: Open, Under Review, Resolved, Canceled. Check Change Admin I and PR Author permissions.'],
    ['acp_cr', 'Review: Change Request Life Cycle', 'States: Open, Under Review, Approved, Rejected, Implementation, Resolved, Canceled.'],
    ['acp_cn', 'Review: Change Notice Life Cycle', 'Check Change Admin II/III and Change Implementation permissions.'],
  ];
  acpItems.forEach(function(a) {
    s8_ac += clItem(a[0], a[1], a[2], org + ' &rarr; Utilities &rarr; Policy Administration &rarr; Access Control');
    allIds.push(a[0]);
  });
  s8_ac += '</div>';
  html += s8_ac;

  // === STEP 9: End-to-End Test ===
  var s9_t = '';
  s9_t += sectionHead(9, 'End-to-End Test', 'Verify the complete change process works', 'manual');
  s9_t += bp('How to approach testing',
    '<p>PTC recommends an <strong>iterative approach</strong>. Sign in as different users to test each role:</p>' +
    '<p><strong>PR Author</strong> creates PR &rarr; <strong>Change Admin I</strong> analyzes, creates CR &rarr; <strong>CRB</strong> reviews &rarr; <strong>Change Admin II</strong> creates CN &rarr; <strong>Assignees</strong> complete tasks &rarr; <strong>Reviewers</strong> verify &rarr; <strong>Change Admin II</strong> releases.</p>' +
    '<p>If a step fails, check: (1) Is the user in the correct group? (2) Is the group in the context team role? (3) Does access control allow the action at that lifecycle state?</p>'
  );
  var testItems = [
    ['test_pr', 'Create a test Problem Report', 'Sign in as PR Author. Create and submit.', '[Product] &rarr; Change &rarr; New Problem Report'],
    ['test_cr', 'Create CR from PR', 'As Change Admin I, analyze PR and create CR.', 'PR &rarr; Actions &rarr; New Change Request'],
    ['test_crb', 'Run CR through CRB review', 'Route for review (Fast/Full Track). Verify CRB members get tasks.', 'Change Request &rarr; Workflow Task'],
    ['test_cn', 'Create CN from approved CR', 'As Change Admin II, create CN. Check affected objects.', 'CR &rarr; Actions &rarr; New Change Notice'],
    ['test_task', 'Complete CN tasks', 'Verify assignees receive tasks. Complete and review each.', 'Change Notice &rarr; Implementation Plan'],
    ['test_release', 'Audit and release CN', 'As Change Admin II, audit. CHANGEABLE_PRE_RELEASE validates. Release.', 'CN &rarr; Workflow Task &rarr; Release'],
  ];
  testItems.forEach(function(t) {
    s9_t += clItem(t[0], t[1], t[2], t[3]);
    allIds.push(t[0]);
  });
  s9_t += '</div>';
  html += s9_t;

  // Progress bar
  var checkedCount = 0;
  allIds.forEach(function(id) { if (checklistState[id]) checkedCount++; });
  // Auto-checked items (deploy step)
  deployItems.forEach(function(d) { if (!checklistState[d[0]]) { checklistState[d[0]] = true; checkedCount++; } });
  var totalCount = allIds.length;
  var pct = totalCount > 0 ? Math.round(checkedCount / totalCount * 100) : 0;

  var progressHtml = '<div class="cl-progress"><div class="cl-progress-bar"><div class="cl-progress-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="cl-progress-text">' + checkedCount + '/' + totalCount + '</div></div>';

  document.getElementById("main").innerHTML = '<h1 class="sec-title">Post-Deployment Checklist</h1>' +
    '<p class="sec-desc">Work through each step in order. Click items to mark complete. Blue panels contain best-practice guidance from PTC training material.</p>' +
    progressHtml + html + navButtons();
  } catch(err) {
    document.getElementById("main").innerHTML = '<h1 style="color:#ef4444;">Checklist Error</h1><pre style="color:#fca5a5;white-space:pre-wrap;">' + err.message + '\n\n' + err.stack + '</pre>' + navButtons();
  }
}
function toggleCheck(id) {
  checklistState[id] = !checklistState[id];
  renderChecklist();
}

// Event delegation for expanders and advanced checklist items
document.addEventListener('click', function(e) {
  var header = e.target.closest('.bp-header, .cl-advanced-header');
  if (header) {
    header.closest('.bp-expander, .cl-advanced').classList.toggle('open');
    return;
  }
  var checkItem = e.target.closest('[data-check]');
  if (checkItem) {
    toggleCheck(checkItem.getAttribute('data-check'));
  }
});

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
