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

  // Teams & Participants wizard state
  var currentWizard = "teams"; // "teams" | "change"
  var teamsConfig = null;
  var teamsStep = 0;
  var teamsChecklistState = {};
  var teamsOpenSections = {};

  var STORAGE_KEY_CONFIG = "wcai_config";
  var STORAGE_KEY_CHECKLIST = "wcai_checklist";
  var STORAGE_KEY_SECTIONS = "wcai_open_sections";
  var STORAGE_KEY_STEP = "wcai_step";
  var STORAGE_KEY_WIZARD = "wcai_wizard";
  var STORAGE_KEY_TEAMS_CONFIG = "wcai_teams_config";
  var STORAGE_KEY_TEAMS_CHECKLIST = "wcai_teams_checklist";
  var STORAGE_KEY_TEAMS_SECTIONS = "wcai_teams_sections";
  var STORAGE_KEY_TEAMS_STEP = "wcai_teams_step";

  var STEPS = [
    { id: "company", label: "Company & Org" },
    { id: "groups", label: "Groups" },
    { id: "people", label: "People" },
    { id: "roles", label: "Role Mapping" },
    { id: "prefs", label: "Preferences" },
    { id: "assoc", label: "Associations" },
    { id: "validate", label: "Validate" },
    { id: "generate", label: "Generate" },
    { id: "checklist", label: "Deployment Checklist" },
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
      localStorage.setItem(STORAGE_KEY_WIZARD, currentWizard);
      localStorage.setItem(STORAGE_KEY_TEAMS_CONFIG, JSON.stringify(teamsConfig));
      localStorage.setItem(STORAGE_KEY_TEAMS_CHECKLIST, JSON.stringify(teamsChecklistState));
      localStorage.setItem(STORAGE_KEY_TEAMS_SECTIONS, JSON.stringify(teamsOpenSections));
      localStorage.setItem(STORAGE_KEY_TEAMS_STEP, String(teamsStep));
    } catch (e) { /* quota exceeded or unavailable */ }
  }

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (raw) {
        config = JSON.parse(raw);
        var rawTeams = localStorage.getItem(STORAGE_KEY_TEAMS_CONFIG);
        if (rawTeams) teamsConfig = JSON.parse(rawTeams);
        else teamsConfig = WCAI.teamsModel.getDefaultTeamsConfig();
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
    try {
      var rawTC = localStorage.getItem(STORAGE_KEY_TEAMS_CHECKLIST);
      if (rawTC) teamsChecklistState = JSON.parse(rawTC);
    } catch (e) { /* ignore */ }
    try {
      var rawTS = localStorage.getItem(STORAGE_KEY_TEAMS_SECTIONS);
      if (rawTS) teamsOpenSections = JSON.parse(rawTS);
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

  function loadWizardFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_WIZARD);
      if (raw === 'teams' || raw === 'change') currentWizard = raw;
    } catch (e) { /* ignore */ }
  }

  function loadTeamsStepFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_TEAMS_STEP);
      if (raw) {
        var step = parseInt(raw, 10);
        var ta = WCAI.teamsApp;
        if (!isNaN(step) && ta && step >= 0 && step < ta.STEPS_TEAMS.length) return step;
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
      // First visit -- show welcome immediately while we try to load a config
      config = loader.getDefaultConfig();
      teamsConfig = WCAI.teamsModel.getDefaultTeamsConfig();
      loadChecklistFromStorage();
      renderTabs();
      renderNav();
      renderWelcome();

      // Try to load a saved config in the background (only works on http/https, not file://)
      if (location.protocol !== 'file:') {
        fetch('configs/company_config.yaml')
          .then(function (res) {
            if (!res.ok) throw new Error('not found');
            return res.text();
          })
          .then(function (yamlStr) {
            config = loader.parseYaml(yamlStr);
            saveToStorage();
          })
          .catch(function () { /* no saved config -- keep blank default */ });
      }
      return;
    }
    loadChecklistFromStorage();
    loadWizardFromStorage();
    currentStep = loadStepFromStorage();
    teamsStep = loadTeamsStepFromStorage();

    renderTabs();
    renderNav();
    if (currentWizard === 'teams') {
      WCAI.teamsApp.render(teamsStep);
    } else {
      var changeRenderers = [renderCompany, renderGroups, renderPeople, renderRoles, renderPrefs, renderAssoc, renderValidate, renderGenerate, renderChecklist];
      changeRenderers[currentStep]();
    }
  }

  function renderWelcome() {
    var html =
      '<div style="max-width:660px;margin:40px auto 0;text-align:center;">' +
        '<h1 style="font-size:28px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Welcome to WCAI</h1>' +
        '<p style="font-size:14px;color:#94a3b8;margin-bottom:32px;line-height:1.7;">Windchill Config AI helps you set up Teams & Participants and configure Change Management for PTC Windchill -- interactively, step by step.</p>' +
        '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:32px;">' +
          '<button class="btn btn-primary" onclick="WCAI.app.loadExample()" style="padding:12px 24px;font-size:14px;">Load Example (Acme)</button>' +
          '<label style="display:inline-block;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;background:#334155;color:#e2e8f0;transition:all 0.15s;">' +
            'Upload Your YAML' +
            '<input type="file" accept=".yaml,.yml" style="display:none;" onchange="if(this.files[0]) WCAI.app.uploadYaml(this.files[0])">' +
          '</label>' +
          '<button class="btn btn-secondary" onclick="WCAI.app.goToStep(0)" style="padding:12px 24px;font-size:14px;">Start from Scratch</button>' +
        '</div>' +
        // Two wizard entry point cards
        '<div style="text-align:left;display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">' +
          '<div style="padding:20px;background:#1e293b;border:1px solid rgba(34,197,94,0.3);border-radius:8px;cursor:pointer;" onclick="WCAI.app.switchWizard(\'teams\')">' +
            '<div style="font-size:15px;font-weight:700;color:#22c55e;margin-bottom:6px;">1. Teams & Participants</div>' +
            '<div style="font-size:12px;color:#94a3b8;line-height:1.6;">Set up the foundation: organization, users, groups, licenses, context teams, and access control. <strong>Do this first.</strong></div>' +
            '<div style="margin-top:10px;font-size:11px;color:#64748b;">7 steps -- Org, Directory, Users, Groups, Licenses, Teams, Checklist</div>' +
          '</div>' +
          '<div style="padding:20px;background:#1e293b;border:1px solid #334155;border-radius:8px;cursor:pointer;" onclick="WCAI.app.switchWizard(\'change\')">' +
            '<div style="font-size:15px;font-weight:700;color:#60a5fa;margin-bottom:6px;">2. Change Management</div>' +
            '<div style="font-size:12px;color:#94a3b8;line-height:1.6;">Configure the change process: OIR, business rules, preferences, associations, and deployment artifacts.</div>' +
            '<div style="margin-top:10px;font-size:11px;color:#64748b;">9 steps -- Company, Groups, People, Roles, Preferences, Associations, Validate, Generate, Checklist</div>' +
          '</div>' +
        '</div>' +
        // Feature cards
        '<div style="text-align:left;display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:32px;">' +
          '<div style="padding:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;">' +
            '<div style="font-size:13px;font-weight:700;color:#22c55e;margin-bottom:4px;">Two Guided Wizards</div>' +
            '<div style="font-size:12px;color:#94a3b8;">Teams & Participants (7 steps) and Change Management (9 steps) with best-practice guidance throughout.</div>' +
          '</div>' +
          '<div style="padding:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;">' +
            '<div style="font-size:13px;font-weight:700;color:#22c55e;margin-bottom:4px;">Deployment Artifacts</div>' +
            '<div style="font-size:12px;color:#94a3b8;">Generates OIR XML, business rules, preference scripts, and deployment batch files ready for your Windchill server.</div>' +
          '</div>' +
          '<div style="padding:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;">' +
            '<div style="font-size:13px;font-weight:700;color:#22c55e;margin-bottom:4px;">Interactive Checklists</div>' +
            '<div style="font-size:12px;color:#94a3b8;">Post-deployment checklists with exact Windchill navigation paths and PTC best-practice guidance.</div>' +
          '</div>' +
          '<div style="padding:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;">' +
            '<div style="font-size:13px;font-weight:700;color:#22c55e;margin-bottom:4px;">No Server Required</div>' +
            '<div style="font-size:12px;color:#94a3b8;">Runs entirely in your browser. Your config is saved locally and never leaves your machine.</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.getElementById("main").innerHTML = html;
  }

  // ============================================================
  // Navigation
  // ============================================================
  function renderNav() {
    var nav = document.getElementById("nav");
    var steps = currentWizard === 'teams' ? WCAI.teamsApp.STEPS_TEAMS : STEPS;
    var activeStep = currentWizard === 'teams' ? teamsStep : currentStep;
    var html = "";
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      html += '<li id="nav-' + i + '" onclick="WCAI.app.goToStep(' + i + ')" class="' + (i === activeStep ? 'active' : '') + '">' +
        '<span class="num">' + (i + 1) + '</span> ' + s.label + '</li>';
    }
    nav.innerHTML = html;

    var pct = Math.round((activeStep / (steps.length - 1)) * 100);
    document.getElementById("progress-fill").style.width = pct + "%";
  }

  function renderTabs() {
    var tabs = document.getElementById('wizard-tabs');
    if (!tabs) return;
    var buttons = tabs.getElementsByClassName('sb-tab');
    for (var i = 0; i < buttons.length; i++) {
      var wiz = i === 0 ? 'teams' : 'change';
      if (wiz === currentWizard) buttons[i].classList.add('active');
      else buttons[i].classList.remove('active');
    }
  }

  function switchWizard(wizard) {
    currentWizard = wizard;
    saveToStorage();
    renderTabs();
    renderNav();
    if (wizard === 'teams') {
      WCAI.teamsApp.render(teamsStep);
    } else {
      var changeRenderers = [renderCompany, renderGroups, renderPeople, renderRoles, renderPrefs, renderAssoc, renderValidate, renderGenerate, renderChecklist];
      changeRenderers[currentStep]();
    }
  }

  function goToStep(i) {
    if (currentWizard === 'teams') {
      teamsStep = i;
      saveToStorage();
      renderNav();
      WCAI.teamsApp.render(i);
    } else {
      currentStep = i;
      saveToStorage();
      renderNav();
      var changeRenderers = [renderCompany, renderGroups, renderPeople, renderRoles, renderPrefs, renderAssoc, renderValidate, renderGenerate, renderChecklist];
      changeRenderers[i]();
    }
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
    if (currentWizard === 'teams') {
      goToStep(teamsStep + 1);
    } else {
      goToStep(currentStep + 1);
    }
  }

  // ============================================================
  // Load Example Config
  // ============================================================
  var EXAMPLE_CONFIG = {
    company: {
      name: "Acme Engineering", org: "AcmeOrg", site: "acme-wc-prod",
      context_level: "organization", lock_preferences: true, use_flexible_change: true
    },
    groups: [
      { id: "eng", name: "Engineering", description: "Product engineering and design team" },
      { id: "mfg", name: "Manufacturing", description: "Manufacturing engineering and production" },
      { id: "qa", name: "Quality Assurance", description: "Quality and compliance team" },
      { id: "mgmt", name: "Management", description: "Engineering and program management" }
    ],
    people: [
      { id: "jsmith", name: "Jane Smith", username: "jsmith", email: "jsmith@acme.com", group: "eng" },
      { id: "bwilson", name: "Bob Wilson", username: "bwilson", email: "bwilson@acme.com", group: "eng" },
      { id: "mchen", name: "Maria Chen", username: "mchen", email: "mchen@acme.com", group: "mfg" },
      { id: "dkim", name: "David Kim", username: "dkim", email: "dkim@acme.com", group: "qa" },
      { id: "tpatel", name: "Tanya Patel", username: "tpatel", email: "tpatel@acme.com", group: "mgmt" },
      { id: "rjones", name: "Robert Jones", username: "rjones", email: "rjones@acme.com", group: "mgmt" }
    ],
    roles: {
      change_admin_1: ["eng"], change_admin_2: ["mgmt"], change_admin_3: ["mgmt"],
      change_impl: ["eng", "mfg"], change_review_board: ["mgmt", "qa"],
      pr_author: ["eng", "mfg", "qa"], cr_author: ["eng", "mgmt"],
      assignee: ["eng", "mfg"], reviewer: ["qa"]
    },
    preferences: {
      cn_without_cr: "No", auto_cn_creation: "No", sequenced_plan: "Yes",
      cr_to_cn_cardinality: "No", cr_to_pr_cardinality: "No",
      optional_review: "No", info_propagation: "Yes", affected_end_items: "Yes"
    },
    associations: {
      pr_to_cr: { enabled: true, cardinality: "many:1" },
      cr_to_cn: { enabled: true, cardinality: "many:1" },
      cn_to_task: { enabled: true, cardinality: "1:many" },
      pr_to_cn: { enabled: false, cardinality: "many:1" }
    },
    business_rules: {
      rule_set_name: "ACME_PRE_RELEASE",
      rules: [
        { key: "ACME_CHECKOUT_RULE", selector: "CHECKOUT_RULE", description: "Fails if changeable is checked out", block_number: 1 },
        { key: "ACME_RELEASE_TARGET_RULE", selector: "RELEASE_TARGET_RULE", description: "Validates change transition from source to destination state", block_number: 10 }
      ]
    }
  };

  var TEAMS_EXAMPLE_CONFIG = {
    org: {
      name: "AcmeOrg",
      domain: "acme.com",
      admins: ["tpatel"],
    },
    directory: {
      type: "windchill",
      auth_method: "windchill",
      notes: "",
    },
    licenses: {
      jsmith: "ptc_author",
      bwilson: "ptc_author",
      mchen: "ptc_author",
      dkim: "ptc_pdmlink",
      tpatel: "ptc_author",
      rjones: "ptc_pdmlink",
    },
    context_roles: {
      guest: [],
      members: ["eng", "mfg", "qa", "mgmt"],
      product_manager: ["mgmt"],
      change_admin_1: ["eng"],
      change_admin_2: ["mgmt"],
      change_admin_3: ["mgmt"],
      change_review_board: ["mgmt", "qa"],
      promotion_approvers: ["mgmt"],
      promotion_reviewers: ["qa"],
    },
  };

  function loadExample() {
    var prefix = prompt(
      'Enter a short prefix (e.g. XPR) to make this example unique.\n' +
      'This lets you load the example multiple times with different names.\n\n' +
      'Leave blank for no prefix.',
      ''
    );
    if (prefix === null) return; // user cancelled
    prefix = prefix.trim().toUpperCase();

    // Deep-copy both examples so each load is independent
    config = JSON.parse(JSON.stringify(EXAMPLE_CONFIG));
    config = loader.normalize(config);
    teamsConfig = JSON.parse(JSON.stringify(TEAMS_EXAMPLE_CONFIG));

    if (prefix) {
      applyPrefix(prefix);
      applyTeamsPrefix(prefix);
    }
    saveToStorage();
    // Auto-download the prefixed YAML so the user has a copy
    if (prefix) {
      var filename = prefix.toLowerCase() + '_acme_config.yaml';
      downloadFile(filename, loader.toYaml(config), 'text/yaml');
    }
    goToStep(0);
  }

  function applyPrefix(pfx) {
    var lo = pfx.toLowerCase();

    // Company
    config.company.name = pfx + ' ' + config.company.name;
    config.company.org = pfx + config.company.org;
    config.company.site = lo + '-' + config.company.site;

    // Groups -- prefix IDs and names, build old->new ID map
    var groupMap = {};
    (config.groups || []).forEach(function (g) {
      var newId = lo + '_' + g.id;
      groupMap[g.id] = newId;
      g.id = newId;
      g.name = pfx + ' ' + g.name;
    });

    // People -- update group references
    (config.people || []).forEach(function (p) {
      if (p.group && groupMap[p.group]) {
        p.group = groupMap[p.group];
      }
    });

    // Roles -- update group ID references
    var newRoles = {};
    for (var roleId in config.roles) {
      newRoles[roleId] = (config.roles[roleId] || []).map(function (gid) {
        return groupMap[gid] || gid;
      });
    }
    config.roles = newRoles;

    // Business rules
    if (config.business_rules) {
      if (config.business_rules.rule_set_name) {
        config.business_rules.rule_set_name = pfx + '_' + config.business_rules.rule_set_name;
      }
      (config.business_rules.rules || []).forEach(function (r) {
        if (r.key) r.key = pfx + '_' + r.key;
      });
    }
  }

  function applyTeamsPrefix(pfx) {
    var lo = pfx.toLowerCase();

    // Org
    teamsConfig.org.name = pfx + teamsConfig.org.name;

    // Build group mapping from original example
    var groupMap = {};
    for (var i = 0; i < EXAMPLE_CONFIG.groups.length; i++) {
      var g = EXAMPLE_CONFIG.groups[i];
      groupMap[g.id] = lo + '_' + g.id;
    }

    // Context roles -- remap group IDs
    var newCtxRoles = {};
    for (var rk in teamsConfig.context_roles) {
      var arr = teamsConfig.context_roles[rk] || [];
      var newArr = [];
      for (var j = 0; j < arr.length; j++) {
        newArr.push(groupMap[arr[j]] || arr[j]);
      }
      newCtxRoles[rk] = newArr;
    }
    teamsConfig.context_roles = newCtxRoles;
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
    if (!confirm("Reset all data? This clears your config, checklist, and all progress for both wizards.")) return;
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    localStorage.removeItem(STORAGE_KEY_CHECKLIST);
    localStorage.removeItem(STORAGE_KEY_STEP);
    localStorage.removeItem(STORAGE_KEY_SECTIONS);
    localStorage.removeItem(STORAGE_KEY_WIZARD);
    localStorage.removeItem(STORAGE_KEY_TEAMS_CONFIG);
    localStorage.removeItem(STORAGE_KEY_TEAMS_CHECKLIST);
    localStorage.removeItem(STORAGE_KEY_TEAMS_SECTIONS);
    localStorage.removeItem(STORAGE_KEY_TEAMS_STEP);
    config = loader.getDefaultConfig();
    teamsConfig = WCAI.teamsModel.getDefaultTeamsConfig();
    checklistState = {};
    openSections = {};
    teamsChecklistState = {};
    teamsOpenSections = {};
    generatedFiles = null;
    currentWizard = "teams";
    teamsStep = 0;
    currentStep = 0;
    renderTabs();
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
  // File descriptions for the generate step
  var FILE_INFO = {
    'oir_config.xml': {
      title: 'Object Initialization Rules (OIR)',
      desc: 'Binds each of the 4 change object types (Problem Report, Change Request, Change Notice, Change Activity) to their lifecycle template, workflow, and team template. When a user creates a new change object in Windchill, the OIR determines which lifecycle and workflow it follows.',
      how: 'Loaded via <code>windchill wt.load.LoadFromFile</code> into your OrgContainer. This is an XML file that Windchill\'s LoadFromFile utility reads directly.',
      auto: true,
    },
    'business_rules.xml': {
      title: 'Business Rules (Pre-Release Validation)',
      desc: 'Defines the CHANGEABLE_PRE_RELEASE rule set with two rules: (1) a checkout rule that prevents releasing objects that are checked out, and (2) a release target rule that validates the state transition is valid. These rules run automatically when someone attempts to release a change notice.',
      how: 'Loaded via <code>windchill wt.load.LoadFromFile</code>. Creates the rule set, individual rules, and links that bind rules to the set.',
      auto: true,
    },
    'team_config.txt': {
      title: 'Team Template & Context Team Reference',
      desc: 'A human-readable reference document (not machine-loaded) that maps your groups to roles across all 4 team templates. Use this as a guide when manually populating team templates and context teams in the Windchill UI. It shows exactly which groups go into which roles.',
      how: 'Not deployed automatically. Open this file and follow it step-by-step when editing team templates in the Windchill UI (Site > Templates > Team Templates).',
      auto: false,
    },
    'deploy_preferences.bat': {
      title: 'Change Management Preferences Script',
      desc: 'Sets all 8 change management preferences (CN without CR, auto CN creation, sequenced plan, cardinalities, optional review, info propagation, affected end items) at your configured context level. Each preference is set via the Windchill PrefCmd utility and optionally locked to prevent lower-context overrides.',
      how: 'Run from a Windchill shell. Called automatically by <code>deploy_all.bat</code>, or run standalone: <code>deploy_preferences.bat</code>. Each preference maps to a specific Windchill preference node and key.',
      auto: true,
    },
    'association_rules_spec.txt': {
      title: 'Association Rules Reference',
      desc: 'Documents which change object associations your process uses (PR->CR, CR->CN, CN->Activity, and optionally PR->CN) with their cardinality and enabled/disabled status. Association rules control which change objects can be linked together -- for example, whether a Problem Report can be associated with a Change Request.',
      how: 'Not deployed automatically. Association rules must be configured manually in the Windchill UI: navigate to your Org > Utilities > Business Rules > Change Association Rules. Disable all OOB rules first, then create only the ones listed in this file.',
      auto: false,
    },
    'deploy_all.bat': {
      title: 'Master Deployment Orchestrator',
      desc: 'Runs all automated deployments in sequence across 5 phases: (1) load OIR XML, (2) load business rules XML, (3) run preference commands, (4) remind about manual association rules, (5) validate OIR bindings. Supports <code>--dry-run</code> to preview without making changes. Logs all output to a timestamped file.',
      how: 'Copy all generated files to the Windchill server. Open a Windchill shell, cd to the folder, and run: <code>deploy_all.bat --dry-run</code> first, then <code>deploy_all.bat</code> for real. Requires Site/Org Admin privileges.',
      auto: true,
    },
  };

  function renderGenerate() {
    var org = esc(config.company.org || 'YourOrg');

    var html = '<h1 class="sec-title">Generate Deployment Artifacts</h1>' +
      '<p class="sec-desc">Generate all Windchill deployment files from your config. Files are downloaded to your browser -- no server needed.</p>';

    // Explain what gets generated before the button
    html += '<div style="margin-bottom:24px;">';
    html += '<div class="toggle-row" style="margin-bottom:12px;border-color:rgba(34,197,94,0.2);">' +
      '<div class="toggle-info">' +
        '<div class="name" style="color:#22c55e;">Automated (loaded via Windchill CLI)</div>' +
        '<div class="desc">These files are loaded into Windchill using command-line tools from a Windchill shell. The deploy_all.bat script handles all three.</div>' +
      '</div></div>';

    html += '<div style="padding:0 8px;font-size:12px;color:#94a3b8;margin-bottom:16px;">' +
      '<p style="margin-bottom:6px;"><strong style="color:#e2e8f0;">oir_config.xml</strong> -- ' + FILE_INFO['oir_config.xml'].desc + '</p>' +
      '<p style="margin-bottom:6px;"><strong style="color:#e2e8f0;">business_rules.xml</strong> -- ' + FILE_INFO['business_rules.xml'].desc + '</p>' +
      '<p style="margin-bottom:6px;"><strong style="color:#e2e8f0;">deploy_preferences.bat</strong> -- ' + FILE_INFO['deploy_preferences.bat'].desc + '</p>' +
      '<p style="margin-bottom:6px;"><strong style="color:#e2e8f0;">deploy_all.bat</strong> -- ' + FILE_INFO['deploy_all.bat'].desc + '</p>' +
    '</div>';

    html += '<div class="toggle-row" style="margin-bottom:12px;border-color:rgba(245,158,11,0.2);">' +
      '<div class="toggle-info">' +
        '<div class="name" style="color:#f59e0b;">Reference (manual steps in Windchill UI)</div>' +
        '<div class="desc">These are human-readable guides for steps that cannot be automated. Follow them when configuring teams and association rules in the Windchill web interface.</div>' +
      '</div></div>';

    html += '<div style="padding:0 8px;font-size:12px;color:#94a3b8;margin-bottom:16px;">' +
      '<p style="margin-bottom:6px;"><strong style="color:#e2e8f0;">team_config.txt</strong> -- ' + FILE_INFO['team_config.txt'].desc + '</p>' +
      '<p style="margin-bottom:6px;"><strong style="color:#e2e8f0;">association_rules_spec.txt</strong> -- ' + FILE_INFO['association_rules_spec.txt'].desc + '</p>' +
    '</div>';
    html += '</div>';

    html += '<div style="text-align:center; padding: 20px 0 10px;">' +
      '<button class="btn btn-primary" onclick="WCAI.app.doGenerate()" style="padding:14px 32px;font-size:15px;">' +
        'Generate All Files' +
      '</button>' +
    '</div>' +
    navButtons();

    document.getElementById("main").innerHTML = html;
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
        var info = FILE_INFO[f.name];
        var autoTag = info && info.auto
          ? '<span class="cl-badge done" style="margin-left:0;margin-right:6px;">CLI</span>'
          : '<span class="cl-badge todo" style="margin-left:0;margin-right:6px;">Reference</span>';

        html += '<div class="card" style="margin-bottom:8px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
            '<div style="display:flex;align-items:center;">' +
              autoTag +
              '<span class="file-name">' + esc(f.name) + '</span>' +
            '</div>' +
            '<div class="file-actions">' +
              '<span class="file-size">' + f.content.length.toLocaleString() + ' bytes</span>' +
              '<button class="btn-download" onclick="WCAI.app.downloadSingleFile(' + i + ')">Download</button>' +
            '</div>' +
          '</div>';

        if (info) {
          html += '<div style="font-size:12px;color:#94a3b8;line-height:1.6;">' +
            '<p style="margin-bottom:4px;">' + info.desc + '</p>' +
            '<p style="color:#64748b;"><strong>How to use:</strong> ' + info.how + '</p>' +
          '</div>';
        }
        html += '</div>';
      }

      html += '</div>' +
        '<div class="success-box" style="margin-top:16px;">' +
          '<h3>Deployment Steps</h3>' +
          '<p>1. Download the ZIP and extract it on your Windchill server</p>' +
          '<p>2. Open a Windchill shell: <code>cd %WT_HOME% && bin\\adminTools\\windchill shell</code></p>' +
          '<p>3. Navigate to the extracted folder: <code>cd [path-to-files]</code></p>' +
          '<p>4. Preview first: <code>deploy_all.bat --dry-run</code></p>' +
          '<p>5. Deploy for real: <code>deploy_all.bat</code></p>' +
          '<p style="margin-top:8px;color:#64748b;">The .bat files only work inside a Windchill shell (not a regular command prompt). The Windchill shell sets up the Java classpath and environment needed by the <code>windchill</code> CLI commands.</p>' +
          '<p style="margin-top:10px">6. After deployment, open the <strong>Deployment Checklist</strong> for the manual steps (teams, association rules, access control, testing):</p>' +
        '</div>' +
        '<div style="text-align:center; margin-top:16px;">' +
          '<button class="btn btn-primary" onclick="WCAI.app.goToStep(' + (STEPS.length - 1) + ')" style="padding:12px 28px;">' +
            'Open Deployment Checklist ->' +
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

      // NOTE: Org admins, user accounts, and license verification are covered
      // in the Teams & Participants wizard checklist. Switch to that tab for those steps.

      // === STEP 2: Create Groups ===
      html += beginSection('s5', 2, 'Create Groups and Add Users', 'Create Windchill groups, add users. Groups are assigned to roles.', 'manual');
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

      // === STEP 6: Add Groups to OOTB Team Template Roles ===
      html += beginSection('s6', 3, 'Add Groups to OOTB Team Template Roles', 'Populate the existing Site-level team templates with your groups', 'manual');
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

      // === STEP 7: Context Teams ===
      html += beginSection('s7', 4, 'Configure Context Teams (per Product/Library)', 'PREFERRED: Override team template assignments at each Product/Library', 'manual');
      html += bp('Best Practice: Context Teams vs. Custom Team Templates',
        '<p>After populating the OOTB team templates (Step 3), you can further customize participant assignments per Product or Library using <strong>context teams</strong>.</p>' +
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
              '<li>If all Products use the same teams, Step 3 may be sufficient</li>' +
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

      // === STEP 8: Automated Deployment ===
      html += beginSection('s8', 5, 'Run Automated Deployment', 'Loads OIR, business rules, and preferences', 'auto');
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

      // === STEP 9: Association Rules ===
      html += beginSection('s9', 6, 'Configure Association Rules', 'Disable OOB rules and create yours', 'manual');
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

      // === STEP 10: Access Control ===
      html += beginSection('s10', 7, 'Verify Access Control Policies', 'Ensure lifecycle states have correct permissions per role', 'manual');
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

      // === STEP 11: End-to-End Test ===
      html += beginSection('s11', 8, 'End-to-End Test', 'Verify the complete change process works', 'manual');
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
  // Internal getters for cross-module access (used by teams-app.js)
  // ============================================================
  function _getConfig() { return config; }
  function _getTeamsConfig() { return teamsConfig; }
  function _getTeamsStep() { return teamsStep; }
  function _getTeamsChecklistState() { return teamsChecklistState; }
  function _getTeamsOpenSections() { return teamsOpenSections; }
  function _saveConfig() { saveToStorage(); }
  function _saveTeams() { saveToStorage(); }

  // ============================================================
  // Export public API
  // ============================================================
  WCAI.app = {
    init: init,
    goToStep: goToStep,
    saveAndNext: saveAndNext,
    switchWizard: switchWizard,
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
    // Example + Reset
    loadExample: loadExample,
    resetAll: resetAll,
    // Internal getters for teams module
    _getConfig: _getConfig,
    _getTeamsConfig: _getTeamsConfig,
    _getTeamsStep: _getTeamsStep,
    _getTeamsChecklistState: _getTeamsChecklistState,
    _getTeamsOpenSections: _getTeamsOpenSections,
    _saveConfig: _saveConfig,
    _saveTeams: _saveTeams,
  };
})();
