/**
 * WCAI -- Windchill Config AI -- Main Application
 * ================================================
 * Extracted from run.py inline JS. Replaces server API calls
 * with local function calls. Adds localStorage persistence,
 * YAML upload/download, and ZIP download.
 * Attached to window.WCAI.app.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};
  var m = WCAI.model;
  var loader = WCAI.loader;
  var validators = WCAI.validators;
  var generators = WCAI.generators;

  // ============================================================
  // State
  // ============================================================
  var config = null;
  var model = null;
  var currentStep = 0;
  var checklistState = {};
  var openSections = {}; // which checklist sections are expanded
  var generatedFiles = null; // cached after generate

  var STORAGE_KEY_CONFIG = "wcai_config";
  var STORAGE_KEY_CHECKLIST = "wcai_checklist";
  var STORAGE_KEY_SECTIONS = "wcai_open_sections";
  var STORAGE_KEY_STEP = "wcai_step";

  var STEPS = [
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
  // LocalStorage helpers
  // ============================================================
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      localStorage.setItem(STORAGE_KEY_CHECKLIST, JSON.stringify(checklistState));
      localStorage.setItem(STORAGE_KEY_STEP, String(currentStep));
      localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(openSections));
    } catch (e) { /* quota exceeded or unavailable */ }
  }

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (raw) {
        config = JSON.parse(raw);
        return true;
      }
    } catch (e) { /* parse error */ }
    return false;
  }

  function loadChecklistFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_CHECKLIST);
      if (raw) checklistState = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    try {
      var raw2 = localStorage.getItem(STORAGE_KEY_SECTIONS);
      if (raw2) openSections = JSON.parse(raw2);
    } catch (e) { /* ignore */ }
  }

  function loadStepFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_STEP);
      if (raw) {
        var step = parseInt(raw, 10);
        if (!isNaN(step) && step >= 0 && step < STEPS.length) return step;
      }
    } catch (e) { /* ignore */ }
    return 0;
  }

  // ============================================================
  // Init
  // ============================================================
  function init() {
    model = m.getModelMetadata();

    if (!loadFromStorage()) {
      config = loader.getDefaultConfig();
    }
    loadChecklistFromStorage();
    currentStep = loadStepFromStorage();

    renderNav();
    goToStep(currentStep);
  }

  // ============================================================
  // Navigation
  // ============================================================
  function renderNav() {
    var nav = document.getElementById("nav");
    var html = "";
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      html += '<li id="nav-' + i + '" onclick="WCAI.app.goToStep(' + i + ')" class="' + (i === currentStep ? 'active' : '') + '">' +
        '<span class="num">' + (i + 1) + '</span> ' + s.label + '</li>';
    }
    nav.innerHTML = html;

    var pct = Math.round((currentStep / (STEPS.length - 1)) * 100);
    document.getElementById("progress-fill").style.width = pct + "%";
  }

  function goToStep(i) {
    currentStep = i;
    saveToStorage();
    renderNav();
    var renderers = [renderCompany, renderGroups, renderPeople, renderRoles, renderPrefs, renderAssoc, renderValidate, renderGenerate, renderChecklist];
    renderers[i]();
  }

  function navButtons(backEnabled) {
    if (backEnabled === undefined) backEnabled = true;
    var isFirst = currentStep === 0;
    var isLast = currentStep === STEPS.length - 1;
    return '<div class="nav-btns">' +
      '<button class="btn btn-secondary" onclick="WCAI.app.goToStep(' + (currentStep - 1) + ')" ' + (isFirst || !backEnabled ? 'disabled' : '') + '>Back</button>' +
      (!isLast ? '<button class="btn btn-primary" onclick="WCAI.app.saveAndNext()">Save & Continue</button>' : '') +
      '</div>';
  }

  function saveAndNext() {
    saveToStorage();
    goToStep(currentStep + 1);
  }

  // ============================================================
  // YAML Upload / Download
  // ============================================================
  function uploadYaml(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        config = loader.parseYaml(e.target.result);
        saveToStorage();
        goToStep(0);
      } catch (err) {
        alert("Failed to load YAML: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function downloadYaml() {
    var yaml = loader.toYaml(config);
    downloadFile("company_config.yaml", yaml, "text/yaml");
  }

  // ============================================================
  // File Download Helpers
  // ============================================================
  function downloadFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadSingleFile(index) {
    if (!generatedFiles || !generatedFiles[index]) return;
    var f = generatedFiles[index];
    downloadFile(f.name, f.content);
  }

  function downloadZip() {
    if (!generatedFiles) return;
    var zip = new JSZip();
    for (var i = 0; i < generatedFiles.length; i++) {
      zip.file(generatedFiles[i].name, generatedFiles[i].content);
    }
    // Also include the YAML config
    zip.file("company_config.yaml", loader.toYaml(config));

    zip.generateAsync({ type: "blob" }).then(function (blob) {
      var companyName = (config.company.name || "wcai").replace(/ /g, "_").toLowerCase();
      downloadFile(companyName + "_deploy.zip", blob, "application/zip");
    });
  }

  // ============================================================
  // Reset
  // ============================================================
  function resetAll() {
    if (!confirm("Reset all data? This clears your config, checklist, and all progress.")) return;
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    localStorage.removeItem(STORAGE_KEY_CHECKLIST);
    localStorage.removeItem(STORAGE_KEY_STEP);
    localStorage.removeItem(STORAGE_KEY_SECTIONS);
    config = loader.getDefaultConfig();
    checklistState = {};
    openSections = {};
    generatedFiles = null;
    goToStep(0);
  }

  // ============================================================
  // Step 1: Company
  // ============================================================
  function renderCompany() {
    var c = config.company;
    document.getElementById("main").innerHTML =
      '<h1 class="sec-title">Company & Organization</h1>' +
      '<p class="sec-desc">Define your Windchill site and organization context. These values determine where configuration artifacts are deployed in the Windchill context hierarchy.</p>' +
      '<div class="row">' +
        '<div class="field"><label>Company Name *</label>' +
          '<input id="c-name" value="' + esc(c.name) + '" placeholder="e.g. Acme Engineering" oninput="WCAI.app.setCompany(\'name\',this.value)"></div>' +
        '<div class="field"><label>Windchill Organization *</label>' +
          '<input id="c-org" value="' + esc(c.org) + '" placeholder="e.g. AcmeOrg" oninput="WCAI.app.setCompany(\'org\',this.value)"></div>' +
      '</div>' +
      '<div class="row">' +
        '<div class="field"><label>Windchill Site</label>' +
          '<input id="c-site" value="' + esc(c.site) + '" placeholder="e.g. acme-wc-prod" oninput="WCAI.app.setCompany(\'site\',this.value)"></div>' +
        '<div class="field"><label>Context Level</label>' +
          '<select onchange="WCAI.app.setCompany(\'context_level\',this.value)">' +
            '<option value="organization"' + (c.context_level === 'organization' ? ' selected' : '') + '>Organization</option>' +
            '<option value="site"' + (c.context_level === 'site' ? ' selected' : '') + '>Site</option>' +
          '</select></div>' +
      '</div>' +
      '<div style="margin-top:12px">' +
        toggleRow('Lock preferences at context level', 'Prevent lower contexts from overriding', c.lock_preferences, "WCAI.app.toggleCompany('lock_preferences')") +
        toggleRow('Use flexible change items', 'Windchill 11.2+ flexible change objects', c.use_flexible_change, "WCAI.app.toggleCompany('use_flexible_change')") +
      '</div>' +
      navButtons(false);
  }

  function setCompany(key, value) {
    config.company[key] = value;
  }

  function toggleCompany(key) {
    config.company[key] = !config.company[key];
    renderCompany();
  }

  // ============================================================
  // Step 2: Groups
  // ============================================================
  function renderGroups() {
    var groups = config.groups || [];
    var html = '<h1 class="sec-title">Groups & Departments</h1>' +
      '<p class="sec-desc">Define organizational groups. People will be assigned to these groups for organization.</p>' +
      '<div id="groups-list">';

    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      html += '<div class="card">' +
        '<div class="card-head"><span>Group ' + (i + 1) + '</span><button class="remove-btn" onclick="WCAI.app.removeGroup(' + i + ')">Remove</button></div>' +
        '<div class="row">' +
          '<div class="field"><label>Group ID</label><input value="' + esc(g.id) + '" placeholder="eng" oninput="WCAI.app.setGroup(' + i + ',\'id\',this.value)"></div>' +
          '<div class="field"><label>Name</label><input value="' + esc(g.name) + '" placeholder="Engineering" oninput="WCAI.app.setGroup(' + i + ',\'name\',this.value)"></div>' +
          '<div class="field"><label>Description</label><input value="' + esc(g.description || '') + '" placeholder="Product engineering team" oninput="WCAI.app.setGroup(' + i + ',\'description\',this.value)"></div>' +
        '</div></div>';
    }

    html += '</div>' +
      '<button class="add-btn" onclick="WCAI.app.addGroup()">+ Add Group</button>' +
      navButtons();

    document.getElementById("main").innerHTML = html;
  }

  function addGroup() {
    config.groups.push({ id: '', name: '', description: '' });
    renderGroups();
  }

  function removeGroup(i) {
    config.groups.splice(i, 1);
    renderGroups();
  }

  function setGroup(i, key, value) {
    config.groups[i][key] = value;
  }

  // ============================================================
  // Step 3: People
  // ============================================================
  function renderPeople() {
    var people = config.people || [];
    var groups = config.groups || [];
    var html = '<h1 class="sec-title">People</h1>' +
      '<p class="sec-desc">Add team members who will participate in the change process. Usernames must match their Windchill login.</p>' +
      '<div id="people-list">';

    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      var groupOpts = '<option value="">-- None --</option>';
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        groupOpts += '<option value="' + esc(g.id) + '"' + (p.group === g.id ? ' selected' : '') + '>' + esc(g.name || g.id) + '</option>';
      }

      html += '<div class="card">' +
        '<div class="card-head"><span>Person ' + (i + 1) + '</span><button class="remove-btn" onclick="WCAI.app.removePerson(' + i + ')">Remove</button></div>' +
        '<div class="row">' +
          '<div class="field"><label>Full Name</label><input value="' + esc(p.name) + '" placeholder="Jane Smith" oninput="WCAI.app.setPerson(' + i + ',\'name\',this.value)"></div>' +
          '<div class="field"><label>Username *</label><input value="' + esc(p.username) + '" placeholder="jsmith" oninput="WCAI.app.updatePersonId(' + i + ',this.value)"></div>' +
          '<div class="field"><label>Email</label><input value="' + esc(p.email || '') + '" placeholder="jsmith@company.com" oninput="WCAI.app.setPerson(' + i + ',\'email\',this.value)"></div>' +
        '</div>' +
        '<div class="row">' +
          '<div class="field"><label>Group</label><select onchange="WCAI.app.setPerson(' + i + ',\'group\',this.value)">' + groupOpts + '</select></div>' +
          '<div class="field"></div><div class="field"></div>' +
        '</div></div>';
    }

    html += '</div>' +
      '<button class="add-btn" onclick="WCAI.app.addPerson()">+ Add Person</button>' +
      navButtons();

    document.getElementById("main").innerHTML = html;
  }

  function addPerson() {
    config.people.push({ id: '', name: '', username: '', email: '', group: '' });
    renderPeople();
  }

  function removePerson(i) {
    config.people.splice(i, 1);
    renderPeople();
  }

  function setPerson(i, key, value) {
    config.people[i][key] = value;
  }

  function updatePersonId(i, val) {
    config.people[i].username = val;
    config.people[i].id = val;
  }

  // ============================================================
  // Step 4: Role Mapping (Groups -> Roles)
  // ============================================================
  function renderRoles() {
    var groups = config.groups || [];
    var roles = config.roles || {};
    var html = '<h1 class="sec-title">Role Mapping (Groups to Roles)</h1>' +
      '<p class="sec-desc">Map your Windchill groups to change management roles. In Windchill, the best practice is: <strong>Users -> Groups -> Roles</strong>. Click a group to toggle its assignment to each role.</p>';

    for (var rid in model.roles) {
      var r = model.roles[rid];
      var assigned = roles[rid] || [];
      html += '<div class="role-card">' +
        '<div class="role-name">' + esc(r.display_name) + '</div>' +
        '<div class="role-desc">' + esc(r.description) + '</div>' +
        '<div class="role-used">Used by: ' + r.used_by.join(' / ') + '</div>' +
        '<div class="chips">';

      if (groups.length === 0) {
        html += '<span class="no-people">Add groups in Step 2 first</span>';
      } else {
        for (var gi = 0; gi < groups.length; gi++) {
          var g = groups[gi];
          var sel = assigned.indexOf(g.id) >= 0;
          html += '<button class="chip' + (sel ? ' selected' : '') + '" onclick="WCAI.app.toggleRole(\'' + rid + '\',\'' + esc(g.id) + '\')">' +
            (sel ? '&#10003; ' : '') + esc(g.name || g.id) + '</button>';
        }
      }
      html += '</div>';

      if (assigned.length > 0) {
        var memberParts = [];
        for (var ai = 0; ai < assigned.length; ai++) {
          var gid = assigned[ai];
          var members = (config.people || []).filter(function (p) { return p.group === gid; }).map(function (p) { return p.name || p.username; });
          if (members.length > 0) {
            var gName = gid;
            for (var ggi = 0; ggi < groups.length; ggi++) {
              if (groups[ggi].id === gid) { gName = groups[ggi].name || gid; break; }
            }
            memberParts.push('<strong>' + esc(gName) + '</strong>: ' + members.map(function (mm) { return esc(mm); }).join(', '));
          }
        }
        if (memberParts.length > 0) {
          html += '<div style="margin-top:8px;font-size:11px;color:#64748b;">Members: ' + memberParts.join(' | ') + '</div>';
        }
      }
      html += '</div>';
    }

    html += navButtons();
    document.getElementById("main").innerHTML = html;
  }

  function toggleRole(roleId, groupId) {
    if (!config.roles[roleId]) config.roles[roleId] = [];
    var arr = config.roles[roleId];
    var idx = arr.indexOf(groupId);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(groupId);
    renderRoles();
  }

  // ============================================================
  // Step 5: Preferences
  // ============================================================
  function renderPrefs() {
    var html = '<h1 class="sec-title">Change Management Preferences</h1>' +
      '<p class="sec-desc">Configure preferences that control your change process behavior. These map directly to Windchill Preference Management settings.</p>';

    for (var pk in model.preferences) {
      var p = model.preferences[pk];
      var val = config.preferences[pk] || p.default;
      var isYes = val === "Yes";
      html += toggleRow(p.display_name, p.description, isYes,
        "WCAI.app.togglePref('" + pk + "')");
    }

    html += navButtons();
    document.getElementById("main").innerHTML = html;
  }

  function togglePref(pk) {
    config.preferences[pk] = config.preferences[pk] === 'Yes' ? 'No' : 'Yes';
    renderPrefs();
  }

  // ============================================================
  // Step 6: Associations
  // ============================================================
  function renderAssoc() {
    var html = '<h1 class="sec-title">Change Association Rules</h1>' +
      '<p class="sec-desc">Define which change objects can be linked together. PTC recommends disabling the OOB rules and defining only what your process requires.</p>';

    for (var ak in model.associations) {
      var a = model.associations[ak];
      var ua = config.associations[ak] || {};
      var enabled = ua.enabled !== false;
      var tag = a.standard ? '' : ' <span style="color:#f59e0b;font-size:10px;font-weight:700">NON-STANDARD</span>';
      html += '<div class="toggle-row">' +
        '<div class="toggle-info">' +
          '<div class="name">' + esc(a.role_a) + ' <span class="assoc-arrow">-></span> ' + esc(a.role_b) + tag + '</div>' +
          '<div class="desc">' + esc(a.description) + '</div>' +
        '</div>' +
        '<div class="toggle-ctrl">' +
          '<span class="toggle-val ' + (enabled ? 'on' : 'off') + '">' + (enabled ? 'Enabled' : 'Disabled') + '</span>' +
          '<button class="switch ' + (enabled ? 'on' : '') + '" onclick="WCAI.app.toggleAssoc(\'' + ak + '\')">' +
            '<span class="dot"></span>' +
          '</button>' +
        '</div></div>';
    }

    html += navButtons();
    document.getElementById("main").innerHTML = html;
  }

  function toggleAssoc(ak) {
    config.associations[ak].enabled = !config.associations[ak].enabled;
    renderAssoc();
  }

  // ============================================================
  // Step 7: Validate
  // ============================================================
  function renderValidate() {
    // Build _people_index for validation
    config._people_index = {};
    var people = config.people || [];
    for (var i = 0; i < people.length; i++) {
      config._people_index[people[i].id] = people[i];
    }

    var issues = validators.validate(config);
    var errors = issues.filter(function (i) { return i.severity === "ERROR"; });
    var warnings = issues.filter(function (i) { return i.severity === "WARNING"; });
    var infos = issues.filter(function (i) { return i.severity === "INFO"; });

    var html = '<h1 class="sec-title">Validate Configuration</h1>' +
      '<p class="sec-desc">' + errors.length + ' errors, ' + warnings.length + ' warnings, ' + infos.length + ' info</p>';

    if (issues.length === 0) {
      html += '<div class="success-box"><h3>All clear!</h3><p>No issues found. Ready to generate.</p></div>';
    } else {
      for (var ii = 0; ii < issues.length; ii++) {
        var iss = issues[ii];
        html += '<div class="issue ' + iss.severity + '">' +
          '<strong>[' + iss.section + ']</strong> ' + esc(iss.message) +
          (iss.fix_hint ? '<div class="hint">Fix: ' + esc(iss.fix_hint) + '</div>' : '') +
          '</div>';
      }
    }

    html += navButtons();
    document.getElementById("main").innerHTML = html;
  }

  // ============================================================
  // Step 8: Generate
  // ============================================================
  function renderGenerate() {
    document.getElementById("main").innerHTML =
      '<h1 class="sec-title">Generate Deployment Artifacts</h1>' +
      '<p class="sec-desc">Generate all Windchill deployment files from your config. Files are downloaded to your browser -- no server needed.</p>' +
      '<div style="text-align:center; padding: 40px 0;">' +
        '<button class="btn btn-primary" onclick="WCAI.app.doGenerate()" style="padding:14px 32px;font-size:15px;">' +
          'Generate All Files' +
        '</button>' +
      '</div>' +
      navButtons();
  }

  function doGenerate() {
    try {
      generatedFiles = generators.generateAll(config);

      var html = '<h1 class="sec-title">Generation Complete!</h1>' +
        '<p class="sec-desc">All artifacts generated for ' + esc(config.company.name) + '.</p>' +
        '<div class="success-box">' +
          '<h3>Ready to download</h3>' +
          '<p>' + generatedFiles.length + ' deployment files generated. Download individually or as a ZIP.</p>' +
        '</div>' +
        '<div style="text-align:center; margin-top:16px; display:flex; gap:12px; justify-content:center;">' +
          '<button class="btn btn-primary" onclick="WCAI.app.downloadZip()" style="padding:12px 28px;">' +
            'Download All as ZIP' +
          '</button>' +
          '<button class="btn btn-secondary" onclick="WCAI.app.downloadYaml()" style="padding:12px 28px;">' +
            'Download YAML Config' +
          '</button>' +
        '</div>' +
        '<div class="file-list">';

      for (var i = 0; i < generatedFiles.length; i++) {
        var f = generatedFiles[i];
        html += '<div class="file-item">' +
          '<span class="file-name">' + esc(f.name) + '</span>' +
          '<div class="file-actions">' +
            '<span class="file-size">' + f.content.length.toLocaleString() + ' bytes</span>' +
            '<button class="btn-download" onclick="WCAI.app.downloadSingleFile(' + i + ')">Download</button>' +
          '</div></div>';
      }

      html += '</div>' +
        '<div class="success-box" style="margin-top:16px;">' +
          '<h3>Next Steps</h3>' +
          '<p>1. Copy the generated files to your Windchill server</p>' +
          '<p>2. Open your Windchill shell on the server</p>' +
          '<p>3. <code>cd [path-to-generated-folder]</code></p>' +
          '<p>4. <code>deploy_all.bat --dry-run</code> (preview)</p>' +
          '<p>5. <code>deploy_all.bat</code> (deploy for real)</p>' +
          '<p style="margin-top:10px">6. Then continue to the <strong>Deploy Checklist</strong> for manual steps:</p>' +
        '</div>' +
        '<div style="text-align:center; margin-top:16px;">' +
          '<button class="btn btn-primary" onclick="WCAI.app.goToStep(' + (STEPS.length - 1) + ')" style="padding:12px 28px;">' +
            'Open Post-Deploy Checklist ->' +
          '</button>' +
        '</div>' +
        navButtons();

      document.getElementById("main").innerHTML = html;
    } catch (err) {
      document.getElementById("main").innerHTML =
        '<h1 class="sec-title">Generation Failed</h1>' +
        '<div class="issue ERROR">' + esc(err.message) + '</div>' +
        navButtons();
    }
  }

  // ============================================================
  // Step 9: Post-Deployment Checklist
  // ============================================================
  function renderChecklist() {
    try {
      var org = esc(config.company.org || 'YourOrg');
      var name = esc(config.company.name || 'Your Company');
      var people = config.people || [];
      var roles = config.roles || {};

      // Track items per section: sections[sectionKey] = [id, id, ...]
      var sections = {};
      var sectionOrder = [];
      var curSection = null;

      function roleGroups(roleId) {
        var gids = roles[roleId] || [];
        return gids.map(function (gid) {
          var g = (config.groups || []).find(function (gg) { return gg.id === gid; });
          return g ? (g.name || g.id) : gid;
        });
      }

      function roleMembers(roleId) {
        var gids = roles[roleId] || [];
        var members = [];
        gids.forEach(function (gid) {
          people.filter(function (p) { return p.group === gid; }).forEach(function (p) {
            members.push(p.name || p.username);
          });
        });
        var unique = [];
        members.forEach(function (mm) { if (unique.indexOf(mm) < 0) unique.push(mm); });
        return unique;
      }

      function trackId(id, autoCheck) {
        if (autoCheck && !checklistState[id]) checklistState[id] = true;
        if (curSection && sections[curSection]) sections[curSection].push(id);
      }

      function clItem(id, task, detail, nav, ppl, autoCheck) {
        var checked = checklistState[id] || autoCheck;
        trackId(id, autoCheck);
        var h = '<div class="cl-item' + (checked ? ' checked' : '') + '" onclick="WCAI.app.toggleCheck(\'' + id + '\')">';
        h += '<div class="cl-box">' + (checked ? 'X' : '') + '</div>';
        h += '<div class="cl-content">';
        h += '<div class="cl-task">' + task + '</div>';
        h += '<div class="cl-detail">' + detail + '</div>';
        h += '<div class="cl-nav">' + nav + '</div>';
        if (ppl && ppl.length > 0) {
          h += '<div class="cl-people">';
          var unique = [];
          ppl.forEach(function (p) { if (unique.indexOf(p) < 0) unique.push(p); });
          unique.forEach(function (p) { h += '<span class="cl-person">' + esc(p) + '</span>'; });
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

      function beginSection(key, num, title, subtitle, type) {
        curSection = key;
        sections[key] = [];
        sectionOrder.push({ key: key, num: num, title: title, subtitle: subtitle, type: type });
        var badge = type === 'auto' ? '<span class="cl-badge done">Automated</span>' : '<span class="cl-badge todo">Manual</span>';
        var isOpen = openSections[key];
        // Section wrapper -- header is always visible, body collapses
        return '<div class="cl-section' + (isOpen ? ' open' : '') + '" data-section="' + key + '">' +
          '<div class="cl-section-head" onclick="WCAI.app.toggleSection(\'' + key + '\')">' +
            '<div class="cl-section-num ' + type + '">' + num + '</div>' +
            '<div><div class="cl-section-title">' + title + ' ' + badge + '</div>' +
            '<div class="cl-section-subtitle">' + subtitle + '</div></div>' +
            '<div class="cl-section-meta">' +
              '<span class="cl-section-count" data-count="' + key + '"></span>' +
              '<span class="cl-section-arrow">&#9654;</span>' +
            '</div>' +
          '</div>' +
          '<div class="cl-section-body">';
      }

      function endSection() {
        curSection = null;
        return '</div></div>';
      }

      var html = '';

      // === STEP 1: Verify Org ===
      html += beginSection('s1', 1, 'Verify Organization Exists', 'PREREQUISITE: Must exist before anything else', 'manual');
      html += bp('Why does the organization matter?',
        '<p>In Windchill, everything is scoped to a context hierarchy: <strong>Site &rarr; Organization &rarr; Product/Library</strong>. Change management configuration is set at the Organization level and inherited downward.</p>' +
        '<p>If your organization does not exist yet, none of the subsequent steps will work.</p>'
      );
      html += clItem('org_exists', 'Verify organization \'' + org + '\' exists', 'Navigate to Site level and confirm your org is listed. If missing, create it now.', 'Site &rarr; Utilities &rarr; Organization Administration');
      html += endSection();

      // === STEP 2: Verify Users ===
      html += beginSection('s2', 2, 'Verify User Accounts Exist', 'Users must exist before they can join groups or teams', 'manual');
      html += bp('Where do Windchill users come from?',
        '<p><strong>LDAP/Active Directory sync</strong> &mdash; Most common in enterprise environments. Users are managed in AD and synced automatically.</p>' +
        '<p><strong>Manual creation</strong> &mdash; For smaller or dev/test environments via Participant Administration.</p>'
      );
      people.forEach(function (p, i) {
        var id = 'user_' + i;
        html += clItem(id, 'Verify user: ' + esc(p.name || p.username) + ' (' + esc(p.username) + ')', 'Search in Participant Administration.', 'Site &rarr; Utilities &rarr; Participant Administration &rarr; Search \'' + esc(p.username) + '\'');
      });
      html += endSection();

      // === STEP 3: Create Groups ===
      html += beginSection('s3', 3, 'Create Groups and Add Users', 'Create Windchill groups, add users. Groups are assigned to roles.', 'manual');
      html += bp('Best Practice: Why groups instead of individual users?',
        '<p>The Windchill best practice pattern is:</p>' +
        '<p style="text-align:center;font-size:14px;font-weight:700;color:#22c55e;padding:8px 0;">Users &rarr; Groups &rarr; Roles</p>' +
        '<p><strong>Maintainability:</strong> When someone joins or leaves, update group membership in one place. Every context team referencing that group reflects the change automatically.</p>' +
        '<p><strong>LDAP alignment:</strong> If Windchill groups map to AD groups, membership stays in sync with no manual administration.</p>' +
        '<p><strong>Auditability:</strong> Much easier to audit access when permissions flow through named groups.</p>'
      );
      (config.groups || []).forEach(function (g, i) {
        var id = 'grp_create_' + i;
        html += clItem(id, 'Create group: \'' + esc(g.name || g.id) + '\'', 'Create this internal group in your organization.', org + ' &rarr; Utilities &rarr; Participant Administration &rarr; Internal Groups &rarr; Create');
        var members = people.filter(function (p) { return p.group === g.id; });
        if (members.length > 0) {
          var mid = 'grp_members_' + i;
          html += clItem(mid, 'Add users to \'' + esc(g.name || g.id) + '\'', 'Add: ' + members.map(function (p) { return esc(p.name || p.username); }).join(', '), org + ' &rarr; Utilities &rarr; Participant Administration &rarr; Internal Groups &rarr; \'' + esc(g.name || g.id) + '\' &rarr; Add Members', members.map(function (p) { return p.name || p.username; }));
        }
      });
      var unassigned = people.filter(function (p) { return !p.group; });
      if (unassigned.length > 0) {
        html += clItem('grp_unassigned', 'WARNING: Users without group assignment', unassigned.map(function (p) { return esc(p.name || p.username); }).join(', '), 'Update config or assign in Windchill UI');
      }
      html += endSection();

      // === STEP 4: Add Groups to OOTB Team Template Roles ===
      html += beginSection('s4', 4, 'Add Groups to OOTB Team Template Roles', 'Populate the existing Site-level team templates with your groups', 'manual');
      html += bp('Understanding Team Templates',
        '<p>Windchill ships with <strong>4 out-of-the-box team templates</strong> at the Site level. They are already bound to change objects through OIRs and already contain the correct role definitions:</p>' +
        '<p style="font-size:12px;color:#94a3b8;padding:4px 0 8px;">Problem Report Team &bull; Change Request Team &bull; Change Notice Team &bull; Change Activity Team</p>' +
        '<p>However, these templates have <strong>no participants assigned to the roles</strong> by default. You need to open each template and add your groups to the appropriate roles.</p>' +
        '<p>You do <strong>not</strong> need to create new team templates. Just edit the existing ones.</p>'
      );

      var ttItems = [
        ['tt_pr', 'Edit: Problem Report Team', 'Open this OOTB template and assign groups to its roles:', [['Change Admin I', 'change_admin_1'], ['Problem Report Author', 'pr_author']]],
        ['tt_cr', 'Edit: Change Request Team', 'Open this OOTB template and assign groups to its roles:', [['Change Admin I', 'change_admin_1'], ['Change Admin II', 'change_admin_2'], ['Change Review Board', 'change_review_board'], ['Change Request Author', 'cr_author']]],
        ['tt_cn', 'Edit: Change Notice Team', 'Open this OOTB template and assign groups to its roles:', [['Change Admin II', 'change_admin_2'], ['Change Admin III', 'change_admin_3'], ['Change Implementation', 'change_impl']]],
        ['tt_ca', 'Edit: Change Activity Team', 'Open this OOTB template and assign groups to its roles:', [['Assignee', 'assignee'], ['Reviewer', 'reviewer']]],
      ];
      ttItems.forEach(function (tt) {
        var roleDetail = tt[2] + ' ' + tt[3].map(function (r) {
          return r[0] + ' &larr; ' + (roleGroups(r[1]).join(', ') || '(none)');
        }).join(' | ');
        var ppl = [];
        tt[3].forEach(function (r) { ppl = ppl.concat(roleMembers(r[1])); });
        html += clItem(tt[0], tt[1], roleDetail, 'Site &rarr; Templates &rarr; Team Templates &rarr; ' + tt[1].replace('Edit: ', ''), ppl);
      });
      html += endSection();

      // === STEP 5: Context Teams ===
      html += beginSection('s5', 5, 'Configure Context Teams (per Product/Library)', 'PREFERRED: Override team template assignments at each Product/Library', 'manual');
      html += bp('Best Practice: Context Teams vs. Custom Team Templates',
        '<p>After populating the OOTB team templates (Step 4), you can further customize participant assignments per Product or Library using <strong>context teams</strong>.</p>' +
        '<div class="bp-comparison">' +
          '<div class="bp-option recommended">' +
            '<h4>Context Teams <span class="bp-tag preferred">PTC Preferred</span></h4>' +
            '<ul>' +
              '<li>Override template assignments at each Product/Library</li>' +
              '<li>Easier to implement and maintain</li>' +
              '<li>Different Products can have different groups in same role</li>' +
              '<li>Limitation: shared roles use same group across workflows within a Product</li>' +
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
      ctxRoles.forEach(function (r) {
        var grps = roleGroups(r[3]).join(', ') || '(none assigned)';
        html += clItem(r[0], 'Assign group(s) to ' + r[1], r[2] + ' Group: ' + grps, '[Product/Library] &rarr; Team &rarr; Edit Team &rarr; ' + r[1], roleMembers(r[3]));
      });

      // Advanced: Override team templates at org level
      html += '<div class="cl-advanced">' +
        '<div class="cl-advanced-header"><span class="bp-arrow">&#9654;</span> Alternative: Create Org-Level Team Template Overrides (only if needed)</div>' +
        '<div class="cl-advanced-body">';
      html += bp('When would you create org-level overrides?',
        '<p>Only when <strong>the same role name needs different groups in different workflows</strong>. The most common case: Change Admin II appears in both the Change Request Team and Change Notice Team.</p>' +
        '<p>With context teams, Change Admin II is always the same group. If your process requires different people for CR vs CN management, create org-level templates with the exact same names as the Site-level ones.</p>'
      );
      var overrides = [
        ['tt_ov_pr', 'Create org override: Problem Report Team', 'Create at ' + org + ' org level with exact name "Problem Report Team". Add roles: Change Admin I, PR Author. Assign groups.'],
        ['tt_ov_cr', 'Create org override: Change Request Team', 'Exact name "Change Request Team". Roles: Change Admin I, Change Admin II, CRB, CR Author.'],
        ['tt_ov_cn', 'Create org override: Change Notice Team', 'Exact name "Change Notice Team". Here you can assign a DIFFERENT group to Change Admin II.'],
        ['tt_ov_ca', 'Create org override: Change Activity Team', 'Exact name "Change Activity Team". Roles: Assignee, Reviewer.'],
      ];
      overrides.forEach(function (ov) {
        html += clItem(ov[0], ov[1], ov[2], org + ' &rarr; Templates &rarr; Team Templates &rarr; New Team Template');
      });
      html += '</div></div>';
      html += endSection();

      // === STEP 6: Automated Deployment ===
      html += beginSection('s6', 6, 'Run Automated Deployment', 'Loads OIR, business rules, and preferences', 'auto');
      html += bp('What does deploy_all.bat actually do?',
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
      deployItems.forEach(function (d) {
        html += clItem(d[0], d[1], d[2], d[3], null, true);
      });
      html += endSection();

      // === STEP 7: Association Rules ===
      html += beginSection('s7', 7, 'Configure Association Rules', 'Disable OOB rules and create yours', 'manual');
      html += bp('Best Practice: Why disable the out-of-the-box rules?',
        '<div class="bp-quote"><p>In most cases, PTC recommends customers to disable the out-of-the-box rules and define the rules they want for their change process.</p>' +
        '<div class="bp-source">&mdash; PTC Windchill Change Implementation Training Guide</div></div>' +
        '<p>Association rules control which change objects can be linked and their cardinality. Starting clean prevents unexpected associations.</p>'
      );
      html += clItem('assoc_disable', 'Disable out-of-the-box rules', 'Uncheck Enabled for each OOB rule.', org + ' &rarr; Utilities &rarr; Business Rules &rarr; Change Association Rules');
      var ac = config.associations || {};
      if (ac.pr_to_cr && ac.pr_to_cr.enabled) { html += clItem('assoc_pr_cr', 'Create: Problem Report &rarr; Change Request', 'Type: Change Process, Cardinality: ' + (ac.pr_to_cr.cardinality || 'many:1'), org + ' &rarr; Utilities &rarr; Business Rules &rarr; New Change Association Rule'); }
      if (ac.cr_to_cn && ac.cr_to_cn.enabled) { html += clItem('assoc_cr_cn', 'Create: Change Request &rarr; Change Notice', 'Type: Change Process, Cardinality: ' + (ac.cr_to_cn.cardinality || 'many:1'), org + ' &rarr; Utilities &rarr; Business Rules &rarr; New Change Association Rule'); }
      if (ac.cn_to_task && ac.cn_to_task.enabled) { html += clItem('assoc_cn_task', 'Create: Change Notice &rarr; Change Activity', 'Type: Change Process, Cardinality: ' + (ac.cn_to_task.cardinality || '1:many'), org + ' &rarr; Utilities &rarr; Business Rules &rarr; New Change Association Rule'); }
      if (ac.pr_to_cn && ac.pr_to_cn.enabled) { html += clItem('assoc_pr_cn', 'Create: Problem Report &rarr; Change Notice (non-standard)', 'Type: Change Process, Cardinality: ' + (ac.pr_to_cn.cardinality || 'many:1'), org + ' &rarr; Utilities &rarr; Business Rules &rarr; New Change Association Rule'); }
      html += endSection();

      // === STEP 8: Access Control ===
      html += beginSection('s8', 8, 'Verify Access Control Policies', 'Ensure lifecycle states have correct permissions per role', 'manual');
      html += bp('What do access control policies affect?',
        '<p>Access control policies determine who can read, modify, or delete objects at each lifecycle state. Pay attention to Change Admin roles having modify access where they act.</p>' +
        '<p>The OOTB policies are generally reasonable, but verify they align with your process.</p>'
      );
      var acpItems = [
        ['acp_pr', 'Review: Problem Report Life Cycle', 'States: Open, Under Review, Resolved, Canceled. Check Change Admin I and PR Author permissions.'],
        ['acp_cr', 'Review: Change Request Life Cycle', 'States: Open, Under Review, Approved, Rejected, Implementation, Resolved, Canceled.'],
        ['acp_cn', 'Review: Change Notice Life Cycle', 'Check Change Admin II/III and Change Implementation permissions.'],
      ];
      acpItems.forEach(function (a) {
        html += clItem(a[0], a[1], a[2], org + ' &rarr; Utilities &rarr; Policy Administration &rarr; Access Control');
      });
      html += endSection();

      // === STEP 9: End-to-End Test ===
      html += beginSection('s9', 9, 'End-to-End Test', 'Verify the complete change process works', 'manual');
      html += bp('How to approach testing',
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
      testItems.forEach(function (t) {
        html += clItem(t[0], t[1], t[2], t[3]);
      });
      html += endSection();

      // === Compute progress ===
      var allIds = [];
      var totalChecked = 0;
      sectionOrder.forEach(function (sec) {
        var ids = sections[sec.key] || [];
        allIds = allIds.concat(ids);
      });
      allIds.forEach(function (id) { if (checklistState[id]) totalChecked++; });
      var totalCount = allIds.length;
      var pct = totalCount > 0 ? Math.round(totalChecked / totalCount * 100) : 0;

      var progressHtml = '<div class="cl-progress"><div class="cl-progress-bar"><div class="cl-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="cl-progress-text">' + totalChecked + '/' + totalCount + '</div></div>';

      document.getElementById("main").innerHTML =
        '<h1 class="sec-title">Post-Deployment Checklist</h1>' +
        '<p class="sec-desc">Click a section header to expand it. Click items to mark complete. Blue panels contain best-practice guidance.</p>' +
        progressHtml + html + navButtons();

      // Inject per-section counts into the rendered DOM
      sectionOrder.forEach(function (sec) {
        var ids = sections[sec.key] || [];
        var done = 0;
        ids.forEach(function (id) { if (checklistState[id]) done++; });
        var el = document.querySelector('[data-count="' + sec.key + '"]');
        if (el) {
          el.textContent = done + '/' + ids.length;
          if (done === ids.length && ids.length > 0) el.classList.add('complete');
        }
      });

      saveToStorage();
    } catch (err) {
      document.getElementById("main").innerHTML =
        '<h1 style="color:#ef4444;">Checklist Error</h1>' +
        '<pre style="color:#fca5a5;white-space:pre-wrap;">' + err.message + '\n\n' + err.stack + '</pre>' +
        navButtons();
    }
  }

  function toggleSection(key) {
    openSections[key] = !openSections[key];
    saveToStorage();
    // Toggle without full re-render for snappier feel
    var el = document.querySelector('[data-section="' + key + '"]');
    if (el) el.classList.toggle('open');
  }

  function toggleCheck(id) {
    checklistState[id] = !checklistState[id];
    saveToStorage();
    renderChecklist();
  }

  // ============================================================
  // Helpers
  // ============================================================
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toggleRow(name, desc, isOn, onclick) {
    return '<div class="toggle-row">' +
      '<div class="toggle-info">' +
        '<div class="name">' + name + '</div>' +
        '<div class="desc">' + desc + '</div>' +
      '</div>' +
      '<div class="toggle-ctrl">' +
        '<span class="toggle-val ' + (isOn ? 'on' : 'off') + '">' + (isOn ? 'Yes' : 'No') + '</span>' +
        '<button class="switch ' + (isOn ? 'on' : '') + '" onclick="' + onclick + '">' +
          '<span class="dot"></span>' +
        '</button>' +
      '</div></div>';
  }

  // ============================================================
  // Event delegation for expanders
  // ============================================================
  document.addEventListener('click', function (e) {
    var header = e.target.closest('.bp-header, .cl-advanced-header');
    if (header) {
      header.closest('.bp-expander, .cl-advanced').classList.toggle('open');
      return;
    }
  });

  // ============================================================
  // Export public API
  // ============================================================
  WCAI.app = {
    init: init,
    goToStep: goToStep,
    saveAndNext: saveAndNext,
    // Company
    setCompany: setCompany,
    toggleCompany: toggleCompany,
    // Groups
    addGroup: addGroup,
    removeGroup: removeGroup,
    setGroup: setGroup,
    // People
    addPerson: addPerson,
    removePerson: removePerson,
    setPerson: setPerson,
    updatePersonId: updatePersonId,
    // Roles
    toggleRole: toggleRole,
    // Preferences
    togglePref: togglePref,
    // Associations
    toggleAssoc: toggleAssoc,
    // Generate
    doGenerate: doGenerate,
    // Download
    downloadYaml: downloadYaml,
    downloadSingleFile: downloadSingleFile,
    downloadZip: downloadZip,
    uploadYaml: uploadYaml,
    // Checklist
    toggleSection: toggleSection,
    toggleCheck: toggleCheck,
    // Reset
    resetAll: resetAll,
  };
})();
