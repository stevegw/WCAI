# WCAI -- Windchill Config AI

Define your company's Windchill setup **once** in YAML, then auto-generate all deployment artifacts.

## The Problem

Every Windchill implementation requires manually clicking through Policy Admin, Team Templates, Lifecycles, Workflows, and Preferences. This is:
- Error-prone (miss a role assignment, things break silently)
- Not version-controlled (who changed that preference last month?)
- Not repeatable (standing up a new org means doing it all again)
- Not reviewable (no PR/code review for config changes)

## The Solution

```
company_config.yaml  →  wc-config generate  →  deployment artifacts
     (YAML)              (this tool)           (XML + shell scripts)
```

You describe your org (people, groups, roles, preferences) in a single YAML file. The tool generates:

| File | What it does |
|------|-------------|
| `oir_config.xml` | Object Initialization Rules — binds change objects to lifecycles, workflows, team templates |
| `business_rules.xml` | Business rules, rule sets, and rule links for pre-release validation |
| `team_config.txt` | Team template spec with role-to-person mappings |
| `deploy_preferences.sh` | Sets all change management preferences via `wt.pref.PrefCmd` |
| `association_rules_spec.txt` | Target configuration for change object associations |
| `deploy_all.sh` | Master script that orchestrates everything in the correct order |

## Quick Start

```bash
# Install
pip install -e .

# Option 1: Interactive wizard (walks you through everything)
wc-config wizard

# Option 2: Edit YAML directly (copy the example)
cp configs/examples/acme_engineering.yaml company_config.yaml
# ... edit to match your company ...

# Validate your config
wc-config validate -c company_config.yaml

# Generate deployment artifacts
wc-config generate -c company_config.yaml -o generated/

# Preview what would happen
cd generated/
bash deploy_all.sh --dry-run

# Deploy for real (on Windchill server)
source $WT_HOME/bin/adminTools/windchillenv.sh
bash deploy_all.sh
```

## CLI Commands

### `wc-config wizard`
Interactive step-by-step setup. Walks you through:
1. Company & organization details
2. Groups / departments
3. People (name, username, group)
4. Role mapping (who does what in the change process)
5. Change management preferences
6. Association rules (which change objects link together)

Saves a complete YAML config file.

```bash
wc-config wizard                          # creates company_config.yaml
wc-config wizard -o my_company.yaml       # custom output path
wc-config wizard -c existing.yaml         # resume/edit existing config
```

### `wc-config validate`
Checks your YAML for errors, warnings, and best-practice issues.

```bash
wc-config validate -c company_config.yaml
```

Validates:
- Required fields (company name, org, usernames)
- No duplicate IDs
- All role assignments reference real people
- Preference values are valid
- Association rules are logically consistent
- Critical roles have at least one person assigned

### `wc-config generate`
Produces all deployment artifacts from your config.

```bash
wc-config generate -c company_config.yaml              # output to generated/
wc-config generate -c company_config.yaml -o deploy/    # custom output dir
wc-config generate -c company_config.yaml --force       # skip validation
```

### `wc-config show`
Displays a formatted summary of your config.

```bash
wc-config show -c company_config.yaml
```

## YAML Config Structure

See `configs/examples/acme_engineering.yaml` for a fully commented example.

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
  change_admin_1: [jsmith]
  change_admin_2: [tpatel]
  # ... see model.py for all 9 roles

preferences:
  cn_without_cr: "No"
  sequenced_plan: "Yes"
  # ... see model.py for all 8 preferences

associations:
  pr_to_cr:
    enabled: true
    cardinality: "many:1"
  # ... see model.py for all 4 association types
```

## Windchill Deployment

The generated `deploy_all.sh` runs 5 phases:

1. **OIR** — `LoadFromFile` loads object initialization rules
2. **Business Rules** — `LoadFromFile` loads rules, sets, and links
3. **Preferences** — `PrefCmd` sets and locks all preferences
4. **Association Rules** — Outputs spec for manual UI configuration
5. **Validation** — Verifies OIR bindings loaded correctly

### What's still manual?
- **Team templates** — Created via Windchill UI (the spec file tells you exactly what to create)
- **Context team assignments** — Done per Product/Library in the UI
- **Association rules** — Created via Site/Org → Utilities → Business Rules
- **Access control policies** — Defined per lifecycle state in Policy Admin

These are documented in the generated spec files so nothing gets missed.

## Git Workflow

```
my-windchill-config/
├── company_config.yaml          ← version-controlled source of truth
├── generated/                   ← gitignored, regenerated on demand
│   ├── deploy_all.sh
│   ├── oir_config.xml
│   └── ...
├── configs/
│   └── examples/
│       └── acme_engineering.yaml
└── .gitignore
```

Suggested `.gitignore`:
```
generated/
*.pyc
__pycache__/
*.egg-info/
```

## Architecture

```
wc_config/
├── model.py        # Canonical Windchill data model (roles, objects, prefs)
├── loader.py       # YAML parser with defaults and normalization
├── validators.py   # Config validation with actionable error messages
├── generators.py   # XML and shell script generators
├── wizard.py       # Interactive terminal wizard
└── cli.py          # CLI entry point (argparse)
```

The model is the single source of truth for what Windchill expects. The YAML maps onto it. The generators transform it into deployment artifacts. The validator ensures consistency before you deploy.
