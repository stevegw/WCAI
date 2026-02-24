"""
Windchill Config -- Artifact Generators
=======================================
Generates deployment-ready artifacts from a validated config:
  - Object Initialization Rules (XML for LoadFromFile)
  - Business Rules / Sets / Links (XML for LoadFromFile)
  - Team Template specifications
  - Preference deployment scripts (shell)
  - Association rules specification
  - Master deployment orchestrator
"""

from datetime import datetime
from pathlib import Path
from textwrap import dedent

from .model import CHANGE_OBJECTS, ROLES, PREFERENCES, ASSOCIATION_TYPES


def generate_all(config: dict, output_dir: str | Path) -> list[Path]:
    """Generate all artifacts and write to output_dir. Returns list of created files."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    files = []
    generators = [
        ("oir_config.xml", generate_oir),
        ("business_rules.xml", generate_business_rules),
        ("team_config.txt", generate_team_config),
        ("deploy_preferences.bat", generate_preferences_script),
        ("association_rules_spec.txt", generate_association_spec),
        ("deploy_all.bat", generate_deploy_script),
    ]

    for filename, gen_func in generators:
        content = gen_func(config)
        filepath = output_dir / filename
        filepath.write_text(content)
        files.append(filepath)

    return files


# --- Object Initialization Rules ---------------------------------

def generate_oir(config: dict) -> str:
    company = config["company"]
    org = company["org"]
    name = company["name"]
    timestamp = datetime.now().isoformat()

    rules_xml = []
    for obj_key, obj in CHANGE_OBJECTS.items():
        team_name = f"{name} {obj.default_team_template}"
        rules_xml.append(f"""  <!-- {obj.name} -->
  <ObjectInitializationRule>
    <ObjectID><localId>com.ptc.oir.{obj.name.replace(' ', '')}Rule</localId></ObjectID>
    <selector>objectType</selector>
    <argValue>{obj.java_type}</argValue>
    <n>{obj.name} Initialization Rule - {name}</n>
    <description>Binds {obj.name} to lifecycle, workflow, and team template for {name}</description>
    <enabled>true</enabled>
    <updateIfExists>true</updateIfExists>
    <AttrValues>
      <AttrValue>
        <attr>lifeCycleTemplateName</attr>
        <val>{obj.default_lifecycle}</val>
      </AttrValue>
      <AttrValue>
        <attr>teamTemplateName</attr>
        <val>{team_name}</val>
      </AttrValue>
    </AttrValues>
  </ObjectInitializationRule>
""")

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!--
  ===============================================================
  Windchill Object Initialization Rules
  Company:   {name}
  Org:       {org}
  Generated: {timestamp}
  ===============================================================
  Deploy from Windchill shell:
    windchill wt.load.LoadFromFile -d oir_config.xml -CONT_PATH /wt.inf.container.OrgContainer={org}
  ===============================================================
-->
<!DOCTYPE ObjectInitializationRules SYSTEM "standardX20.dtd">
<ObjectInitializationRules>

{chr(10).join(rules_xml)}
</ObjectInitializationRules>
"""


# --- Business Rules -----------------------------------------------

def generate_business_rules(config: dict) -> str:
    company = config["company"]
    name = company["name"]
    org = company["org"]
    br = config["business_rules"]
    set_name = br["rule_set_name"]
    safe_name = name.replace(" ", "_")
    timestamp = datetime.now().isoformat()

    rules_block = []
    for rule in br.get("rules", []):
        rules_block.append(f"""
  <BusinessRule>
    <ObjectID><localId>wt.businessRules.BusinessRule:{safe_name}_{rule['key']}</localId></ObjectID>
    <key>{rule['key']}</key>
    <selector>{rule['selector']}</selector>
    <n>{rule.get('description', rule['key'])}</n>
    <description>{rule.get('description', '')}</description>
    <enabled>true</enabled>
    <updateIfExists>true</updateIfExists>
  </BusinessRule>""")

    links_block = []
    for rule in br.get("rules", []):
        links_block.append(f"""
  <BusinessRuleLink>
    <ObjectID><localId>wt.businessRules.BusinessRuleLink:{safe_name}_LINK_{rule['key']}</localId></ObjectID>
    <businessRule>{rule['key']}</businessRule>
    <businessRuleSet>{set_name}</businessRuleSet>
    <blockNumber>{rule.get('block_number', 1)}</blockNumber>
    <updateIfExists>true</updateIfExists>
  </BusinessRuleLink>""")

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!--
  ===============================================================
  Windchill Business Rules -- Rules, Sets, and Links
  Company:   {name}
  Org:       {org}
  Generated: {timestamp}
  ===============================================================
  Deploy from Windchill shell:
    windchill wt.load.LoadFromFile -d business_rules.xml
  ===============================================================
