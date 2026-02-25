/**
 * WCAI -- Reference -- Access Model & Educational Content
 * ========================================================
 * Reference tab with Windchill access model concepts, interactive
 * scenarios, cheat sheet, and common misconceptions.
 * Attached to window.WCAI.referenceApp.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};

  var STEPS_REFERENCE = [
    { id: "ref_access_model", label: "Access Model" }
  ];

  var activeScenario = "new_user";

  function render(stepIndex) {
    if (stepIndex === 0) renderAccessModel();
  }

  // ============================================================
  // Access Model Page
  // ============================================================
  function renderAccessModel() {
    var html = '';

    // --- Header ---
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

    // --- How It All Connects (SVG Diagram) ---
    html += '<div style="margin:28px 0 24px;">' +
      '<h2 style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:12px;">How the Three Systems Connect</h2>' +
      '<div class="ref-diagram">' + renderDiagram() + '</div>' +
    '</div>';

    // --- Access Control Policy Callout ---
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

    // --- Nav buttons ---
    html += renderNavButtons();

    document.getElementById("main").innerHTML = html;

    // Wire up scenario tabs after render
    highlightActiveScenario();
  }

  // ============================================================
  // Concept Card Helper
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

  // ============================================================
  // SVG Diagram
  // ============================================================
  function renderDiagram() {
    return '<svg viewBox="0 0 700 320" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">' +
      '<defs>' +
        '<marker id="ref-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker>' +
      '</defs>' +

      // Background
      '<rect width="700" height="320" rx="12" fill="#0f172a"/>' +

      // User box
      '<rect x="20" y="130" width="100" height="60" rx="8" fill="#1e293b" stroke="#64748b" stroke-width="1"/>' +
      '<text x="70" y="155" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="700">User</text>' +
      '<text x="70" y="172" text-anchor="middle" fill="#64748b" font-size="9">(jsmith)</text>' +

      // Arrow: User -> Context
      '<line x1="120" y1="160" x2="188" y2="160" stroke="#64748b" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +
      '<text x="154" y="152" text-anchor="middle" fill="#475569" font-size="8">enters</text>' +

      // Context box
      '<rect x="190" y="110" width="150" height="100" rx="8" fill="rgba(78,168,222,0.08)" stroke="#4ea8de" stroke-width="1.5"/>' +
      '<text x="265" y="135" text-anchor="middle" fill="#4ea8de" font-size="10" font-weight="700">APPLICATION CONTEXT</text>' +
      '<text x="265" y="155" text-anchor="middle" fill="#e2e8f0" font-size="11">Product / Library</text>' +
      '<text x="265" y="175" text-anchor="middle" fill="#64748b" font-size="9">Context Team evaluates</text>' +
      '<text x="265" y="190" text-anchor="middle" fill="#64748b" font-size="9">Guest vs. Member</text>' +

      // Arrow: Context -> Role
      '<line x1="340" y1="140" x2="408" y2="90" stroke="#f4a261" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +
      '<text x="385" y="105" text-anchor="middle" fill="#475569" font-size="8">assigns</text>' +

      // Role box
      '<rect x="410" y="50" width="130" height="80" rx="8" fill="rgba(244,162,97,0.08)" stroke="#f4a261" stroke-width="1.5"/>' +
      '<text x="475" y="75" text-anchor="middle" fill="#f4a261" font-size="10" font-weight="700">ROLE</text>' +
      '<text x="475" y="95" text-anchor="middle" fill="#e2e8f0" font-size="11">Change Admin I</text>' +
      '<text x="475" y="112" text-anchor="middle" fill="#64748b" font-size="9">via Group membership</text>' +

      // Arrow: Context -> Content Group
      '<line x1="340" y1="180" x2="408" y2="220" stroke="#7ec98f" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +
      '<text x="385" y="208" text-anchor="middle" fill="#475569" font-size="8">scopes</text>' +

      // Content Group box
      '<rect x="410" y="190" width="130" height="80" rx="8" fill="rgba(126,201,143,0.08)" stroke="#7ec98f" stroke-width="1.5"/>' +
      '<text x="475" y="215" text-anchor="middle" fill="#7ec98f" font-size="10" font-weight="700">CONTENT GROUP</text>' +
      '<text x="475" y="235" text-anchor="middle" fill="#e2e8f0" font-size="11">CAD Data</text>' +
      '<text x="475" y="252" text-anchor="middle" fill="#64748b" font-size="9">Object type / state filter</text>' +

      // Arrow: Role -> ACP
      '<line x1="540" y1="100" x2="588" y2="140" stroke="#c084fc" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +

      // Arrow: Content Group -> ACP
      '<line x1="540" y1="225" x2="588" y2="185" stroke="#c084fc" stroke-width="1.5" marker-end="url(#ref-arrow)"/>' +

      // ACP box
      '<rect x="590" y="120" width="95" height="80" rx="8" fill="rgba(192,132,252,0.08)" stroke="#c084fc" stroke-width="1.5"/>' +
      '<text x="637" y="148" text-anchor="middle" fill="#c084fc" font-size="9" font-weight="700">ACCESS CONTROL</text>' +
      '<text x="637" y="162" text-anchor="middle" fill="#c084fc" font-size="9" font-weight="700">POLICY</text>' +
      '<text x="637" y="182" text-anchor="middle" fill="#e2e8f0" font-size="10">Grant / Deny</text>' +

    '</svg>';
  }

  // ============================================================
  // Interactive Scenarios
  // ============================================================
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

  function scenarioStep(num, color, text) {
    return '<div class="ref-scenario-step">' +
      '<span class="ref-step-num ref-bg-' + color + '">' + num + '</span>' +
      '<span style="font-size:12.5px;color:#cbd5e1;line-height:1.6;">' + text + '</span>' +
    '</div>';
  }

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
    // Update tabs
    var tabs = document.querySelectorAll('.ref-flow-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-scenario') === activeScenario) {
        tabs[i].classList.add('active');
      } else {
        tabs[i].classList.remove('active');
      }
    }
    // Update panels
    var panels = document.querySelectorAll('.ref-flow-panel');
    for (var j = 0; j < panels.length; j++) {
      if (panels[j].getAttribute('data-panel') === activeScenario) {
        panels[j].classList.add('active');
      } else {
        panels[j].classList.remove('active');
      }
    }
  }

  // ============================================================
  // Cheat Sheet
  // ============================================================
  function renderCheatSheet() {
    return '<table class="ref-cheat-table">' +
      '<thead><tr>' +
        '<th>Question</th>' +
        '<th>System</th>' +
        '<th>Where to Configure</th>' +
      '</tr></thead>' +
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

  // ============================================================
  // Common Misconceptions
  // ============================================================
  function renderMisconceptions() {
    return '<div class="ref-mistakes-grid">' +
      misconceptionCard(
        'Users are directly assigned to roles',
        'Users &rarr; Groups &rarr; Roles. Always use groups as the intermediary. Direct user assignment creates maintenance nightmares and breaks LDAP sync.',
        'Never assign users directly to team roles.'
      ) +
      misconceptionCard(
        'Access is global across all Products',
        'Access is evaluated <em>per context</em>. A user who is Change Admin I in Product A might be a Guest in Product B. Each Product/Library has its own context team.',
        'Check context team membership per Product.'
      ) +
      misconceptionCard(
        'Deny rules exist to block access',
        'Windchill uses a <strong>grant-only</strong> model. There are no explicit deny rules. If no ACP rule grants permission, access is denied by default. To restrict access, simply don\'t grant it.',
        'No permission granted = access denied.'
      ) +
      misconceptionCard(
        'Team templates replace context teams',
        'Team templates are <em>defaults</em> that context teams can override. The resolution order is: Context Team (highest priority) &rarr; Team Template &rarr; Shared Team. PTC recommends using context teams.',
        'Context teams override templates.'
      ) +
      misconceptionCard(
        'License groups and team roles are the same',
        'License groups control <em>feature access</em> (can you use the change module at all?). Team roles control <em>object access</em> (what can you do to this specific document?). Both gates must pass.',
        'License = features. Roles = object access.'
      ) +
      misconceptionCard(
        'Content groups are optional',
        'Every context has at least a <strong>Default</strong> content group. Custom content groups let you differentiate permissions by object type or state. Without them, all objects get the same ACP rules.',
        'Default content group always exists.'
      ) +
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
  // Nav Buttons
  // ============================================================
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
  // Export
  // ============================================================
  WCAI.referenceApp = {
    STEPS_REFERENCE: STEPS_REFERENCE,
    render: render,
    switchScenario: switchScenario
  };
})();
