# WCAI -- Windchill Config AI

## What This Project Is

An **implementation accelerator** for PTC Windchill. It takes a declarative YAML config describing your company's Windchill setup (org, groups, people, role mappings, preferences, association rules) and:

1. **Generates deployable Windchill artifacts** (OIR XML, business rules XML, preference scripts, deploy batch files)
2. **Provides a web-based wizard** for building the YAML config interactively
3. **Produces a post-deployment checklist** with exact Windchill navigation paths and best-practice guidance

The target user is a Windchill administrator who has completed PTC's Change Implementation training and needs to stand up a working change process quickly.

## Reference Material

The following PTC training document is the **authoritative source** for all Windchill change management knowledge in this project. Read it before making architectural decisions about the checklist or workflow:

- `docs/WCBA-TEAM-Training-Guide.pdf` - PTC training guide for teams and participants

Key diagrams (PNG files in project root, if present):
- `OUTOFTHEBOX_CHANGE_OBJECTS_DATA_MODEL.png` - PR, CR, CN, Variance relationships
- `CHANGE_MANAGEMENT_CONFIGURATION.png` - The 8 configurable components
- `CHANGE_ASSOCIATION_RULES.png` - How association rules are defined
- `CHANGE_REQUEST_LIFE_CYCLE_AND_WORKFLOW.png` - CR workflow states
- `CHANGE_REQUEST_PROCESS_FOR_OFFLINE_AND_ONLINE_CRB_PROCESSES.png` - CRB review tracks
- `PROBLEM_REPORT_LIFE_CYCLE_AND_WORKFLOW.png` - PR workflow states
- `CHANGE_PROCESS_IMPLEMENTATION_STRATEGY.png` - Phase 1 (Analysis) and Phase 2 (Build)
- `FLEXIBLE_CHANGE_ASSOCIATIONS.png` - Flexible change association model

---

## Windchill Change Management Knowledge Base

This section captures the implementation knowledge built up through multiple development sessions and validated against the PTC training material. **Claude Code should use this as its primary reference** for any Windchill-related decisions.

### The 4 Change Object Types

| Object | Java Type | Default Lifecycle | Default Workflow | Default Team Template |
|--------|-----------|-------------------|------------------|-----------------------|
| Problem Report | wt.change2.WTChangeIssue | Problem Report Life Cycle | Problem Report Workflow | Problem Report Team |
| Change Request | wt.change2.WTChangeRequest2 | Change Request Life Cycle | Change Request Workflow | Change Request Team |
| Change Notice | wt.change2.WTChangeOrder2 | Change Notice Life Cycle | Change Notice Workflow | Change Notice Team |
| Change Activity | wt.change2.WTChangeActivity2 | Change Activity Life Cycle | Change Activity Workflow | Change Activity Team |

The 5th lifecycle (Change Proposal Life Cycle) is required by the system as part of CR processing. PTC recommends leaving it unaltered.

### The 9 Change Management Roles

| Role | Used By | Description |
|------|---------|-------------|
| Change Admin I | PR Team, CR Team | Manages PRs, analyzes and triages CRs |
| Change Admin II | CR Team, CN Team | Creates CNs, manages CRB meetings, audits completion |
| Change Admin III | CN Team | Oversees CN execution and final release |
| Change Implementation | CN Team | Executes implementation plan tasks |
| Change Review Board | CR Team | Reviews and votes on CRs (eng, mfg, plant, procurement managers) |
| Problem Report Author | PR Team | Creates and submits PRs |
| Change Request Author | CR Team | Creates and submits CRs |
| Assignee | Activity Team | Assigned to individual CN tasks |
| Reviewer | Activity Team | Reviews CN task deliverables |

**CRITICAL: Change Admin II is shared** between Change Request Team and Change Notice Team. With context teams, this means the same group handles both. This is the key constraint that drives the "context teams vs override team templates" decision.

