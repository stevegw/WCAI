/**
 * WCAI -- Reference -- Access Model & Educational Content
 * ========================================================
 * Reference tab with Windchill access model concepts, interactive
 * scenarios, cheat sheet, common misconceptions, and access control
 * deep-dive (domains, policies, ad hoc, security labels).
 * Attached to window.WCAI.referenceApp.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};

  var STEPS_REFERENCE = [
    { id: "ref_access_model", label: "Access Model" },
    { id: "ref_access_control", label: "Access Control" }
  ];

  var activeScenario = "new_user";
  var activeAcStrategy = "domain";
  var activeCaseStudy = "grant";

  function render(stepIndex) {
    if (stepIndex === 0) renderAccessModel();
    else if (stepIndex === 1) renderAccessControl();
  }

  // ============================================================
  // Shared Helpers
  // ============================================================
  function conceptCard(color, title, subtitle, body) {
    return '<div class="ref-concept-card ref-border-' + color + '">' +
      '<div style="margin-bottom:10px;">' +
        '<span class="ref-tag ' + color + '">' + title + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:6px;">' + subtitle + '</div>' +
      '<div style="font-size:12px;color:#94a3b8;line-height:1.7;">' + body + '</div>' +
    '</div>';
  }

  function scenarioStep(num, color, text) {
    return '<div class="ref-scenario-step">' +
      '<span class="ref-step-num ref-bg-' + color + '">' + num + '</span>' +
      '<span style="font-size:12.5px;color:#cbd5e1;line-height:1.6;">' + text + '</span>' +
    '</div>';
  }

  function renderNavButtons() {
    var step = WCAI.app._getRefStep();
    var isFirst = step === 0;
    var isLast = step === STEPS_REFERENCE.length - 1;
    return '<div class="nav-btns">' +
      '<button class="btn btn-secondary" onclick="WCAI.app.goToStep(' + (step - 1) + ')" ' + (isFirst ? 'disabled' : '') + '>Back</button>' +
      (!isLast ? '<button class="btn btn-primary" onclick="WCAI.app.saveAndNext()">Next</button>' : '') +
    '</div>';
  }

  // ============================================================
  // PAGE 1: Access Model
  // ============================================================
  function renderAccessModel() {
    var html = '';

    html += '<h1 class="sec-title">Windchill Access Model</h1>' +
      '<p class="sec-desc">How Windchill determines what a user can see and do. Three interlocking systems -- Application Context, Roles, and Content Groups -- combine with Access Control Policies to form Windchill\'s security model.</p>';

    // --- Three Concept Cards ---
    html += '<div class="ref-concepts">' +
      conceptCard(
        'blue',
        'Application Context',
        'The container hierarchy that scopes all objects and permissions.',
        '<p>Every object in Windchill lives inside a <strong>context</strong>. The hierarchy flows:</p>' +
        '<p style="text-align:center;font-size:14px;font-weight:700;color:#4ea8de;padding:6px 0;">Site &rarr; Organization &rarr; Product / Library</p>' +
        '<p>Permissions, teams, and policies are defined <em>per context</em>. A user\'s effective access depends on which context they\'re operating in.</p>' +
        '<ul>' +
          '<li><strong>Site</strong> -- Global settings, license management, system admin</li>' +
          '<li><strong>Organization</strong> -- Groups, association rules, access policies</li>' +
          '<li><strong>Product / Library</strong> -- Context teams, object storage, workflows</li>' +
        '</ul>'
      ) +
      conceptCard(
        'orange',
        'Roles (Guest vs. Member)',
        'Every user in a context is either a Guest or a Member with specific roles.',
        '<p>When a user accesses a Product or Library context, Windchill classifies them:</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;">' +
          '<div style="padding:10px;border-radius:6px;border:1px solid rgba(245,158,97,0.3);background:rgba(245,158,97,0.05);">' +
            '<div style="font-weight:700;color:#f4a261;font-size:12px;margin-bottom:4px;">Guest</div>' +
            '<div style="font-size:11px;color:#94a3b8;">Not on the context team. Gets <em>Guest</em> role permissions only. Typically read-only or no access.</div>' +
          '</div>' +
          '<div style="padding:10px;border-radius:6px;border:1px solid rgba(245,158,97,0.3);background:rgba(245,158,97,0.05);">' +
            '<div style="font-weight:700;color:#f4a261;font-size:12px;margin-bottom:4px;">Member</div>' +
            '<div style="font-size:11px;color:#94a3b8;">On the context team with one or more roles. Gets permissions for <em>all</em> assigned roles combined.</div>' +
          '</div>' +
        '</div>' +
        '<p>Roles are populated by <strong>groups</strong>, not individual users. The pattern is: Users &rarr; Groups &rarr; Roles.</p>'
      ) +
      conceptCard(
        'green',
        'Content Groups',
        'Dynamic object-level groupings that policies reference for fine-grained control.',
        '<p>Content groups let you apply different access rules to different <em>types of content</em> within the same context:</p>' +
        '<ul>' +
          '<li><strong>Default</strong> -- Catches objects not matched by other content groups</li>' +
          '<li><strong>Custom</strong> -- Match by object type, lifecycle state, or attribute</li>' +
        '</ul>' +
        '<p>Example: An "Engineering Documents" content group could match all <code>wt.doc.WTDocument</code> objects, while a "CAD Data" group matches <code>wt.part.WTPart</code> objects -- each with different permission rules.</p>'
      ) +
    '</div>';

    // --- SVG Diagram ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:12px;">How the Three Systems Connect</h2>' +
      '<div class="ref-diagram">' + renderDiagram() + '</div>' +
    '</div>';

    // --- ACP Callout ---
    html += '<div class="ref-insight">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span class="ref-tag purple">Access Control Policy</span>' +
        '<span style="font-size:14px;font-weight:700;color:#c084fc;">The Glue That Binds</span>' +
      '</div>' +
      '<p style="font-size:12.5px;color:#cbd5e1;line-height:1.7;">An Access Control Policy (ACP) rule says: <em>"For this <span class="ref-tag blue">Context</span>, users in this <span class="ref-tag orange">Role</span>, acting on objects in this <span class="ref-tag green">Content Group</span>, at this lifecycle state, may perform these actions."</em></p>' +
      '<p style="font-size:12px;color:#94a3b8;margin-top:6px;">Without an ACP rule granting permission, the default answer is <strong>deny</strong>. Windchill uses a "grant-only" model -- there are no explicit deny rules.</p>' +
    '</div>';

    // --- Interactive Scenarios ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:12px;">Interactive Scenarios</h2>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px;">Walk through common access scenarios to see how Context, Roles, and Content Groups work together.</p>' +
      renderScenarioTabs() +
    '</div>';

    // --- Cheat Sheet ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:12px;">Quick Reference Cheat Sheet</h2>' +
      renderCheatSheet() +
    '</div>';

    // --- Common Misconceptions ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:12px;">Common Misconceptions</h2>' +
      renderMisconceptions() +
    '</div>';

    html += renderNavButtons();
    document.getElementById("main").innerHTML = html;
    highlightActiveScenario();
  }

  // --- Access Model sub-renderers ---

  function renderDiagram() {
    return '<svg viewBox="0 0 700 320" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">' +
      '<defs>' +
        '<marker id="ref-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker>' +
      '</defs>' +
      '<rect width="700" height="320" rx="12" fill="#0f172a"/>' +
      '<rect x="20" y="130" width="100" height="60" rx="8" fill="#1e293b" stroke="#64748b" stroke-width="1"/>' +
      '<text x="70" y="155" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="700">User</text>' +
      '<text x="70" y="172" text-anchor="middle" fill="#64748b" font-size="9">(jsmith)</text>' +
      '<line x1="120" y1="160" x2="188" y2="160" stroke="#64748b" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +
      '<text x="154" y="152" text-anchor="middle" fill="#475569" font-size="8">enters</text>' +
      '<rect x="190" y="110" width="150" height="100" rx="8" fill="rgba(78,168,222,0.08)" stroke="#4ea8de" stroke-width="1.5"/>' +
      '<text x="265" y="135" text-anchor="middle" fill="#4ea8de" font-size="10" font-weight="700">APPLICATION CONTEXT</text>' +
      '<text x="265" y="155" text-anchor="middle" fill="#e2e8f0" font-size="11">Product / Library</text>' +
      '<text x="265" y="175" text-anchor="middle" fill="#64748b" font-size="9">Context Team evaluates</text>' +
      '<text x="265" y="190" text-anchor="middle" fill="#64748b" font-size="9">Guest vs. Member</text>' +
      '<line x1="340" y1="140" x2="408" y2="90" stroke="#f4a261" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +
      '<text x="385" y="105" text-anchor="middle" fill="#475569" font-size="8">assigns</text>' +
      '<rect x="410" y="50" width="130" height="80" rx="8" fill="rgba(244,162,97,0.08)" stroke="#f4a261" stroke-width="1.5"/>' +
      '<text x="475" y="75" text-anchor="middle" fill="#f4a261" font-size="10" font-weight="700">ROLE</text>' +
      '<text x="475" y="95" text-anchor="middle" fill="#e2e8f0" font-size="11">Change Admin I</text>' +
      '<text x="475" y="112" text-anchor="middle" fill="#64748b" font-size="9">via Group membership</text>' +
      '<line x1="340" y1="180" x2="408" y2="220" stroke="#7ec98f" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +
      '<text x="385" y="208" text-anchor="middle" fill="#475569" font-size="8">scopes</text>' +
      '<rect x="410" y="190" width="130" height="80" rx="8" fill="rgba(126,201,143,0.08)" stroke="#7ec98f" stroke-width="1.5"/>' +
      '<text x="475" y="215" text-anchor="middle" fill="#7ec98f" font-size="10" font-weight="700">CONTENT GROUP</text>' +
      '<text x="475" y="235" text-anchor="middle" fill="#e2e8f0" font-size="11">CAD Data</text>' +
      '<text x="475" y="252" text-anchor="middle" fill="#64748b" font-size="9">Object type / state filter</text>' +
      '<line x1="540" y1="100" x2="588" y2="140" stroke="#c084fc" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +
      '<line x1="540" y1="225" x2="588" y2="185" stroke="#c084fc" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +
      '<rect x="590" y="120" width="95" height="80" rx="8" fill="rgba(192,132,252,0.08)" stroke="#c084fc" stroke-width="1.5"/>' +
      '<text x="637" y="148" text-anchor="middle" fill="#c084fc" font-size="9" font-weight="700">ACCESS CONTROL</text>' +
      '<text x="637" y="162" text-anchor="middle" fill="#c084fc" font-size="9" font-weight="700">POLICY</text>' +
      '<text x="637" y="182" text-anchor="middle" fill="#e2e8f0" font-size="10">Grant / Deny</text>' +
    '</svg>';
  }

  var SCENARIOS = {
    new_user: {
      label: "New User Access",
      content:
        '<h3 style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Scenario: New user can\'t see a Product</h3>' +
        '<div class="ref-scenario-steps">' +
          scenarioStep(1, 'blue', 'User logs in to Windchill and navigates to a Product.') +
          scenarioStep(2, 'orange', 'Windchill checks the Product\'s context team. User is NOT listed in any role.') +
          scenarioStep(3, 'orange', 'User is classified as <strong>Guest</strong>.') +
          scenarioStep(4, 'purple', 'Access Control Policy for Guest role in this context grants only: <strong>Read (limited)</strong> or <strong>No Access</strong>.') +
          scenarioStep(5, 'green', 'Result: User can see the Product container but cannot view or create objects inside it.') +
        '</div>' +
        '<div class="ref-scenario-fix">' +
          '<strong>Fix:</strong> Add the user\'s group to the Product context team under the appropriate role (e.g., Members). Ensure their license group allows the required actions.' +
        '</div>'
    },
    change_admin: {
      label: "Change Admin Workflow",
      content:
        '<h3 style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Scenario: Change Admin I creates a Problem Report</h3>' +
        '<div class="ref-scenario-steps">' +
          scenarioStep(1, 'blue', 'Change Admin I navigates to the Product context where the issue was found.') +
          scenarioStep(2, 'orange', 'User\'s group (e.g., Engineering) is assigned to the <strong>Change Admin I</strong> role in the context team.') +
          scenarioStep(3, 'green', 'The Problem Report object falls into the <strong>Default</strong> content group for change objects.') +
          scenarioStep(4, 'purple', 'ACP rule grants Change Admin I: <strong>Create, Modify, Change State</strong> on change objects.') +
          scenarioStep(5, 'green', 'Result: User can create the PR, modify it, and transition it through the Problem Report lifecycle.') +
        '</div>' +
        '<div class="ref-scenario-fix">' +
          '<strong>Key point:</strong> The same user acting in a <em>different</em> Product where their group is NOT assigned to Change Admin I would only have Guest or Members permissions there.' +
        '</div>'
    },
    crb_review: {
      label: "CRB Review",
      content:
        '<h3 style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Scenario: Change Review Board votes on a Change Request</h3>' +
        '<div class="ref-scenario-steps">' +
          scenarioStep(1, 'blue', 'CRB members receive a workflow task to review a Change Request in a Product context.') +
          scenarioStep(2, 'orange', 'Their groups (e.g., Management, QA) are assigned to the <strong>Change Review Board</strong> role.') +
          scenarioStep(3, 'green', 'The CR object is in the <strong>Under Review</strong> lifecycle state.') +
          scenarioStep(4, 'purple', 'ACP grants CRB role: <strong>Read, Approve/Reject</strong> on change objects at Under Review state.') +
          scenarioStep(5, 'green', 'Result: CRB members can review, comment, and cast their vote. They cannot modify the CR content.') +
        '</div>' +
        '<div class="ref-scenario-fix">' +
          '<strong>Key point:</strong> Access changes with lifecycle state. Once the CR moves to "Approved", the CRB role may no longer have modify access -- it shifts to Change Admin II for CN creation.' +
        '</div>'
    },
    cross_context: {
      label: "Cross-Context Access",
      content:
        '<h3 style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:8px;">Scenario: User needs access to objects in two different Products</h3>' +
        '<div class="ref-scenario-steps">' +
          scenarioStep(1, 'blue', 'User is a Member of <strong>Product A</strong> (Engineering role) but only a <strong>Guest</strong> in Product B.') +
          scenarioStep(2, 'orange', 'In Product A, they have full create/modify access. In Product B, they can only browse.') +
          scenarioStep(3, 'green', 'A Change Notice references parts from <em>both</em> Products.') +
          scenarioStep(4, 'purple', 'Access is evaluated per-context: the user can modify affected objects in Product A but cannot modify them in Product B.') +
          scenarioStep(5, 'green', 'Result: The CN implementation plan may be blocked for Product B parts until the user\'s group is added to Product B\'s context team.') +
        '</div>' +
        '<div class="ref-scenario-fix">' +
          '<strong>Fix:</strong> For cross-product change processes, ensure affected groups are added to context teams in ALL Products that the change touches.' +
        '</div>'
    }
  };

  function renderScenarioTabs() {
    var tabsHtml = '<div class="ref-flow-tabs">';
    for (var id in SCENARIOS) {
      tabsHtml += '<button class="ref-flow-tab' + (id === activeScenario ? ' active' : '') + '" data-scenario="' + id + '" onclick="WCAI.referenceApp.switchScenario(\'' + id + '\')">' + SCENARIOS[id].label + '</button>';
    }
    tabsHtml += '</div>';
    tabsHtml += '<div class="ref-flow-panels">';
    for (var sid in SCENARIOS) {
      tabsHtml += '<div class="ref-flow-panel' + (sid === activeScenario ? ' active' : '') + '" data-panel="' + sid + '">' + SCENARIOS[sid].content + '</div>';
    }
    tabsHtml += '</div>';
    return tabsHtml;
  }

  function switchScenario(id) {
    activeScenario = id;
    highlightActiveScenario();
  }

  function highlightActiveScenario() {
    var tabs = document.querySelectorAll('.ref-flow-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-scenario') === activeScenario) tabs[i].classList.add('active');
      else tabs[i].classList.remove('active');
    }
    var panels = document.querySelectorAll('.ref-flow-panel');
    for (var j = 0; j < panels.length; j++) {
      if (panels[j].getAttribute('data-panel') === activeScenario) panels[j].classList.add('active');
      else panels[j].classList.remove('active');
    }
  }

  function renderCheatSheet() {
    return '<table class="ref-cheat-table">' +
      '<thead><tr><th>Question</th><th>System</th><th>Where to Configure</th></tr></thead>' +
      '<tbody>' +
        cheatRow('Who can access this Product?', '<span class="ref-tag orange">Roles</span>', 'Context Team &rarr; Members role') +
        cheatRow('What can they do to documents?', '<span class="ref-tag purple">ACP</span>', 'Policy Admin &rarr; Access Control') +
        cheatRow('Can guests see anything?', '<span class="ref-tag orange">Roles</span> + <span class="ref-tag purple">ACP</span>', 'Guest role ACP rules') +
        cheatRow('Different permissions for CAD vs. docs?', '<span class="ref-tag green">Content Groups</span>', 'Policy Admin &rarr; Content Groups') +
        cheatRow('Why can\'t user X create a PR?', '<span class="ref-tag orange">Roles</span> + <span class="ref-tag purple">ACP</span>', 'Context Team + ACP for their role') +
        cheatRow('How do I restrict by lifecycle state?', '<span class="ref-tag purple">ACP</span>', 'ACP rule with state condition') +
        cheatRow('Where are groups defined?', '<span class="ref-tag blue">Context</span>', 'Org &rarr; Participant Admin &rarr; Groups') +
        cheatRow('How do I give cross-product access?', '<span class="ref-tag blue">Context</span>', 'Add group to each Product\'s context team') +
      '</tbody></table>';
  }

  function cheatRow(question, system, where) {
    return '<tr><td style="font-weight:600;color:#e2e8f0;">' + question + '</td><td>' + system + '</td><td style="color:#94a3b8;">' + where + '</td></tr>';
  }

  function renderMisconceptions() {
    return '<div class="ref-mistakes-grid">' +
      misconceptionCard('Users are directly assigned to roles',
        'Users &rarr; Groups &rarr; Roles. Always use groups as the intermediary. Direct user assignment creates maintenance nightmares and breaks LDAP sync.',
        'Never assign users directly to team roles.') +
      misconceptionCard('Access is global across all Products',
        'Access is evaluated <em>per context</em>. A user who is Change Admin I in Product A might be a Guest in Product B. Each Product/Library has its own context team.',
        'Check context team membership per Product.') +
      misconceptionCard('Deny rules exist to block access',
        'Windchill uses a <strong>grant-only</strong> model. There are no explicit deny rules. If no ACP rule grants permission, access is denied by default. To restrict access, simply don\'t grant it.',
        'No permission granted = access denied.') +
      misconceptionCard('Team templates replace context teams',
        'Team templates are <em>defaults</em> that context teams can override. The resolution order is: Context Team (highest priority) &rarr; Team Template &rarr; Shared Team. PTC recommends using context teams.',
        'Context teams override templates.') +
      misconceptionCard('License groups and team roles are the same',
        'License groups control <em>feature access</em> (can you use the change module at all?). Team roles control <em>object access</em> (what can you do to this specific document?). Both gates must pass.',
        'License = features. Roles = object access.') +
      misconceptionCard('Content groups are optional',
        'Every context has at least a <strong>Default</strong> content group. Custom content groups let you differentiate permissions by object type or state. Without them, all objects get the same ACP rules.',
        'Default content group always exists.') +
    '</div>';
  }

  function misconceptionCard(myth, reality, tldr) {
    return '<div class="ref-mistake-card">' +
      '<div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:6px;display:flex;align-items:center;gap:6px;">' +
        '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,0.15);font-size:10px;">X</span>' +
        'Myth: ' + myth +
      '</div>' +
      '<div style="font-size:12px;color:#cbd5e1;line-height:1.6;margin-bottom:6px;">' + reality + '</div>' +
      '<div style="font-size:11px;color:#22c55e;font-weight:600;">TL;DR: ' + tldr + '</div>' +
    '</div>';
  }

  // ============================================================
  // PAGE 2: Access Control Deep-Dive
  // ============================================================
  function renderAccessControl() {
    var html = '';

    html += '<h1 class="sec-title">Access Control: Domains, Policies & Rules</h1>' +
      '<p class="sec-desc">A deep-dive into the three access control strategies -- Domain Policies, Ad Hoc Permissions, and Security Labels -- and how to configure them. Based on the PTC Windchill Access Control training.</p>';

    // --- Three Strategies ---
    html += '<h2 class="ref-section-title">Three Access Control Strategies</h2>' +
      '<div class="ref-concepts">' +
      conceptCard(
        'blue',
        'Domain Policies',
        'Rules applied to all objects of a type within a storage context.',
        '<p>The <strong>primary</strong> method for controlling access. Domain rules are defined per object type and apply to every object of that type within the domain.</p>' +
        '<ul>' +
          '<li>Defined in the <strong>Policy Administrator</strong></li>' +
          '<li>Can grant, deny, or absolutely deny permissions</li>' +
          '<li>Inherited through the domain hierarchy</li>' +
          '<li>Affect access control, indexing, and notifications</li>' +
        '</ul>' +
        '<p style="margin-top:6px;"><strong>Use domain policies to establish default behavior for object types.</strong></p>'
      ) +
      conceptCard(
        'orange',
        'Ad Hoc Permissions',
        'Object-level grants that override domain policies for individual objects.',
        '<p>Temporary or case-specific access on a single object instance.</p>' +
        '<ul>' +
          '<li><strong>Can only grant</strong> -- never deny</li>' +
          '<li>Applied via lifecycle states or Edit Access Control</li>' +
          '<li>Override domain policy rules (except Absolute Deny)</li>' +
          '<li>Cannot override security labels</li>' +
        '</ul>' +
        '<p style="margin-top:6px;">Use <strong>sparingly</strong> for process-driven or discretionary access.</p>'
      ) +
      conceptCard(
        'purple',
        'Security Labels',
        'Object-level classification that denies all access to unauthorized users.',
        '<p>The <strong>strongest</strong> access control mechanism. Overrides everything.</p>' +
        '<ul>' +
          '<li>Classifies objects (e.g., "Restricted", "Top Secret")</li>' +
          '<li>Denies all access to non-authorized participants</li>' +
          '<li>Cannot be overridden by domain or ad hoc rules</li>' +
          '<li>Exceptions only via <strong>Agreements</strong> (workflow-driven)</li>' +
        '</ul>' +
        '<p style="margin-top:6px;">Use for intellectual property protection and compliance.</p>'
      ) +
    '</div>';

    // --- Priority Hierarchy ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 class="ref-section-title">Access Control Priority Hierarchy</h2>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px;">The strongest applicable rule wins. Evaluated top-to-bottom -- the first matching rule takes precedence.</p>' +
      '<table class="ref-cheat-table">' +
        '<thead><tr><th style="width:50px;">#</th><th>Rule Source</th><th>Grant / Deny</th><th>Applies To</th><th>Strength</th></tr></thead>' +
        '<tbody>' +
          priorityRow(1, 'Security Label', 'Deny', 'Any user', 'ref-tag purple') +
          priorityRow(2, 'Absolute Deny (Domain)', 'Deny', 'Any user', 'ref-tag purple') +
          priorityRow(3, 'Ad Hoc Rule', 'Grant', 'Any ad hoc rule', 'ref-tag orange') +
          priorityRow(4, 'Domain Rule (Owner)', 'Grant', 'OWNER pseudo-role', 'ref-tag blue') +
          priorityRow(5, 'Domain Rule (Named User)', 'Deny', 'Specific user', 'ref-tag blue') +
          priorityRow(6, 'Domain Rule (Named User)', 'Grant', 'Specific user', 'ref-tag blue') +
          priorityRow(7, 'Domain Rule (Group/Role)', 'Deny', 'Group, role, or org', 'ref-tag blue') +
          priorityRow(8, 'Domain Rule (Group/Role)', 'Grant', 'Group, role, or org', 'ref-tag blue') +
          '<tr><td style="color:#64748b;">--</td><td style="font-weight:600;color:#ef4444;">Default Deny</td><td style="color:#ef4444;">Deny</td><td style="color:#94a3b8;">N/A -- no rule matched</td><td><span class="ref-tag" style="background:rgba(239,68,68,0.15);color:#ef4444;">Weakest</span></td></tr>' +
        '</tbody>' +
      '</table>' +
      '<div class="ref-insight" style="margin-top:12px;">' +
        '<p style="font-size:12px;color:#cbd5e1;line-height:1.7;"><strong>Key rule:</strong> If a participant has both a Grant and a Deny for the same permission from domain rules at the same level (both are group-level rules), the permission is <strong>NOT granted</strong> (deny wins). An Absolute Deny cannot be overridden by anything except removing the rule itself.</p>' +
      '</div>' +
    '</div>';

    // --- Domain Architecture SVG ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 class="ref-section-title">Domain Architecture</h2>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px;">Every access-controlled object belongs to exactly one domain. Domains inherit rules from their parents up to /(Root).</p>' +
      '<div class="ref-diagram">' + renderDomainDiagram() + '</div>' +
    '</div>';

    // --- Domain Types ---
    html += '<div style="margin:20px 0 24px;">' +
      '<h2 class="ref-section-title">Domain Types</h2>' +
      '<div class="ref-mistakes-grid">' +
        domainTypeCard('/(Root)', 'Global rules governing the entire Windchill installation. All domains inherit from Root. Do not alter.', '#64748b') +
        domainTypeCard('User / Organization', 'Controls participants (users, groups, orgs). Do not alter -- defaults are required for proper operation.', '#64748b') +
        domainTypeCard('System', 'Per-context domain for administrative templates (lifecycles, workflows, team templates). Do not alter.', '#64748b') +
        domainTypeCard('Data Domains (Default, PDM, Project)', 'Where you spend most effort. Controls access to parts, documents, CAD data. Safe to customize.', '#22c55e') +
        domainTypeCard('Private', 'Bypasses PDM/Project global rules for private Products/Libraries. Enables restrictive per-context policies.', '#f59e0b') +
        domainTypeCard('Folder Domains', 'Manually created and assigned to specific folders. Overrides the parent context domain for that folder.', '#f59e0b') +
      '</div>' +
    '</div>';

    // --- Five Components of a Rule ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 class="ref-section-title">Five Components of an Access Control Rule</h2>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px;">Every domain access control rule answers five questions.</p>' +
      '<div class="ref-rule-components">' +
        ruleComponent(1, 'Where?', 'Domain & Context', 'Which domain does the rule apply to? Rules inherit through the domain hierarchy.', '#4ea8de') +
        ruleComponent(2, 'What?', 'Object Type', 'Which type of object (WTDocument, WTPart, etc.)? Applies to the type and all its subtypes.', '#7ec98f') +
        ruleComponent(3, 'When?', 'Lifecycle State', 'All states, or a specific state (e.g., Released, Under Review, Creation)?', '#f4a261') +
        ruleComponent(4, 'Who?', 'Participant', 'A user, group, organization, role, pseudo-role (All, Owner), or "all except" a participant.', '#c084fc') +
        ruleComponent(5, 'How?', 'Permission', 'Grant, Deny, or Absolute Deny for each permission (Read, Modify, Create, etc.).', '#ef4444') +
      '</div>' +
    '</div>';

    // --- Permissions Reference ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 class="ref-section-title">Permissions Reference</h2>' +
      '<table class="ref-cheat-table">' +
        '<thead><tr><th>Permission</th><th>Description</th><th>Notes</th></tr></thead>' +
        '<tbody>' +
          permRow('Full Control (All)', 'All permissions except Administrative', 'Use carefully -- very broad') +
          permRow('Read', 'View object in lists and detail pages', 'Most basic permission') +
          permRow('Download', 'Download content files and attachments', 'Requires Read') +
          permRow('Modify', 'Change non-identity attributes', 'Auto-selects Read + Download') +
          permRow('Modify Content', 'Upload/change content files, URLs', 'Auto-selects Modify') +
          permRow('Modify Identity', 'Change identity attributes (part number, etc.)', 'Distinct from Modify') +
          permRow('Create', 'Create new objects of this type', 'Auto-selects Modify, Read, Download') +
          permRow('Create by Move', 'Receive objects moved from another domain', 'Target domain permission') +
          permRow('Set State', 'Transition lifecycle state (non-admin)', 'Requires valid lifecycle transition') +
          permRow('Revise', 'Create a new version of an object', 'Common for Released objects') +
          permRow('Change Domain', 'Move object to a different domain', 'Source domain permission') +
          permRow('Change Context', 'Move object to a different Product/Library', 'Source context permission') +
          permRow('Change Permissions', 'Modify other users\' ad hoc permissions', 'Grants can only give permissions the user has') +
          permRow('Delete', 'Permanently remove the object', 'Use Absolute Deny to prevent') +
          permRow('Administrative', 'Admin tasks: break locks, change owner', 'NOT included in Full Control') +
        '</tbody>' +
      '</table>' +
    '</div>';

    // --- Case Studies ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 class="ref-section-title">Case Study: Grant vs. Deny Strategies</h2>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px;">Three approaches to the same requirement: each group gets exclusive read access to a specific document type. Click to compare.</p>' +
      renderCaseStudyTabs() +
    '</div>';

    // --- Ad Hoc Section ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 class="ref-section-title">Ad Hoc Access Control</h2>' +
      '<div class="ref-concepts" style="grid-template-columns:1fr 1fr;">' +
        conceptCard('green', 'Capabilities', 'What ad hoc can do',
          '<ul>' +
            '<li>Grant additional permissions on a <strong>single object</strong></li>' +
            '<li>Applied via <strong>lifecycle state</strong> transitions (temporary, process-driven)</li>' +
            '<li>Applied manually via <strong>Edit Access Control</strong> on an object</li>' +
            '<li>Overrides domain policy rules</li>' +
            '<li>Users with Change Permissions can grant others up to their own level</li>' +
          '</ul>') +
        conceptCard('orange', 'Limitations', 'What ad hoc cannot do',
          '<ul>' +
            '<li>Cannot <strong>deny</strong> -- only grant</li>' +
            '<li>Cannot override <strong>Security Labels</strong></li>' +
            '<li>Cannot override <strong>Absolute Deny</strong> domain rules</li>' +
            '<li>Only applies to a single object instance, not a type</li>' +
            '<li>Complex to audit across many objects</li>' +
          '</ul>') +
      '</div>' +
      '<div class="ref-insight" style="margin-top:12px;">' +
        '<p style="font-size:12.5px;color:#cbd5e1;line-height:1.7;"><strong>Best practice:</strong> Use lifecycle ad hoc rules for <em>process-driven</em> temporary access (e.g., granting reviewers Read during Under Review state). Use Edit Access Control for <em>discretionary</em> one-off grants. Keep ad hoc usage sparse to minimize administration complexity.</p>' +
      '</div>' +
    '</div>';

    // --- Security Labels ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 class="ref-section-title">Security Labels & Agreements</h2>' +
      '<div class="ref-concept-card ref-border-purple" style="margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
          '<span class="ref-tag purple">Strongest Rule</span>' +
          '<span style="font-size:13px;font-weight:700;color:#c084fc;">Security Labels override ALL other access control</span>' +
        '</div>' +
        '<div style="font-size:12px;color:#94a3b8;line-height:1.7;">' +
          '<p>Security labels classify objects and <strong>deny all access</strong> to unauthorized users, regardless of domain or ad hoc rules. They act as a gate: if the user is not cleared for all labels on an object, they cannot access it at all.</p>' +
          '<table class="ref-cheat-table" style="margin-top:12px;">' +
            '<thead><tr><th>Component</th><th>Description</th><th>Example</th></tr></thead>' +
            '<tbody>' +
              '<tr><td style="font-weight:600;color:#e2e8f0;">Label</td><td style="color:#94a3b8;">Classification category</td><td style="color:#94a3b8;">EXPORT CONTROL, CORPORATE PROPRIETARY</td></tr>' +
              '<tr><td style="font-weight:600;color:#e2e8f0;">Label Values</td><td style="color:#94a3b8;">Sensitivity levels within a label</td><td style="color:#94a3b8;">Public, Internal Only, Highly Trusted</td></tr>' +
              '<tr><td style="font-weight:600;color:#e2e8f0;">Participants</td><td style="color:#94a3b8;">Authorized users/groups per label value</td><td style="color:#94a3b8;">Internal Personnel group for "Internal Only"</td></tr>' +
              '<tr><td style="font-weight:600;color:#e2e8f0;">Agreements</td><td style="color:#94a3b8;">Workflow-driven exceptions (lifecycle-controlled)</td><td style="color:#94a3b8;">NDA granting temporary access to labeled objects</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<p style="margin-top:10px;"><strong>Note:</strong> Being an authorized participant for a security label does not <em>grant</em> access -- it only removes the label\'s denial. The user must still have access via domain or ad hoc rules.</p>' +
        '</div>' +
      '</div>' +
    '</div>';

    // --- Troubleshooting ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 class="ref-section-title">Troubleshooting Access Issues</h2>' +
      '<div class="ref-rule-components">' +
        ruleComponent(1, 'Check', 'License Group', 'Does the user have a license group at all? No license = no Windchill access.', '#ef4444') +
        ruleComponent(2, 'Check', 'Context Team', 'Is the user\'s group on the Product context team? If not, they\'re a Guest.', '#f4a261') +
        ruleComponent(3, 'Check', 'Domain Rules', 'Use Policy Admin &rarr; View Access Control List to see combined rules for a type/state.', '#4ea8de') +
        ruleComponent(4, 'Check', 'Ad Hoc Rules', 'Object &rarr; Actions &rarr; Edit Access Control &rarr; View Access Information for the user.', '#7ec98f') +
        ruleComponent(5, 'Check', 'Security Labels', 'Is the object labeled? If so, is the user an authorized participant for that label?', '#c084fc') +
      '</div>' +
    '</div>';

    html += renderNavButtons();
    document.getElementById("main").innerHTML = html;
    highlightActiveCaseStudy();
  }

  // --- Access Control sub-renderers ---

  function priorityRow(num, source, grantDeny, appliesTo, tagClass) {
    var color = grantDeny === 'Deny' ? '#ef4444' : '#22c55e';
    return '<tr><td style="font-weight:700;color:#64748b;">' + num + '</td>' +
      '<td style="font-weight:600;color:#e2e8f0;">' + source + '</td>' +
      '<td style="color:' + color + ';font-weight:600;">' + grantDeny + '</td>' +
      '<td style="color:#94a3b8;">' + appliesTo + '</td>' +
      '<td><span class="' + tagClass + '">' + (num <= 2 ? 'Strongest' : num <= 4 ? 'Strong' : 'Normal') + '</span></td></tr>';
  }

  function domainTypeCard(name, desc, accentColor) {
    return '<div class="ref-mistake-card" style="border-left:3px solid ' + accentColor + ';">' +
      '<div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:4px;">' + name + '</div>' +
      '<div style="font-size:12px;color:#94a3b8;line-height:1.6;">' + desc + '</div>' +
    '</div>';
  }

  function ruleComponent(num, label, title, desc, color) {
    return '<div class="ref-rule-comp">' +
      '<div class="ref-rule-num" style="background:' + color + ';">' + num + '</div>' +
      '<div>' +
        '<div style="font-size:10px;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>' +
        '<div style="font-size:13px;font-weight:600;color:#e2e8f0;margin:2px 0;">' + title + '</div>' +
        '<div style="font-size:11.5px;color:#94a3b8;line-height:1.6;">' + desc + '</div>' +
      '</div>' +
    '</div>';
  }

  function permRow(perm, desc, notes) {
    return '<tr><td style="font-weight:600;color:#e2e8f0;white-space:nowrap;">' + perm + '</td>' +
      '<td style="color:#cbd5e1;">' + desc + '</td>' +
      '<td style="color:#64748b;font-size:11px;">' + notes + '</td></tr>';
  }

  function renderDomainDiagram() {
    return '<svg viewBox="0 0 700 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">' +
      '<defs>' +
        '<marker id="ref-darrow" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0, 6 2.5, 0 5" fill="#475569"/></marker>' +
      '</defs>' +
      '<rect width="700" height="300" rx="12" fill="#0f172a"/>' +

      // Root
      '<rect x="290" y="10" width="120" height="36" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1"/>' +
      '<text x="350" y="33" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="700">/ (Root)</text>' +

      // Level 2: User, Default, System, Private
      '<line x1="320" y1="46" x2="120" y2="75" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +
      '<line x1="340" y1="46" x2="280" y2="75" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +
      '<line x1="360" y1="46" x2="420" y2="75" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +
      '<line x1="380" y1="46" x2="560" y2="75" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +

      '<rect x="60" y="76" width="120" height="32" rx="5" fill="rgba(100,116,139,0.1)" stroke="#64748b" stroke-width="1"/>' +
      '<text x="120" y="97" text-anchor="middle" fill="#64748b" font-size="10">User</text>' +

      '<rect x="220" y="76" width="120" height="32" rx="5" fill="rgba(34,197,94,0.08)" stroke="#22c55e" stroke-width="1.5"/>' +
      '<text x="280" y="97" text-anchor="middle" fill="#22c55e" font-size="10" font-weight="600">Org Default</text>' +

      '<rect x="360" y="76" width="120" height="32" rx="5" fill="rgba(100,116,139,0.1)" stroke="#64748b" stroke-width="1"/>' +
      '<text x="420" y="97" text-anchor="middle" fill="#64748b" font-size="10">System</text>' +

      '<rect x="500" y="76" width="120" height="32" rx="5" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="1.5"/>' +
      '<text x="560" y="97" text-anchor="middle" fill="#f59e0b" font-size="10" font-weight="600">Private</text>' +

      // Level 3 from Org Default: PDM, Project
      '<line x1="260" y1="108" x2="200" y2="140" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +
      '<line x1="300" y1="108" x2="360" y2="140" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +

      '<rect x="140" y="141" width="120" height="32" rx="5" fill="rgba(78,168,222,0.08)" stroke="#4ea8de" stroke-width="1.5"/>' +
      '<text x="200" y="162" text-anchor="middle" fill="#4ea8de" font-size="10" font-weight="600">PDM</text>' +

      '<rect x="300" y="141" width="120" height="32" rx="5" fill="rgba(78,168,222,0.08)" stroke="#4ea8de" stroke-width="1.5"/>' +
      '<text x="360" y="162" text-anchor="middle" fill="#4ea8de" font-size="10" font-weight="600">Project</text>' +

      // Level 4: Product Default (public) under PDM, Product Default (private) under Private
      '<line x1="200" y1="173" x2="160" y2="205" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +
      '<rect x="90" y="206" width="140" height="36" rx="5" fill="rgba(34,197,94,0.08)" stroke="#22c55e" stroke-width="1.5"/>' +
      '<text x="160" y="222" text-anchor="middle" fill="#22c55e" font-size="9" font-weight="600">Product Default</text>' +
      '<text x="160" y="235" text-anchor="middle" fill="#64748b" font-size="8">(Public Product)</text>' +

      '<line x1="560" y1="108" x2="480" y2="205" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +
      '<rect x="410" y="206" width="140" height="36" rx="5" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="1.5"/>' +
      '<text x="480" y="222" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="600">Product Default</text>' +
      '<text x="480" y="235" text-anchor="middle" fill="#64748b" font-size="8">(Private Product)</text>' +

      // Folder domain under public product
      '<line x1="160" y1="242" x2="160" y2="260" stroke="#475569" stroke-width="1" marker-end="url(#ref-darrow)"/>' +
      '<rect x="90" y="261" width="140" height="28" rx="5" fill="rgba(192,132,252,0.08)" stroke="#c084fc" stroke-width="1" stroke-dasharray="4 2"/>' +
      '<text x="160" y="280" text-anchor="middle" fill="#c084fc" font-size="9">Folder Domain (optional)</text>' +

      // Legend
      '<text x="595" y="145" fill="#64748b" font-size="8">Legend:</text>' +
      '<rect x="595" y="150" width="8" height="8" rx="1" fill="rgba(34,197,94,0.3)"/>' +
      '<text x="608" y="158" fill="#94a3b8" font-size="8">Customize</text>' +
      '<rect x="595" y="164" width="8" height="8" rx="1" fill="rgba(100,116,139,0.3)"/>' +
      '<text x="608" y="172" fill="#94a3b8" font-size="8">Do not alter</text>' +
      '<rect x="595" y="178" width="8" height="8" rx="1" fill="rgba(245,158,11,0.3)"/>' +
      '<text x="608" y="186" fill="#94a3b8" font-size="8">Use with care</text>' +

    '</svg>';
  }

  // --- Case Study Tabs ---
  var CASE_STUDIES = {
    grant: {
      label: "Solution 3: Grant Only",
      tag: "Recommended",
      tagColor: "#22c55e",
      content:
        '<h3 style="font-size:14px;font-weight:700;color:#22c55e;margin-bottom:8px;">Grant-Based Strategy (PTC Recommended)</h3>' +
        '<p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Only grant permissions to the groups that need them. No rule = no access (default deny).</p>' +
        '<table class="ref-cheat-table">' +
          '<thead><tr><th>Domain</th><th>Type</th><th>State</th><th>Participant</th><th>Permission</th></tr></thead>' +
          '<tbody>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">WTDocument</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Documentation</td><td style="color:#22c55e;font-weight:600;">Grant Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">InvoiceDoc</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Invoice</td><td style="color:#22c55e;font-weight:600;">Grant Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">ContractDoc</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Contract</td><td style="color:#22c55e;font-weight:600;">Grant Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">EPMDocument</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Engineering</td><td style="color:#22c55e;font-weight:600;">Grant Read</td></tr>' +
          '</tbody>' +
        '</table>' +
        '<div class="ref-scenario-fix" style="margin-top:12px;">' +
          '<strong>Why this is best:</strong> Fewest rules, no deny conflicts, secure by default. If a new group is added, they have no access until explicitly granted. A user in both Invoice and Contract groups gets access to both types without conflicts.' +
        '</div>'
    },
    deny: {
      label: "Solution 1: Deny",
      tag: "Problematic",
      tagColor: "#ef4444",
      content:
        '<h3 style="font-size:14px;font-weight:700;color:#ef4444;margin-bottom:8px;">Deny-Based Strategy (Not Recommended)</h3>' +
        '<p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Grant broad access, then deny specific groups. Leads to conflicts.</p>' +
        '<table class="ref-cheat-table">' +
          '<thead><tr><th>Domain</th><th>Type</th><th>State</th><th>Participant</th><th>Permission</th></tr></thead>' +
          '<tbody>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">WTObject</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Design Group</td><td style="color:#22c55e;">Grant Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">WTDocument</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Engineering</td><td style="color:#ef4444;font-weight:600;">Deny Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">EPMDocument</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Documentation</td><td style="color:#ef4444;font-weight:600;">Deny Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">InvoiceDoc</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Contract</td><td style="color:#ef4444;font-weight:600;">Deny Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">ContractDoc</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Invoice</td><td style="color:#ef4444;font-weight:600;">Deny Read</td></tr>' +
          '</tbody>' +
        '</table>' +
        '<div class="ref-scenario-fix" style="margin-top:12px;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.04);">' +
          '<strong style="color:#ef4444;">Problems:</strong> A user in both Invoice and Contract groups gets denied access to both types (deny wins over grant). New subgroups inherit broad access unintentionally.' +
        '</div>'
    },
    inverse: {
      label: "Solution 2: Inverse Deny",
      tag: "Better",
      tagColor: "#f59e0b",
      content:
        '<h3 style="font-size:14px;font-weight:700;color:#f59e0b;margin-bottom:8px;">Inverse Deny Strategy (Improved but Complex)</h3>' +
        '<p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Grant broad access, then deny everyone <em>except</em> the authorized group for each type.</p>' +
        '<table class="ref-cheat-table">' +
          '<thead><tr><th>Domain</th><th>Type</th><th>State</th><th>Participant</th><th>Applies To</th><th>Permission</th></tr></thead>' +
          '<tbody>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">WTObject</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Design Group</td><td style="color:#94a3b8;">Participant</td><td style="color:#22c55e;">Grant Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">WTDocument</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Documentation</td><td style="color:#f59e0b;font-weight:600;">All Except</td><td style="color:#ef4444;">Deny Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">EPMDocument</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Engineering</td><td style="color:#f59e0b;font-weight:600;">All Except</td><td style="color:#ef4444;">Deny Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">InvoiceDoc</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Invoice</td><td style="color:#f59e0b;font-weight:600;">All Except</td><td style="color:#ef4444;">Deny Read</td></tr>' +
            '<tr><td style="color:#e2e8f0;">Default</td><td style="color:#e2e8f0;">ContractDoc</td><td style="color:#94a3b8;">All</td><td style="color:#e2e8f0;">Contract</td><td style="color:#f59e0b;font-weight:600;">All Except</td><td style="color:#ef4444;">Deny Read</td></tr>' +
          '</tbody>' +
        '</table>' +
        '<div class="ref-scenario-fix" style="margin-top:12px;border-color:rgba(245,158,11,0.3);background:rgba(245,158,11,0.04);">' +
          '<strong style="color:#f59e0b;">Trade-off:</strong> Fixes the multi-group conflict from Solution 1, but uses more rules and is harder to read. New subgroups still inherit broad access. Grant-only (Solution 3) is simpler.' +
        '</div>'
    }
  };

  function renderCaseStudyTabs() {
    var tabsHtml = '<div class="ref-flow-tabs">';
    for (var id in CASE_STUDIES) {
      var cs = CASE_STUDIES[id];
      tabsHtml += '<button class="ref-flow-tab ref-cs-tab' + (id === activeCaseStudy ? ' active' : '') + '" data-casestudy="' + id + '" onclick="WCAI.referenceApp.switchCaseStudy(\'' + id + '\')">' +
        cs.label + '</button>';
    }
    tabsHtml += '</div>';
    tabsHtml += '<div class="ref-flow-panels">';
    for (var sid in CASE_STUDIES) {
      tabsHtml += '<div class="ref-flow-panel ref-cs-panel' + (sid === activeCaseStudy ? ' active' : '') + '" data-cspanel="' + sid + '">' + CASE_STUDIES[sid].content + '</div>';
    }
    tabsHtml += '</div>';
    return tabsHtml;
  }

  function switchCaseStudy(id) {
    activeCaseStudy = id;
    highlightActiveCaseStudy();
  }

  function highlightActiveCaseStudy() {
    var tabs = document.querySelectorAll('.ref-cs-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-casestudy') === activeCaseStudy) tabs[i].classList.add('active');
      else tabs[i].classList.remove('active');
    }
    var panels = document.querySelectorAll('.ref-cs-panel');
    for (var j = 0; j < panels.length; j++) {
      if (panels[j].getAttribute('data-cspanel') === activeCaseStudy) panels[j].classList.add('active');
      else panels[j].classList.remove('active');
    }
  }

  // ============================================================
  // Export
  // ============================================================
  WCAI.referenceApp = {
    STEPS_REFERENCE: STEPS_REFERENCE,
    render: render,
    switchScenario: switchScenario,
    switchCaseStudy: switchCaseStudy
  };
})();