-->
<!DOCTYPE BusinessRule SYSTEM "standardX20.dtd">

<!-- --- RULE SET -------------------------------------------- -->
<BusinessRuleSet>
  <ObjectID><localId>wt.businessRules.BusinessRuleSet:{safe_name}_{set_name}</localId></ObjectID>
  <key>{set_name}</key>
  <n>{name} Pre-Release Rule Set</n>
  <description>Validates changeables before release for {name}</description>
  <enabled>true</enabled>
  <updateIfExists>true</updateIfExists>
</BusinessRuleSet>

<!-- --- RULES ----------------------------------------------- -->
{chr(10).join(rules_block)}

<!-- --- RULE LINKS ------------------------------------------ -->
{chr(10).join(links_block)}
"""


# --- Team Configuration -------------------------------------------

def generate_team_config(config: dict) -> str:
    company = config["company"]
    name = company["name"]
    org = company["org"]
    roles = config["roles"]
    people_index = config.get("_people_index", {})
    timestamp = datetime.now().isoformat()

    sections = []

    # Context team assignments
    sections.append("CONTEXT TEAM ASSIGNMENTS (Preferred Method)")
    sections.append("=" * 55)
    sections.append(f"Configure these in each Product/Library context team.\n")

    for role_id, role_def in ROLES.items():
        assigned = roles.get(role_id, [])
        sections.append(f"  {role_def.display_name}:")
        sections.append(f"    Used by: {', '.join(role_def.used_by)}")
        if assigned:
            for pid in assigned:
                p = people_index.get(pid, {})
                sections.append(f"    -> {p.get('name', pid)} ({p.get('username', '?')})")
        else:
            sections.append(f"    -> [UNASSIGNED -- configure before go-live]")
        sections.append("")

    # Team template overrides
    sections.append("\nTEAM TEMPLATE OVERRIDE METHOD (Alternative)")
    sections.append("=" * 55)
    sections.append("Use if different workflows need different people for the")
    sections.append("same role (e.g., Change Admin II differs between CR and CN).\n")

    for obj_key, obj in CHANGE_OBJECTS.items():
        template_name = f"{name} {obj.default_team_template}"
        obj_roles = [ROLES[r].display_name for r in obj.roles if r in ROLES]
        sections.append(f"  Template: \"{template_name}\"")
        sections.append(f"    Context: Organization/{org}")
        sections.append(f"    Roles: {', '.join(obj_roles)}")
        sections.append("")

    return f"""# ===============================================================
# Windchill Team Template & Context Team Configuration
# Company:   {name}
# Org:       {org}
# Generated: {timestamp}
# ===============================================================
# Team templates are created via the Windchill UI.
# This file documents the target configuration for your team.
# ===============================================================

{chr(10).join(sections)}
"""


# --- Preferences Script ------------------------------------------

def generate_preferences_script(config: dict) -> str:
    company = config["company"]
    name = company["name"]
    org = company["org"]
    ctx = company["context_level"]
    lock = "true" if company.get("lock_preferences") else "false"
    prefs = config["preferences"]
    timestamp = datetime.now().isoformat()

    pref_commands = []
    for pref_key, pref_def in PREFERENCES.items():
        value = prefs.get(pref_key, pref_def.default)
        pref_commands.append(f"""REM {pref_def.description}
