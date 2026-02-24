/**
 * WCAI -- Teams & Participants -- Wizard Steps & Checklist
 * =========================================================
 * 7-step wizard: Org, Directory, Users, Groups, Licenses, Teams, Validate/Checklist
 * Attached to window.WCAI.teamsApp.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};
  var tm = WCAI.teamsModel;
  var tv = WCAI.teamsValidators;

  var STEPS_TEAMS = [
    { id: "t_org", label: "Organization" },
    { id: "t_directory", label: "Directory & Auth" },
    { id: "t_users", label: "Users" },
    { id: "t_groups", label: "Groups" },
    { id: "t_licenses", label: "Licenses" },
    { id: "t_teams", label: "Teams & Roles" },
    { id: "t_checklist", label: "Validate & Checklist" },
  ];

  var renderers = [renderOrg, renderDirectory, renderUsers, renderGroups, renderLicenses, renderTeams, renderChecklist];

  function render(stepIndex) {
    renderers[stepIndex]();
  }

  // Helpers -- access shared state via app module
  function getConfig() { return WCAI.app._getConfig(); }
  function getTeamsConfig() { return WCAI.app._getTeamsConfig(); }

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

  function navButtons(backEnabled) {
    var step = WCAI.app._getTeamsStep();
    if (backEnabled === undefined) backEnabled = true;
    var isFirst = step === 0;
    var isLast = step === STEPS_TEAMS.length - 1;
    return '<div class="nav-btns">' +
      '<button class="btn btn-secondary" onclick="WCAI.app.goToStep(' + (step - 1) + ')" ' + (isFirst || !backEnabled ? 'disabled' : '') + '>Back</button>' +
      (!isLast ? '<button class="btn btn-primary" onclick="WCAI.app.saveAndNext()">Save & Continue</button>' : '') +
      '</div>';
  }

  // ============================================================
  // Step 1: Organization Setup
  // ============================================================
  function renderOrg() {
    var tc = getTeamsConfig();
    var config = getConfig();
    var org = tc.org || {};
    var people = config.people || [];

    var adminHtml = '';
    if (people.length > 0) {
      adminHtml = '<div class="chips" style="margin-top:8px;">';
      for (var i = 0; i < people.length; i++) {
        var p = people[i];
        var pid = p.id || p.username;
        var isAdmin = (org.admins || []).indexOf(pid) >= 0;
        adminHtml += '<button class="chip' + (isAdmin ? ' selected' : '') + '" onclick="WCAI.teamsApp.toggleAdmin(\'' + esc(pid) + '\')">' +
          (isAdmin ? '&#10003; ' : '') + esc(p.name || p.username) + '</button>';
      }
      adminHtml += '</div>';
    } else {
      adminHtml = '<p class="no-people" style="margin-top:8px;">Add users in Step 3 first, then return here to assign org admins.</p>';
    }

    var html =
      '<h1 class="sec-title">Organization Setup</h1>' +
      '<p class="sec-desc">Define your Windchill organization context. The organization is the top-level container for groups, teams, access control, and change management configuration.</p>' +
      '<div class="row">' +
        '<div class="field"><label>Organization Name *</label>' +
          '<input value="' + esc(org.name) + '" placeholder="e.g. AcmeOrg" oninput="WCAI.teamsApp.setOrg(\'name\',this.value)"></div>' +
        '<div class="field"><label>Organization Domain</label>' +
          '<input value="' + esc(org.domain) + '" placeholder="e.g. acme.com" oninput="WCAI.teamsApp.setOrg(\'domain\',this.value)"></div>' +
      '</div>' +
      '<div style="margin-top:20px;">' +
        '<h3 style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">Organization Administrators</h3>' +
        '<p style="font-size:12px;color:#64748b;margin-bottom:4px;">Select users who will serve as organization administrators. Org admins can create groups, configure association rules, and manage access control.</p>' +
        adminHtml +
      '</div>' +
      bp('Why do you need Organization Administrators?',
        '<p>Initially, <strong>no organization administrator is defined</strong> for a new org context. Without one, only Site Admins can perform org-level tasks.</p>' +
        '<p>Organization Administrators can:</p>' +
        '<ul style="margin:8px 0 8px 16px;font-size:12px;color:#cbd5e1;">' +
          '<li>Create and manage <strong>user-defined groups</strong></li>' +
          '<li>Configure <strong>change association rules</strong></li>' +
          '<li>Manage <strong>access control policies</strong></li>' +
          '<li>Control who can create Products and Libraries</li>' +
        '</ul>'
      ) +
      navButtons(false);
    document.getElementById("main").innerHTML = html;
  }

  function setOrg(key, value) {
    var tc = getTeamsConfig();
    tc.org[key] = value;
    WCAI.app._saveTeams();
  }

  function toggleAdmin(userId) {
    var tc = getTeamsConfig();
    if (!tc.org.admins) tc.org.admins = [];
    var idx = tc.org.admins.indexOf(userId);
    if (idx >= 0) tc.org.admins.splice(idx, 1);
    else tc.org.admins.push(userId);
    WCAI.app._saveTeams();
    renderOrg();
  }

  // ============================================================
  // Step 2: Directory & Authentication
  // ============================================================
  function renderDirectory() {
    var tc = getTeamsConfig();
    var dir = tc.directory || {};

    var html =
      '<h1 class="sec-title">Directory & Authentication</h1>' +
      '<p class="sec-desc">Configure how Windchill discovers and authenticates users. This determines whether users are managed locally or synced from an enterprise directory.</p>' +
      '<div class="field"><label>Directory Server Type</label>' +
        '<select onchange="WCAI.teamsApp.setDirectory(\'type\',this.value)">';
    for (var dk in tm.DIRECTORY_TYPES) {
      var dt = tm.DIRECTORY_TYPES[dk];
      html += '<option value="' + dk + '"' + (dir.type === dk ? ' selected' : '') + '>' + esc(dt.name) + '</option>';
    }
    html += '</select></div>';

    html += '<div class="field"><label>Authentication Method</label>' +
      '<select onchange="WCAI.teamsApp.setDirectory(\'auth_method\',this.value)">';
    for (var ak in tm.AUTH_METHODS) {
      var am = tm.AUTH_METHODS[ak];
      html += '<option value="' + ak + '"' + (dir.auth_method === ak ? ' selected' : '') + '>' + esc(am.name) + '</option>';
    }
    html += '</select></div>';

    html += '<div class="field"><label>Notes / Configuration Details</label>' +
      '<input value="' + esc(dir.notes) + '" placeholder="e.g. LDAP server: ldap.acme.com, Base DN: dc=acme,dc=com" oninput="WCAI.teamsApp.setDirectory(\'notes\',this.value)"></div>';

    html += bp('LDAP vs. Windchill-Only Directory',
      '<p><strong>LDAP / Active Directory</strong> is recommended for production environments. Users are managed in your enterprise directory and synced to Windchill automatically.</p>' +
      '<p><strong>Windchill-only</strong> is suitable for small or development environments. Users are created and managed directly in Windchill Participant Administration.</p>' +
      '<div class="bp-comparison">' +
        '<div class="bp-option recommended">' +
          '<h4>LDAP/AD Integration <span class="bp-tag preferred">Recommended</span></h4>' +
          '<ul>' +
            '<li>Centralized user management</li>' +
            '<li>Automatic user provisioning</li>' +
            '<li>Group membership can sync from AD groups</li>' +
            '<li>Single source of truth for credentials</li>' +
          '</ul>' +
        '</div>' +
        '<div class="bp-option alternative">' +
          '<h4>Windchill-Only <span class="bp-tag alternative">Dev/Test</span></h4>' +
          '<ul>' +
            '<li>No external dependencies</li>' +
            '<li>Quick setup for dev environments</li>' +
            '<li>Manual user creation required</li>' +
            '<li>Not scalable for large organizations</li>' +
          '</ul>' +
        '</div>' +
      '</div>'
    );

    if (dir.type === 'ldap') {
      html += bp('LDAP Configuration Notes',
        '<p>When using LDAP, Windchill periodically synchronizes user and group information from the directory server. Key configuration items:</p>' +
        '<ul style="margin:8px 0 8px 16px;font-size:12px;color:#cbd5e1;">' +
          '<li><strong>LDAP Server URL</strong> -- e.g., ldap://ldap.acme.com:389 or ldaps://ldap.acme.com:636</li>' +
          '<li><strong>Base DN</strong> -- The root of the search tree, e.g., dc=acme,dc=com</li>' +
          '<li><strong>Bind DN</strong> -- Service account for Windchill to query the directory</li>' +
          '<li><strong>User Search Filter</strong> -- e.g., (&amp;(objectClass=user)(sAMAccountName={0}))</li>' +
          '<li><strong>Group Search Filter</strong> -- For automatic group membership sync</li>' +
        '</ul>' +
        '<p>These settings are configured in Windchill\'s site.xconf and wt.properties files, not through this wizard.</p>'
      );
    }

    html += navButtons();
    document.getElementById("main").innerHTML = html;
  }

  function setDirectory(key, value) {
    var tc = getTeamsConfig();
    tc.directory[key] = value;
    WCAI.app._saveTeams();
    renderDirectory();
  }

  // ============================================================
  // Step 3: Users (shared with Change wizard)
  // ============================================================
  function renderUsers() {
    var config = getConfig();
    var people = config.people || [];
    var groups = config.groups || [];

    var html = '<h1 class="sec-title">Users</h1>' +
      '<p class="sec-desc">Define the users who will participate in your Windchill system. These users are shared with the Change Management wizard. Usernames must match their Windchill login.</p>' +
      '<div id="people-list">';

    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      var groupOpts = '<option value="">-- None --</option>';
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        groupOpts += '<option value="' + esc(g.id) + '"' + (p.group === g.id ? ' selected' : '') + '>' + esc(g.name || g.id) + '</option>';
      }
      html += '<div class="card">' +
        '<div class="card-head"><span>User ' + (i + 1) + '</span><button class="remove-btn" onclick="WCAI.teamsApp.removePerson(' + i + ')">Remove</button></div>' +
        '<div class="row">' +
          '<div class="field"><label>Full Name</label><input value="' + esc(p.name) + '" placeholder="Jane Smith" oninput="WCAI.teamsApp.setPerson(' + i + ',\'name\',this.value)"></div>' +
          '<div class="field"><label>Username *</label><input value="' + esc(p.username) + '" placeholder="jsmith" oninput="WCAI.teamsApp.updatePersonId(' + i + ',this.value)"></div>' +
          '<div class="field"><label>Email</label><input value="' + esc(p.email || '') + '" placeholder="jsmith@company.com" oninput="WCAI.teamsApp.setPerson(' + i + ',\'email\',this.value)"></div>' +
        '</div>' +
        '<div class="row">' +
          '<div class="field"><label>Group</label><select onchange="WCAI.teamsApp.setPerson(' + i + ',\'group\',this.value)">' + groupOpts + '</select></div>' +
          '<div class="field"></div><div class="field"></div>' +
        '</div></div>';
    }

    html += '</div>' +
      '<button class="add-btn" onclick="WCAI.teamsApp.addPerson()">+ Add User</button>' +
      bp('Shared Data: Users & Groups',
        '<p>Users and groups are <strong>shared between the Teams and Change Management wizards</strong>. Any users you add here will be available in the Change Management wizard\'s role mapping step.</p>' +
        '<p>This reflects the Windchill pattern: <strong>Users &rarr; Groups &rarr; Roles</strong>. The same user/group definitions serve both foundational administration and change process configuration.</p>'
      ) +
      navButtons();
    document.getElementById("main").innerHTML = html;
  }

  function addPerson() {
    var config = getConfig();
    config.people.push({ id: '', name: '', username: '', email: '', group: '' });
    WCAI.app._saveConfig();
    renderUsers();
  }

  function removePerson(i) {
    var config = getConfig();
    config.people.splice(i, 1);
    WCAI.app._saveConfig();
    renderUsers();
  }

  function setPerson(i, key, value) {
    var config = getConfig();
    config.people[i][key] = value;
    WCAI.app._saveConfig();
  }

  function updatePersonId(i, val) {
    var config = getConfig();
    config.people[i].username = val;
    config.people[i].id = val;
    WCAI.app._saveConfig();
  }

  // ============================================================
  // Step 4: Groups (shared with Change wizard)
  // ============================================================
  function renderGroups() {
    var config = getConfig();
    var groups = config.groups || [];
    var people = config.people || [];

    var html = '<h1 class="sec-title">Groups</h1>' +
      '<p class="sec-desc">Define organizational groups at the org level. Groups are the bridge between users and roles -- the best practice is to never assign individual users directly to roles.</p>' +
      '<div id="groups-list">';

    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var members = [];
      for (var pi = 0; pi < people.length; pi++) {
        if (people[pi].group === g.id) members.push(people[pi]);
      }
      var memberNames = members.map(function (p) { return esc(p.name || p.username); }).join(', ');

      html += '<div class="card">' +
        '<div class="card-head"><span>Group ' + (i + 1) + '</span><button class="remove-btn" onclick="WCAI.teamsApp.removeGroup(' + i + ')">Remove</button></div>' +
        '<div class="row">' +
          '<div class="field"><label>Group ID</label><input value="' + esc(g.id) + '" placeholder="eng" oninput="WCAI.teamsApp.setGroup(' + i + ',\'id\',this.value)"></div>' +
          '<div class="field"><label>Name</label><input value="' + esc(g.name) + '" placeholder="Engineering" oninput="WCAI.teamsApp.setGroup(' + i + ',\'name\',this.value)"></div>' +
          '<div class="field"><label>Description</label><input value="' + esc(g.description || '') + '" placeholder="Product engineering team" oninput="WCAI.teamsApp.setGroup(' + i + ',\'description\',this.value)"></div>' +
        '</div>';
      if (members.length > 0) {
        html += '<div style="margin-top:6px;font-size:11px;color:#64748b;">Members: ' + memberNames + '</div>';
      }
      html += '</div>';
    }

    html += '</div>' +
      '<button class="add-btn" onclick="WCAI.teamsApp.addGroup()">+ Add Group</button>' +
      bp('Best Practice: Groups at Organization Level',
        '<p>PTC recommends defining groups at the <strong>organization level</strong> whenever possible. This ensures:</p>' +
        '<ul style="margin:8px 0 8px 16px;font-size:12px;color:#cbd5e1;">' +
          '<li>Groups are available across all Products and Libraries in the org</li>' +
          '<li>Group membership can be managed from a single location</li>' +
          '<li>Role assignments in context teams reference the same groups</li>' +
        '</ul>' +
        '<p><strong>Note:</strong> Groups cannot be created via LoadFromFile or CLI. They must be created manually in the Windchill UI.</p>'
      ) +
      navButtons();
    document.getElementById("main").innerHTML = html;
  }

  function addGroup() {
    var config = getConfig();
    config.groups.push({ id: '', name: '', description: '' });
    WCAI.app._saveConfig();
    renderGroups();
  }

  function removeGroup(i) {
    var config = getConfig();
    config.groups.splice(i, 1);
    WCAI.app._saveConfig();
    renderGroups();
  }

  function setGroup(i, key, value) {
    var config = getConfig();
    config.groups[i][key] = value;
    WCAI.app._saveConfig();
  }

  // ============================================================
  // Step 5: License Profiles & Groups
  // ============================================================
  function renderLicenses() {
    var config = getConfig();
    var tc = getTeamsConfig();
    var people = config.people || [];
    var licenses = tc.licenses || {};

    var html = '<h1 class="sec-title">License Profiles & Groups</h1>' +
      '<p class="sec-desc">Assign each user to a license group. Users without a license group cannot access Windchill at all. Change management users typically need PTC Author or PTC PDMLink.</p>';

    html += bp('Windchill License Hierarchy',
      '<p>Windchill uses a three-tier licensing system:</p>' +
      '<ul style="margin:8px 0 8px 16px;font-size:12px;color:#cbd5e1;">' +
        '<li><strong>License Profiles</strong> -- Maintained by PTC, define which actions each license allows. Cannot be altered.</li>' +
        '<li><strong>License Groups</strong> -- Administrators add users to license groups to grant entitlements.</li>' +
        '<li><strong>License Names</strong> -- Your purchased license keys (Named User or Active Daily User).</li>' +
      '</ul>' +
      '<p>The total sum of license profiles determines a user\'s capabilities. A user\'s effective license is the <strong>union of all profiles</strong> from all license groups they belong to.</p>' +
      '<p>Standard profiles can be used to <strong>hide features</strong> from a user\'s profile sum, reducing complexity in the UI.</p>'
    );

    if (people.length === 0) {
      html += '<div class="card"><p class="no-people">Add users in Step 3 first.</p></div>';
    } else {
      for (var i = 0; i < people.length; i++) {
        var p = people[i];
        var pid = p.id || p.username;
        var currentLicense = licenses[pid] || '';

        var opts = '<option value="">-- Select License --</option>';
        for (var lk in tm.LICENSE_TYPES) {
          var lt = tm.LICENSE_TYPES[lk];
          opts += '<option value="' + lk + '"' + (currentLicense === lk ? ' selected' : '') + '>' + esc(lt.name) + '</option>';
        }

        var licenseInfo = '';
        if (currentLicense && tm.LICENSE_TYPES[currentLicense]) {
          var ltype = tm.LICENSE_TYPES[currentLicense];
          var color = ltype.change_capable ? '#22c55e' : '#f59e0b';
          licenseInfo = '<div style="margin-top:4px;font-size:11px;color:' + color + ';">' +
            (ltype.change_capable ? 'Change management capable' : 'Limited -- may not support all change actions') +
            '</div>';
        }

        html += '<div class="card" style="padding:12px 16px;">' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<div style="flex:1;">' +
              '<div style="font-size:13px;font-weight:600;color:#e2e8f0;">' + esc(p.name || p.username) + '</div>' +
              '<div style="font-size:11px;color:#64748b;">' + esc(p.username) + (p.group ? ' / ' + esc(p.group) : '') + '</div>' +
              licenseInfo +
            '</div>' +
            '<div style="width:220px;">' +
              '<select style="width:100%;padding:8px 10px;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;font-size:12px;font-family:inherit;" onchange="WCAI.teamsApp.setLicense(\'' + esc(pid) + '\',this.value)">' + opts + '</select>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
    }

    html += navButtons();
    document.getElementById("main").innerHTML = html;
  }

  function setLicense(personId, licenseType) {
    var tc = getTeamsConfig();
    if (!tc.licenses) tc.licenses = {};
    if (licenseType) {
      tc.licenses[personId] = licenseType;
    } else {
      delete tc.licenses[personId];
    }
    WCAI.app._saveTeams();
    renderLicenses();
  }

  // ============================================================
  // Step 6: Teams & Roles
  // ============================================================
  function renderTeams() {
    var config = getConfig();
    var tc = getTeamsConfig();
    var groups = config.groups || [];
    var ctxRoles = tc.context_roles || {};

    var html = '<h1 class="sec-title">Teams & Roles</h1>' +
      '<p class="sec-desc">Assign groups to context team roles. Context teams define who participates in which role at each Product/Library level. This is the PTC-preferred approach for role assignment.</p>';

    html += bp('Context Teams vs. Team Templates',
      '<p>Windchill provides two mechanisms for populating team roles:</p>' +
      '<div class="bp-comparison">' +
        '<div class="bp-option recommended">' +
          '<h4>Context Teams <span class="bp-tag preferred">PTC Preferred</span></h4>' +
          '<ul>' +
            '<li>Assign groups to roles at Product/Library level</li>' +
            '<li>Easier to implement and maintain</li>' +
            '<li>Different Products can have different group assignments</li>' +
            '<li>Uses OOTB team templates as-is</li>' +
          '</ul>' +
        '</div>' +
        '<div class="bp-option alternative">' +
          '<h4>Override Team Templates <span class="bp-tag alternative">Alternative</span></h4>' +
          '<ul>' +
            '<li>Create templates at org level with same names as site-level</li>' +
            '<li>Allows different groups per workflow for shared roles</li>' +
            '<li>More complex to maintain</li>' +
            '<li>Only needed when same role needs different groups in different workflows</li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="bp-quote"><p>The context team method is easier to implement and maintain. It is preferable to specify participants in a context team.</p>' +
      '<div class="bp-source">-- PTC Windchill Change Implementation Training Guide</div></div>'
    );

    for (var rk in tm.CONTEXT_ROLES) {
      var role = tm.CONTEXT_ROLES[rk];
      var assigned = ctxRoles[rk] || [];
      html += '<div class="role-card">' +
        '<div class="role-name">' + esc(role.name) + '</div>' +
        '<div class="role-desc">' + esc(role.description) + '</div>' +
        '<div class="chips">';
      if (groups.length === 0) {
        html += '<span class="no-people">Add groups in Step 4 first</span>';
      } else {
        for (var gi = 0; gi < groups.length; gi++) {
          var g = groups[gi];
          var sel = assigned.indexOf(g.id) >= 0;
          html += '<button class="chip' + (sel ? ' selected' : '') + '" onclick="WCAI.teamsApp.toggleContextRole(\'' + rk + '\',\'' + esc(g.id) + '\')">' +
            (sel ? '&#10003; ' : '') + esc(g.name || g.id) + '</button>';
        }
      }
      html += '</div></div>';
    }

    html += navButtons();
    document.getElementById("main").innerHTML = html;
  }

  function toggleContextRole(roleId, groupId) {
    var tc = getTeamsConfig();
    if (!tc.context_roles) tc.context_roles = {};
    if (!tc.context_roles[roleId]) tc.context_roles[roleId] = [];
    var arr = tc.context_roles[roleId];
    var idx = arr.indexOf(groupId);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(groupId);
    WCAI.app._saveTeams();
    renderTeams();
  }

  // ============================================================
  // Step 7: Validate & Deployment Checklist
  // ============================================================
  function renderChecklist() {
    try {
      var config = getConfig();
      var tc = getTeamsConfig();
      var org = esc(tc.org.name || config.company.org || 'YourOrg');
      var people = config.people || [];
      var groups = config.groups || [];
      var licenses = tc.licenses || {};
      var ctxRoles = tc.context_roles || {};
      var clState = WCAI.app._getTeamsChecklistState();
      var openSec = WCAI.app._getTeamsOpenSections();

      // --- Validation ---
      var issues = tv.validate(tc, config);
      var errors = [];
      var warnings = [];
      var infos = [];
      for (var vi = 0; vi < issues.length; vi++) {
        if (issues[vi].severity === "ERROR") errors.push(issues[vi]);
        else if (issues[vi].severity === "WARNING") warnings.push(issues[vi]);
        else infos.push(issues[vi]);
      }

      var validationHtml = '';
      if (issues.length === 0) {
        validationHtml = '<div class="success-box" style="margin-bottom:24px;"><h3>Validation Passed</h3><p>No issues found. Review the checklist below for deployment steps.</p></div>';
      } else {
        validationHtml = '<div style="margin-bottom:24px;">' +
          '<h3 style="font-size:14px;color:#f1f5f9;margin-bottom:8px;">' + errors.length + ' errors, ' + warnings.length + ' warnings, ' + infos.length + ' info</h3>';
        for (var ii = 0; ii < issues.length; ii++) {
          var iss = issues[ii];
          validationHtml += '<div class="issue ' + iss.severity + '">' +
            '<strong>[' + iss.section + ']</strong> ' + esc(iss.message) +
            (iss.fix_hint ? '<div class="hint">Fix: ' + esc(iss.fix_hint) + '</div>' : '') +
            '</div>';
        }
        validationHtml += '</div>';
      }

      // --- Checklist ---
      var sections = {};
      var sectionOrder = [];
      var curSection = null;

      function trackId(id, autoCheck) {
        if (autoCheck && !clState[id]) clState[id] = true;
        if (curSection && sections[curSection]) sections[curSection].push(id);
      }

      function clItem(id, task, detail, nav, ppl, autoCheck) {
        var checked = clState[id] || autoCheck;
        trackId(id, autoCheck);
        var h = '<div class="cl-item' + (checked ? ' checked' : '') + '" onclick="WCAI.teamsApp.toggleCheck(\'' + id + '\')">';
        h += '<div class="cl-box">' + (checked ? 'X' : '') + '</div>';
        h += '<div class="cl-content">';
        h += '<div class="cl-task">' + task + '</div>';
        h += '<div class="cl-detail">' + detail + '</div>';
        h += '<div class="cl-nav">' + nav + '</div>';
        if (ppl && ppl.length > 0) {
          h += '<div class="cl-people">';
          var unique = [];
          for (var ui = 0; ui < ppl.length; ui++) {
            if (unique.indexOf(ppl[ui]) < 0) unique.push(ppl[ui]);
          }
          for (var uj = 0; uj < unique.length; uj++) {
            h += '<span class="cl-person">' + esc(unique[uj]) + '</span>';
          }
          h += '</div>';
        }
        h += '</div></div>';
        return h;
      }

      function beginSection(key, num, title, subtitle, type) {
        curSection = key;
        sections[key] = [];
        sectionOrder.push({ key: key, num: num, title: title, subtitle: subtitle, type: type });
        var badge = type === 'auto' ? '<span class="cl-badge done">Automated</span>' : '<span class="cl-badge todo">Manual</span>';
        var isOpen = openSec[key];
        return '<div class="cl-section' + (isOpen ? ' open' : '') + '" data-section="' + key + '">' +
          '<div class="cl-section-head" onclick="WCAI.teamsApp.toggleSection(\'' + key + '\')">' +
            '<div class="cl-section-num ' + type + '">' + num + '</div>' +
            '<div><div class="cl-section-title">' + title + ' ' + badge + '</div>' +
            '<div class="cl-section-subtitle">' + subtitle + '</div></div>' +
            '<div class="cl-section-meta">' +
              '<span class="cl-section-count" data-count="t_' + key + '"></span>' +
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

      // === Section 1: Verify Organization ===
      html += beginSection('ts1', 1, 'Verify Organization Exists', 'Must exist before any other steps', 'manual');
      html += bp('Why does the organization matter?',
        '<p>Everything in Windchill is scoped to a context hierarchy: <strong>Site &rarr; Organization &rarr; Product/Library</strong>. Groups, teams, and access control are set at the Organization level.</p>'
      );
      html += clItem('t_org_exists', 'Verify organization \'' + org + '\' exists',
        'Navigate to Site level and confirm your org is listed.',
        'Site &rarr; Utilities &rarr; Organization Administration');
      html += endSection();

      // === Section 2: Assign Org Admins ===
      html += beginSection('ts2', 2, 'Assign Organization Administrators', 'Required before creating groups or configuring policies', 'manual');
      var admins = tc.org.admins || [];
      if (admins.length > 0) {
        var adminNames = [];
        for (var ai = 0; ai < admins.length; ai++) {
          var found = null;
          for (var pi = 0; pi < people.length; pi++) {
            if ((people[pi].id || people[pi].username) === admins[ai]) { found = people[pi]; break; }
          }
          adminNames.push(found ? (found.name || found.username) : admins[ai]);
        }
        html += clItem('t_orgadmin_assign', 'Assign Organization Administrators: ' + adminNames.join(', '),
          'Add these users to the org\'s Administrators group.',
          'Browse &rarr; Organizations &rarr; ' + org + ' &rarr; Administrators &rarr; Add Users',
          adminNames);
      } else {
        html += clItem('t_orgadmin_assign', 'Assign at least one Organization Administrator',
          'No org admins configured yet. Return to Step 1 to assign admins.',
          'Browse &rarr; Organizations &rarr; ' + org + ' &rarr; Administrators &rarr; Add Users');
      }
      html += clItem('t_orgadmin_verify', 'Verify Org Admin can access org-level Utilities',
        'Sign in as the Org Admin and confirm access to Participant Administration, Business Rules, and Policy Administration.',
        org + ' &rarr; Utilities');
      html += endSection();

      // === Section 3: Create/Verify User Accounts ===
      html += beginSection('ts3', 3, 'Create or Verify User Accounts', 'Users must exist before group and team assignment', 'manual');
      var dirType = tc.directory.type || 'windchill';
      if (dirType === 'ldap') {
        html += bp('LDAP Users', '<p>Since you are using LDAP/AD integration, most users should already exist via directory sync. Verify they appear in Participant Administration.</p>');
      }
      for (var ui = 0; ui < people.length; ui++) {
        var pu = people[ui];
        html += clItem('t_user_' + ui, (dirType === 'ldap' ? 'Verify' : 'Create') + ' user: ' + esc(pu.name || pu.username) + ' (' + esc(pu.username) + ')',
          dirType === 'ldap' ? 'Verify this user is synced from the directory.' : 'Create this user account in Windchill.',
          'Site &rarr; Utilities &rarr; Participant Administration &rarr; ' + (dirType === 'ldap' ? 'Search' : 'Create User'));
      }
      html += endSection();

      // === Section 4: License Group Membership ===
      html += beginSection('ts4', 4, 'Verify License Group Membership', 'Users cannot access Windchill without a license', 'manual');
      html += bp('Why are license groups critical?',
        '<p><strong>A user not in any license group cannot access Windchill at all.</strong> This is a hard gate.</p>' +
        '<p>For change management, users need <strong>PTC Author</strong> or <strong>PTC PDMLink</strong>.</p>'
      );
      html += clItem('t_license_review', 'Review available license groups and seats',
        'Check which license groups exist and how many seats remain.',
        'Site &rarr; Utilities &rarr; License Management');
      for (var li = 0; li < people.length; li++) {
        var pl = people[li];
        var plid = pl.id || pl.username;
        var lic = licenses[plid];
        var licName = lic && tm.LICENSE_TYPES[lic] ? tm.LICENSE_TYPES[lic].name : 'NOT ASSIGNED';
        html += clItem('t_license_' + li, 'Verify license for: ' + esc(pl.name || pl.username) + ' -- ' + licName,
          'Ensure this user is in the correct license group.',
          'Site &rarr; Utilities &rarr; Participant Administration &rarr; \'' + esc(pl.username) + '\' &rarr; Groups tab');
      }
      html += endSection();

      // === Section 5: Create Groups ===
      html += beginSection('ts5', 5, 'Create Groups and Add Users', 'Groups cannot be created via CLI -- manual step only', 'manual');
      html += bp('Best Practice: Users -> Groups -> Roles',
        '<p style="text-align:center;font-size:14px;font-weight:700;color:#22c55e;padding:8px 0;">Users &rarr; Groups &rarr; Roles</p>' +
        '<p><strong>Never assign individual users directly to roles.</strong> Always go through groups for maintainability, LDAP alignment, and auditability.</p>'
      );
      for (var gci = 0; gci < groups.length; gci++) {
        var gc = groups[gci];
        html += clItem('t_grp_create_' + gci, 'Create group: \'' + esc(gc.name || gc.id) + '\'',
          'Create this internal group in your organization.',
          org + ' &rarr; Utilities &rarr; Participant Administration &rarr; Internal Groups &rarr; Create');
        var gMembers = [];
        for (var gmi = 0; gmi < people.length; gmi++) {
          if (people[gmi].group === gc.id) gMembers.push(people[gmi]);
        }
        if (gMembers.length > 0) {
          var mNames = gMembers.map(function (p) { return esc(p.name || p.username); }).join(', ');
          html += clItem('t_grp_members_' + gci, 'Add users to \'' + esc(gc.name || gc.id) + '\'',
            'Add: ' + mNames,
            org + ' &rarr; Utilities &rarr; Participant Administration &rarr; \'' + esc(gc.name || gc.id) + '\' &rarr; Add Members',
            gMembers.map(function (p) { return p.name || p.username; }));
        }
      }
      html += endSection();

      // === Section 6: Configure Context Teams ===
      html += beginSection('ts6', 6, 'Configure Context Teams', 'Assign groups to team roles per Product/Library', 'manual');
      html += bp('Context Team Role Resolution',
        '<p>When Windchill needs to determine who fills a role, it resolves in this order:</p>' +
        '<ul style="margin:8px 0 8px 16px;font-size:12px;color:#cbd5e1;">' +
          '<li>1. Context team (Product/Library level) -- highest priority</li>' +
          '<li>2. Team template (Site level) -- fallback if not in context team</li>' +
          '<li>3. Shared team (Org level) -- for cross-context roles</li>' +
        '</ul>' +
        '<p>Setting up context teams at the Product level gives you the most flexibility.</p>'
      );
      for (var crk in tm.CONTEXT_ROLES) {
        var crole = tm.CONTEXT_ROLES[crk];
        var cAssigned = ctxRoles[crk] || [];
        var grpNames = [];
        for (var cgi = 0; cgi < cAssigned.length; cgi++) {
          var cg = null;
          for (var cgj = 0; cgj < groups.length; cgj++) {
            if (groups[cgj].id === cAssigned[cgi]) { cg = groups[cgj]; break; }
          }
          grpNames.push(cg ? (cg.name || cg.id) : cAssigned[cgi]);
        }
        html += clItem('t_ctx_' + crk, 'Assign group(s) to ' + crole.name,
          crole.description + '. Groups: ' + (grpNames.join(', ') || '(none assigned)'),
          '[Product/Library] &rarr; Team &rarr; Edit Team &rarr; ' + crole.name);
      }
      html += endSection();

      // === Section 7: Verify Access Control ===
      html += beginSection('ts7', 7, 'Verify Access Control Policies', 'Ensure permissions align with team role assignments', 'manual');
      html += bp('Access Control Overview',
        '<p>Access control policies determine what actions users can perform on objects at each lifecycle state. After setting up teams and roles, verify:</p>' +
        '<ul style="margin:8px 0 8px 16px;font-size:12px;color:#cbd5e1;">' +
          '<li>Members can view and create objects in their context</li>' +
          '<li>Role-specific permissions match workflow requirements</li>' +
          '<li>Guest access is appropriately restricted</li>' +
        '</ul>'
      );
      html += clItem('t_acp_org', 'Review org-level access control policies',
        'Verify default policies are appropriate for your organization.',
        org + ' &rarr; Utilities &rarr; Policy Administration &rarr; Access Control');
      html += clItem('t_acp_product', 'Review product-level access control (per Product)',
        'Each Product may have its own policies. Verify after context team setup.',
        '[Product] &rarr; Utilities &rarr; Policy Administration &rarr; Access Control');
      html += endSection();

      // === Section 8: Handoff to Change Management ===
      html += beginSection('ts8', 8, 'Handoff to Change Management Wizard', 'Foundation complete -- proceed to change process configuration', 'manual');
      html += clItem('t_handoff', 'Switch to Change Management wizard',
        'The Teams & Participants foundation is set. Switch to the Change Management tab to configure OIR, business rules, preferences, and associations.',
        'Click the "Change Mgmt" tab in the sidebar');
      html += endSection();

      // === Compute progress ===
      var allIds = [];
      var totalChecked = 0;
      for (var si = 0; si < sectionOrder.length; si++) {
        var ids = sections[sectionOrder[si].key] || [];
        for (var sj = 0; sj < ids.length; sj++) { allIds.push(ids[sj]); }
      }
      for (var ci = 0; ci < allIds.length; ci++) {
        if (clState[allIds[ci]]) totalChecked++;
      }
      var totalCount = allIds.length;
      var pct = totalCount > 0 ? Math.round(totalChecked / totalCount * 100) : 0;

      var progressHtml = '<div class="cl-progress"><div class="cl-progress-bar"><div class="cl-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="cl-progress-text">' + totalChecked + '/' + totalCount + '</div></div>';

      document.getElementById("main").innerHTML =
        '<h1 class="sec-title">Teams & Participants -- Validate & Checklist</h1>' +
        '<p class="sec-desc">Review validation results and work through the deployment checklist for foundational Windchill setup.</p>' +
        validationHtml + progressHtml + html + navButtons();

      // Inject per-section counts
      for (var sci = 0; sci < sectionOrder.length; sci++) {
        var sec = sectionOrder[sci];
        var sids = sections[sec.key] || [];
        var done = 0;
        for (var sdi = 0; sdi < sids.length; sdi++) {
          if (clState[sids[sdi]]) done++;
        }
        var el = document.querySelector('[data-count="t_' + sec.key + '"]');
        if (el) {
          el.textContent = done + '/' + sids.length;
          if (done === sids.length && sids.length > 0) el.classList.add('complete');
        }
      }

      WCAI.app._saveTeams();
    } catch (err) {
      document.getElementById("main").innerHTML =
        '<h1 style="color:#ef4444;">Teams Checklist Error</h1>' +
        '<pre style="color:#fca5a5;white-space:pre-wrap;">' + err.message + '\n\n' + err.stack + '</pre>' +
        navButtons();
    }
  }

  function toggleSection(key) {
    var openSec = WCAI.app._getTeamsOpenSections();
    openSec[key] = !openSec[key];
    WCAI.app._saveTeams();
    var el = document.querySelector('[data-section="' + key + '"]');
    if (el) el.classList.toggle('open');
  }

  function toggleCheck(id) {
    var clState = WCAI.app._getTeamsChecklistState();
    clState[id] = !clState[id];
    WCAI.app._saveTeams();
    renderChecklist();
  }

  // Export
  WCAI.teamsApp = {
    STEPS_TEAMS: STEPS_TEAMS,
    render: render,
    // Org
    setOrg: setOrg,
    toggleAdmin: toggleAdmin,
    // Directory
    setDirectory: setDirectory,
    // Users (shared)
    addPerson: addPerson,
    removePerson: removePerson,
    setPerson: setPerson,
    updatePersonId: updatePersonId,
    // Groups (shared)
    addGroup: addGroup,
    removeGroup: removeGroup,
    setGroup: setGroup,
    // Licenses
    setLicense: setLicense,
    // Teams
    toggleContextRole: toggleContextRole,
    // Checklist
    toggleSection: toggleSection,
    toggleCheck: toggleCheck,
  };
})();
