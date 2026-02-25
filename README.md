# WCAI -- Windchill Config AI

Define your company's Windchill setup **once** in YAML, then auto-generate all deployment artifacts.

## The Problem

Every Windchill implementation requires manually clicking through Policy Admin, Team Templates, Lifecycles, Workflows, and Preferences. This is:
- Error-prone (miss a role assignment, things break silently)
- Not version-controlled (who changed that preference last month?)
- Not repeatable (standing up a new org means doing it all again)
- Not reviewable (no PR/code review for config changes)

## The Solution

A browser-based wizard that walks you through configuration and generates ready-to-deploy artifacts:

```
YAML config  →  WCAI Wizard (browser)  →  deployment artifacts (ZIP download)
```

You describe your org (people, groups, roles, preferences) in YAML. The tool generates:

| File | What it does |
|------|-------------|
| `oir_config.xml` | Object Initialization Rules -- binds change objects to lifecycles, workflows, team templates |
| `business_rules.xml` | Business rules, rule sets, and rule links for pre-release validation |
| `team_config.txt` | Team template spec with role-to-group mappings |
| `deploy_preferences.bat` | Sets all change management preferences via `wt.pref.PrefCmd` |
| `association_rules_spec.txt` | Target configuration for change object associations |
| `deploy_all.bat` | Master script that orchestrates everything in the correct order |

## Quick Start

No install required. Just open the wizard in your browser:

```bash
# Option 1: Open directly (works with file://)
open docs/index.html          # macOS
start docs/index.html         # Windows

# Option 2: Local server
cd docs && python -m http.server 8050
# Then open http://localhost:8050
```

The wizard has two modes (tab switcher in the sidebar):

1. **Teams & Participants** -- Guided checklist for org setup, users, license groups, groups, team templates, and context teams
2. **Change Management** -- 9-step wizard for config, validation, artifact generation, and post-deployment checklist

### Typical workflow

1. Click **Load Example (Acme)** to see a sample config
2. Edit each step to match your company
3. Click **Validate** to check for errors
4. Click **Generate** to create deployment artifacts
5. Download the ZIP and deploy to your Windchill server
6. Follow the **Post-Deployment Checklist** for manual steps

## YAML Config Structure

See `docs/configs/acme_engineering.yaml` for a fully commented example.

```yaml
company:
  name: "Your Company"
  org: "YourOrg"                    # Windchill OrgContainer
  site: "your-wc-server"
  context_level: "organization"     # site | organization
  lock_preferences: true
  use_flexible_change: true         # Windchill 11.2+

groups:
  - id: eng
    name: "Engineering"

people:
  - id: jsmith
    name: "Jane Smith"
    username: "jsmith"              # Must match Windchill login
    email: "jsmith@company.com"
    group: eng

roles:
  change_admin_1: [eng]
  change_admin_2: [mgmt]
  # ... see model.js for all 9 roles

preferences:
  cn_without_cr: "No"
  sequenced_plan: "Yes"
  # ... see model.js for all 8 preferences

associations:
  pr_to_cr:
    enabled: true
    cardinality: "many:1"
  # ... see model.js for all 4 association types
```

## Windchill Deployment

The generated `deploy_all.bat` runs 5 phases:

1. **OIR** -- `LoadFromFile` loads object initialization rules
2. **Business Rules** -- `LoadFromFile` loads rules, sets, and links
3. **Preferences** -- `PrefCmd` sets and locks all preferences
4. **Association Rules** -- Outputs spec for manual UI configuration
5. **Validation** -- Verifies OIR bindings loaded correctly

### What's still manual?

- **Team templates** -- Populated via Windchill UI (the spec file tells you exactly what to configure)
- **Context team assignments** -- Done per Product/Library in the UI
- **Association rules** -- Created via Site/Org -> Utilities -> Business Rules
- **Access control policies** -- Defined per lifecycle state in Policy Admin

These are documented in the generated spec files and the post-deployment checklist so nothing gets missed.

## Architecture

```
docs/
  index.html              # Single-page app shell
  css/style.css           # All styles
  js/
    model.js              # Windchill data model (roles, objects, prefs)
    loader.js             # YAML parser with defaults and normalization
    validators.js         # Config validation with actionable error messages
    generators.js         # XML and .bat script generators (in-browser)
    teams-model.js        # Teams & Participants wizard model
    teams-validators.js   # Teams & Participants validation
    teams-app.js          # Teams & Participants wizard UI
    app.js                # Main application (wizard, state, rendering)
  configs/
    acme_engineering.yaml # Example config
    company_config.yaml   # Minimal example config
```

Static vanilla JS -- no build step, no framework, no server required. Uses js-yaml and JSZip from CDN.