echo   Setting: {pref_def.display_name} = {value}
windchill wt.pref.PrefCmd set -contextPath "%CONTEXT_PATH%" -prefNode "{pref_def.wc_pref_node}" -prefKey "{pref_def.wc_pref_key}" -value "{value}" -locked {lock}
if errorlevel 1 echo   [WARNING] Failed to set {pref_def.display_name}
""")

    return f"""@echo off
REM ===============================================================
REM WCAI -- Windchill Config AI -- Preferences
REM Company:   {name}
REM Org:       {org}
REM Context:   {ctx}
REM Locked:    {lock}
REM Generated: {timestamp}
REM ===============================================================
REM Run from Windchill shell:
REM   cd %WT_HOME%
REM   bin\\adminTools\\windchill shell
REM   deploy_preferences.bat
REM ===============================================================

echo.
echo ============================================
echo   Change Preferences Deployment
echo   {name}
echo ============================================
echo.

if "%WT_HOME%"=="" set WT_HOME=C:\\ptc\\Windchill
set CONTEXT_PATH=/wt.inf.container.OrgContainer={org}

{chr(10).join(pref_commands)}

echo.
echo [ok] All preferences deployed.
echo   Context: {ctx}/{org}
echo   Locked: {lock}
echo.
"""


# --- Association Rules Spec ---------------------------------------

def generate_association_spec(config: dict) -> str:
    company = config["company"]
    name = company["name"]
    assocs = config["associations"]
    timestamp = datetime.now().isoformat()

    rows = []
    for assoc_key, assoc_def in ASSOCIATION_TYPES.items():
        user_assoc = assocs.get(assoc_key, {})
        enabled = user_assoc.get("enabled", False)
        status = "ENABLED" if enabled else "DISABLED"
        card = user_assoc.get("cardinality", "many:1")
        standard = "Standard" if assoc_def["standard"] else "Non-standard"

        rows.append(f"  {assoc_def['role_a']} -> {assoc_def['role_b']}")
        rows.append(f"    Status:      {status}")
        rows.append(f"    Type:        {assoc_def['assoc_type']}")
        rows.append(f"    Cardinality: {card}")
        rows.append(f"    Pattern:     {standard}")
        rows.append(f"    Description: {assoc_def['description']}")
        rows.append("")

    return f"""# ===============================================================
# Windchill Change Association Rules Specification
# Company:   {name}
# Generated: {timestamp}
# ===============================================================
# Configure via: Site/Org Context -> Utilities -> Business Rules
# PTC recommends disabling OOB rules and defining only yours.
# ===============================================================

{chr(10).join(rows)}
"""


# --- Master Deployment Script -------------------------------------

def generate_deploy_script(config: dict) -> str:
    company = config["company"]
    name = company["name"]
    org = company["org"]
    timestamp = datetime.now().isoformat()

    return f"""@echo off
REM ===================================================================
REM MASTER DEPLOYMENT SCRIPT
REM WCAI -- Windchill Config AI
REM ===================================================================
REM Company: {name}
REM Org:     {org}
REM Generated: {timestamp}
REM
REM PREREQUISITES:
REM   1. Windchill server is running
REM   2. Open Windchill shell:  cd %WT_HOME% && bin\\adminTools\\windchill shell
REM   3. Deploying user has Site/Org Admin privileges
REM   4. All generated files are in the same directory
REM
REM USAGE:
REM   cd [path-to-generated-files]
REM   deploy_all.bat              (full deployment)
REM   deploy_all.bat --dry-run    (preview only)
REM ===================================================================

setlocal enabledelayedexpansion

set DRY_RUN=0
if "%~1"=="--dry-run" set DRY_RUN=1

if "%WT_HOME%"=="" set WT_HOME=C:\\ptc\\Windchill
set CONTEXT_PATH=/wt.inf.container.OrgContainer={org}
set DEPLOY_DIR=%~dp0
set LOG_FILE=%DEPLOY_DIR%deploy_%date:~-4%%date:~4,2%%date:~7,2%.log