### Users -> Groups -> Roles Pattern

**Best practice: Never assign individual users directly to roles.** The pattern is:

```
Users -> Groups -> Roles (in team templates or context teams)
```

Reasons:
- **Maintainability** - update group membership in one place, all role assignments reflect the change
- **LDAP alignment** - if Windchill groups map to AD groups, membership syncs automatically
- **Auditability** - easier to audit who has access to what through named groups

### Team Templates: OOTB vs Override vs Context Teams

Windchill ships with **4 out-of-the-box team templates** at Site level, already bound to change objects through OIRs. They contain the correct role definitions but **no participants assigned**.

**Three approaches to populate roles with groups (ranked by PTC preference):**

#### Approach A: Context Teams (PTC PREFERRED)
- Assign groups to roles at each Product/Library level
- Uses the existing OOTB templates as-is (just edit to add groups)
- Easier to implement and maintain
- Limitation: Change Admin II is the same group across both CR and CN workflows

> "The context team method is easier to implement and maintain."
> "It is preferable to specify participants in a context team."
> -- PTC Windchill Change Implementation Training Guide

#### Approach B: Override Team Templates at Org Level (ALTERNATIVE)
- Create team templates at your Org level with the **exact same names** as the Site-level ones
- The org-level template overrides the site-level one for that org
- Allows different group mappings per workflow (e.g., different Change Admin II for CR vs CN)
- More complex to maintain

#### Approach C: Customize Workflow Role Names (ADVANCED)
- Modify workflows so they don't share role names
- Enables context team method while separating participants per workflow
- Requires workflow customization

### Correct Implementation Sequence

This sequence was validated through actual implementation and corrects several common mistakes:

```
Step 1:  Verify Organization Exists
         Site -> Utilities -> Organization Administration

Step 2:  Assign Organization Administrators
         Browse -> Organizations -> [Org] -> Administrators -> Add Users
         NOTE: Initially NO org admin is defined. Required before Steps 5, 9, 10.

Step 3:  Verify User Accounts Exist
         Site -> Utilities -> Participant Administration

Step 4:  Verify License Group Membership
         Site -> Utilities -> License Management
         Users not in a license group CANNOT access Windchill at all.
         Change management users need PTC Author or PTC PDMLink license.

Step 5:  Create Groups and Add Users to Groups
         [Org] -> Utilities -> Participant Administration -> Internal Groups -> Create
         [Org] -> Utilities -> Participant Administration -> Internal Groups -> [Group] -> Add Members
         NOTE: Groups cannot be created via LoadFromFile. Manual step only.

Step 6:  Add Groups to OOTB Team Template Roles
         Site -> Templates -> Team Templates -> [template name] -> Edit
         Populate each role in each of the 4 templates with your groups.

Step 7:  Configure Context Teams (per Product/Library)
         [Product/Library] -> Team -> Edit Team -> [Role] -> Add Group
         Override template defaults where Products differ.

Step 8:  Run Automated Deployment (deploy_all.bat)
         OIR via windchill wt.load.LoadFromFile
         Business Rules via windchill wt.load.LoadFromFile
         Preferences via windchill wt.pref.PrefCmd

Step 9:  Configure Association Rules
         [Org] -> Utilities -> Business Rules -> Change Association Rules
         Disable ALL OOB rules first, then create only what you need.

Step 10: Verify Access Control Policies
         [Org] -> Utilities -> Policy Administration -> Access Control

Step 11: End-to-End Test
         PR Author creates PR -> Change Admin I creates CR -> CRB reviews ->
         Change Admin II creates CN -> Assignees complete tasks -> Reviewers verify ->
         Change Admin II audits and releases
```