echo.
echo ============================================================
echo   WINDCHILL CONFIGURATION-AS-CODE DEPLOYMENT
echo   {name}
echo ============================================================
echo   Phase 1: Object Initialization Rules (LoadFromFile)
echo   Phase 2: Business Rules (LoadFromFile)
echo   Phase 3: Change Preferences (PrefCmd)
echo   Phase 4: Association Rules (manual verification)
echo   Phase 5: Validation
echo ============================================================
echo.

if %DRY_RUN%==1 (
    echo [DRY RUN MODE -- no changes will be made]
    echo.
)

REM --- PHASE 1: Object Initialization Rules ---------------------
echo === PHASE 1: Object Initialization Rules ===
echo === PHASE 1: Object Initialization Rules === >> "%LOG_FILE%"
if exist "%DEPLOY_DIR%oir_config.xml" (
    if %DRY_RUN%==1 (
        echo [dry] Would load oir_config.xml into %CONTEXT_PATH%
    ) else (
        echo Loading oir_config.xml...
        windchill wt.load.LoadFromFile -d "%DEPLOY_DIR%oir_config.xml" -CONT_PATH "%CONTEXT_PATH%" >> "%LOG_FILE%" 2>&1
        if errorlevel 1 (
            echo [FAIL] OIR load failed - check %LOG_FILE%
        ) else (
            echo [ok] OIR loaded successfully
        )
    )
) else (
    echo [!] oir_config.xml not found -- skipping
)
echo.

REM --- PHASE 2: Business Rules ----------------------------------
echo === PHASE 2: Business Rules ===
echo === PHASE 2: Business Rules === >> "%LOG_FILE%"
if exist "%DEPLOY_DIR%business_rules.xml" (
    if %DRY_RUN%==1 (
        echo [dry] Would load business_rules.xml into %CONTEXT_PATH%
    ) else (
        echo Loading business_rules.xml...
        windchill wt.load.LoadFromFile -d "%DEPLOY_DIR%business_rules.xml" -CONT_PATH "%CONTEXT_PATH%" >> "%LOG_FILE%" 2>&1
        if errorlevel 1 (
            echo [FAIL] Business rules load failed - check %LOG_FILE%
        ) else (
            echo [ok] Business rules loaded successfully
        )
    )
) else (
    echo [!] business_rules.xml not found -- skipping
)
echo.

REM --- PHASE 3: Preferences ------------------------------------
echo === PHASE 3: Change Preferences ===
echo === PHASE 3: Change Preferences === >> "%LOG_FILE%"
if exist "%DEPLOY_DIR%deploy_preferences.bat" (
    if %DRY_RUN%==1 (
        echo [dry] Would execute deploy_preferences.bat
    ) else (
        call "%DEPLOY_DIR%deploy_preferences.bat" >> "%LOG_FILE%" 2>&1
        echo [ok] Preferences set
    )
) else (
    echo [!] deploy_preferences.bat not found -- skipping
)
echo.

REM --- PHASE 4: Association Rules -------------------------------
echo === PHASE 4: Association Rules ===
echo Association rules require manual configuration.
echo Review: association_rules_spec.txt
echo Navigate in Windchill: Site/Org -> Utilities -> Business Rules
echo.

REM --- PHASE 5: Validation --------------------------------------
echo === PHASE 5: Post-Deployment Validation ===
if %DRY_RUN%==0 (
    echo Checking OIR bindings...
    windchill wt.load.LoadFromFile -d "%DEPLOY_DIR%oir_config.xml" -CHECK >> "%LOG_FILE%" 2>&1
    if errorlevel 1 (
        echo [!] OIR check reported issues - review %LOG_FILE%
    ) else (
        echo [ok] OIR validation passed
    )
)

echo.
echo ============================================================
echo   DEPLOYMENT COMPLETE
echo   Log: %LOG_FILE%
echo ============================================================
echo   REMAINING MANUAL STEPS:
echo   1. Create/verify team templates in Windchill UI
echo   2. Assign context team members per Product/Library
echo   3. Configure association rules via Utilities page
echo   4. Verify access control policies per role
echo   5. Test: Create PR -> CR -> CN -> Task end-to-end
echo ============================================================
echo.

endlocal
"""