**Common mistakes this sequence prevents:**
- Trying to create team templates before users are in groups (users won't appear in search)
- Creating new team templates instead of editing the OOTB ones
- Assigning individual users instead of groups to roles
- Running deploy scripts before org/group/team setup is complete
- Leaving OOB association rules enabled (PTC recommends disabling them)

### Association Rules

PTC explicitly recommends disabling OOB rules and creating only what your process needs:

> "In most cases, PTC recommends customers to disable the out-of-the-box rules and define the rules they want for their change process."

Standard rules for a typical process:
- Problem Report -> Change Request (many:1)
- Change Request -> Change Notice (many:1)
- Change Notice -> Change Activity (1:many)

Optional shortcut:
- Problem Report -> Change Notice (many:1) - bypasses CR for urgent changes

### 8 Change Management Preferences

| Preference | Default | Description |
|-----------|---------|-------------|
| Change Notices without Change Requests | No | Allow CN creation without CR |
| Automatic Change Notice Creation | No | Auto-create CN from CR task page |
| Change Information Propagation | No | Propagate data between change objects |
| Change Request to Change Notice Cardinality | No | Allow many CRs to many CNs |
| Change Request to Problem Report Cardinality | No | Allow many CRs to many PRs |
| Optional Assignee and Reviewer States | No | Make assignee/reviewer optional at certain states |
| Optional Review Allowed | No | Plan tasks without requiring review |
| Sequenced Plan Execution Order | No | Sequence task execution in implementation plan |

Note: Some preferences (Automatic CN Creation, CN without CR, CR-to-CN Cardinality, CR-to-PR Cardinality) have no effect for flexible change items but remain functional for non-flexible items.

### What Can Be Automated via CLI

| Component | CLI Method | Can Automate? |
|-----------|-----------|---------------|
| OIR | windchill wt.load.LoadFromFile | Yes |
| Business Rules | windchill wt.load.LoadFromFile | Yes |
| Preferences | windchill wt.pref.PrefCmd | Yes |
| Groups/Users | N/A | No - Windchill UI only |
| Team Template Participants | N/A | No - Windchill UI only |
| Context Teams | N/A | No - Windchill UI only |
| Association Rules | N/A | No - Windchill UI only |
| Access Control Policies | N/A | No - Windchill UI only |

### Windchill Server Environment

- Server runs **Windows**
- Deployment scripts must be **.bat** files (not bash)
- Windchill shell is pre-configured - no need to source environment scripts
- Deploy by: copy downloaded artifacts to server, open Windchill shell, cd to folder, run deploy_all.bat
- All generated output must be **ASCII-only** - Windows console cannot render Unicode box-drawing characters

---

## Project Architecture

### Overview

This is a **static vanilla web application** hosted from the `docs/` folder. No server required -- it runs entirely in the browser (works with `file://` or any static server, including GitHub Pages). All config loading, validation, generation, and artifact download happen client-side in JavaScript.

### File Structure

```
docs/
  index.html                      # Single-page app shell with sidebar + main area
  css/
    style.css                     # All styles
  js/
    model.js                      # Windchill data model & constants (change objects, roles, preferences)
    loader.js                     # YAML config parser (uses js-yaml CDN)
    validators.js                 # Config validation (checks groups, roles, associations)
    generators.js                 # Generates OIR XML, business rules XML, .bat scripts in-browser
    teams-model.js                # Teams & Participants companion wizard model
    teams-validators.js           # Teams & Participants validation
    teams-app.js                  # Teams & Participants wizard UI
    app.js                        # Main application: wizard steps, rendering, state management
  configs/
    acme_engineering.yaml         # Example YAML config (loaded via fetch or embedded)
    company_config.yaml           # Minimal example config
```

### CDN Dependencies

Loaded via `<script>` tags in `index.html`:
- **js-yaml 4.1.0** - YAML parsing/serialization
- **JSZip 3.10.1** - ZIP file creation for artifact download

### Module Pattern

All JS uses an IIFE module pattern attaching to `window.WCAI`:
- `WCAI.model` - constants, change objects, roles, preferences
- `WCAI.loader` - YAML parsing
- `WCAI.validators` - validation logic
- `WCAI.generators` - artifact generation
- `WCAI.teamsModel` - teams wizard model
- `WCAI.teamsValidators` - teams wizard validation
- `WCAI.teamsApp` - teams wizard UI
- `WCAI.app` - main application (init, routing, rendering, state)

Script load order in `index.html` matters (model -> loader -> validators -> generators -> teams-* -> app).

### Two Wizard Modes

The app has a **tab switcher** in the sidebar toggling between two wizards:

**Teams & Participants Wizard** (default tab):
- Guides through org setup, user verification, license groups, group creation, team template population, and context teams
- Interactive checklist with best-practice panels

**Change Management Wizard** (9 steps):
1. Company & Org
2. Groups
3. People
4. Role Mapping (groups to roles via clickable chips)
5. Preferences (toggle switches for 8 change mgmt prefs)
6. Associations (enable/disable with cardinality)
7. Validate (runs client-side validators, shows errors/warnings)
8. Generate (creates deployment artifacts, download as ZIP)
9. Post-Deployment Checklist (interactive, with best-practice panels)

### State Management

- All state persisted to **localStorage** (config, checklist progress, current step, active wizard)
- Storage keys prefixed with `wcai_` and `wcai_teams_`
- "Reset All" clears localStorage and reinitializes

### Generated Artifacts (client-side)

| File | Purpose |
|------|---------|
| oir_config.xml | 4 OIR rules binding change objects to lifecycles/workflows/templates |
| business_rules.xml | CHANGEABLE_PRE_RELEASE rule set + 2 rules + 2 rule links |
| team_config.txt | Documentation of team template structure |
| deploy_preferences.bat | 8 windchill wt.pref.PrefCmd commands |
| association_rules_spec.txt | Guide for manual association rule setup |
| deploy_all.bat | Master deployment script (5 phases, --dry-run support, logging) |

All generated in-browser by `generators.js` and downloadable as a ZIP via JSZip.

### YAML Config Schema

```yaml
company:
  name: "Company Name"
  org: "WindchillOrgName"
  site: "wc-prod"
  context_level: organization    # organization | product | site
  lock_preferences: true
  use_flexible_change: true

groups:
  - id: eng
    name: Engineering
    description: Engineering team
  - id: mgmt
    name: Management

people:
  - id: jsmith
    name: Jane Smith
    username: jsmith
    email: jsmith@company.com
    group: eng                   # References group id

roles:                           # Maps roles to GROUP IDs (not people)
  change_admin_1:
    - eng
  change_admin_2:
    - mgmt
  change_review_board:
    - mgmt
    - eng

preferences:
  cn_without_cr: "No"
  auto_cn_creation: "No"
  # ... (8 total)

associations:
  pr_to_cr:
    enabled: true
    cardinality: "many:1"
  cr_to_cn:
    enabled: true
    cardinality: "many:1"
  cn_to_task:
    enabled: true
    cardinality: "1:many"
  pr_to_cn:
    enabled: false
```

---

## Development Notes

### Running the App

No build step or server required. Just open `docs/index.html` in a browser:

```bash
# Option 1: Direct file open
open docs/index.html          # macOS
start docs/index.html         # Windows

# Option 2: Local server (if fetch() for configs needs HTTP)
cd docs && python -m http.server 8050
```

The example config is embedded in `app.js` for `file://` compatibility, so no server is strictly required.

### Testing Changes

- Edit JS/CSS/HTML files in `docs/`, refresh the browser
- Browser F12 console shows JS errors
- Validation runs client-side on the Generate step

### ASCII Requirement for Generated Artifacts

All generated deployment artifacts (.bat, .xml, .txt) must be ASCII-only. No Unicode box-drawing characters, checkmarks, arrows, or em-dashes. The Windows console (cmd.exe) on the Windchill server cannot render them. This constraint applies to `generators.js` output.
