/**
 * WCAI -- Windchill Config AI -- Artifact Generators
 * ===================================================
 * Port of wc_config/generators.py to JavaScript.
 * Generates deployment-ready artifacts from a config object.
 * Attached to window.WCAI.generators.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};
  var m = WCAI.model;

  function timestamp() {
    return new Date().toISOString();
  }

  // ===================================================================
  // Generate all artifacts -- returns array of {name, content}
  // ===================================================================

  function generateAll(config) {
    return [
      { name: "oir_config.xml", content: generateOir(config) },
      { name: "business_rules.xml", content: generateBusinessRules(config) },
      { name: "team_config.txt", content: generateTeamConfig(config) },
      { name: "deploy_preferences.bat", content: generatePreferencesScript(config) },
      { name: "association_rules_spec.txt", content: generateAssociationSpec(config) },
      { name: "deploy_all.bat", content: generateDeployScript(config) },
    ];
  }

  // ===================================================================
  // Object Initialization Rules
  // ===================================================================

  function generateOir(config) {
    var company = config.company;
    var org = company.org;
    var name = company.name;
    var ts = timestamp();

    var rulesXml = [];
    for (var objKey in m.CHANGE_OBJECTS) {
      var obj = m.CHANGE_OBJECTS[objKey];
      var teamName = name + " " + obj.default_team_template;
      rulesXml.push(
        '  <!-- ' + obj.name + ' -->\n' +
        '  <ObjectInitializationRule>\n' +
        '    <ObjectID><localId>com.ptc.oir.' + obj.name.replace(/ /g, '') + 'Rule</localId></ObjectID>\n' +
        '    <selector>objectType</selector>\n' +
        '    <argValue>' + obj.java_type + '</argValue>\n' +
        '    <n>' + obj.name + ' Initialization Rule - ' + name + '</n>\n' +
        '    <description>Binds ' + obj.name + ' to lifecycle, workflow, and team template for ' + name + '</description>\n' +
        '    <enabled>true</enabled>\n' +
        '    <updateIfExists>true</updateIfExists>\n' +
        '    <AttrValues>\n' +
        '      <AttrValue>\n' +
        '        <attr>lifeCycleTemplateName</attr>\n' +
        '        <val>' + obj.default_lifecycle + '</val>\n' +
        '      </AttrValue>\n' +
        '      <AttrValue>\n' +
        '        <attr>teamTemplateName</attr>\n' +
        '        <val>' + teamName + '</val>\n' +
        '      </AttrValue>\n' +
        '    </AttrValues>\n' +
        '  </ObjectInitializationRule>\n'
      );
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!--\n' +
      '  ===============================================================\n' +
      '  Windchill Object Initialization Rules\n' +
      '  Company:   ' + name + '\n' +
      '  Org:       ' + org + '\n' +
      '  Generated: ' + ts + '\n' +
      '  ===============================================================\n' +
      '  Deploy from Windchill shell:\n' +
      '    windchill wt.load.LoadFromFile -d oir_config.xml -CONT_PATH /wt.inf.container.OrgContainer=' + org + '\n' +
      '  ===============================================================\n' +
      '-->\n' +
      '<!DOCTYPE ObjectInitializationRules SYSTEM "standardX20.dtd">\n' +
      '<ObjectInitializationRules>\n\n' +
      rulesXml.join('\n') +
      '</ObjectInitializationRules>\n';
  }

  // ===================================================================
  // Business Rules
  // ===================================================================

  function generateBusinessRules(config) {
    var company = config.company;
    var name = company.name;
    var org = company.org;
    var br = config.business_rules;
    var setName = br.rule_set_name;
    var safeName = name.replace(/ /g, '_');
    var ts = timestamp();

    var rulesBlock = [];
    var rules = br.rules || [];
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      rulesBlock.push(
        '\n  <BusinessRule>\n' +
        '    <ObjectID><localId>wt.businessRules.BusinessRule:' + safeName + '_' + rule.key + '</localId></ObjectID>\n' +
        '    <key>' + rule.key + '</key>\n' +
        '    <selector>' + rule.selector + '</selector>\n' +
        '    <n>' + (rule.description || rule.key) + '</n>\n' +
        '    <description>' + (rule.description || '') + '</description>\n' +
        '    <enabled>true</enabled>\n' +
        '    <updateIfExists>true</updateIfExists>\n' +
        '  </BusinessRule>'
      );
    }

    var linksBlock = [];
    for (var j = 0; j < rules.length; j++) {
      var r = rules[j];
      linksBlock.push(
        '\n  <BusinessRuleLink>\n' +
        '    <ObjectID><localId>wt.businessRules.BusinessRuleLink:' + safeName + '_LINK_' + r.key + '</localId></ObjectID>\n' +
        '    <businessRule>' + r.key + '</businessRule>\n' +
        '    <businessRuleSet>' + setName + '</businessRuleSet>\n' +
        '    <blockNumber>' + (r.block_number || 1) + '</blockNumber>\n' +
        '    <updateIfExists>true</updateIfExists>\n' +
        '  </BusinessRuleLink>'
      );
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!--\n' +
      '  ===============================================================\n' +
      '  Windchill Business Rules -- Rules, Sets, and Links\n' +
      '  Company:   ' + name + '\n' +
      '  Org:       ' + org + '\n' +
      '  Generated: ' + ts + '\n' +
      '  ===============================================================\n' +
      '  Deploy from Windchill shell:\n' +
      '    windchill wt.load.LoadFromFile -d business_rules.xml\n' +
      '  ===============================================================\n' +
      '-->\n' +
      '<!DOCTYPE BusinessRule SYSTEM "standardX20.dtd">\n\n' +
      '<!-- --- RULE SET -------------------------------------------- -->\n' +
      '<BusinessRuleSet>\n' +
      '  <ObjectID><localId>wt.businessRules.BusinessRuleSet:' + safeName + '_' + setName + '</localId></ObjectID>\n' +
      '  <key>' + setName + '</key>\n' +
      '  <n>' + name + ' Pre-Release Rule Set</n>\n' +
      '  <description>Validates changeables before release for ' + name + '</description>\n' +
      '  <enabled>true</enabled>\n' +
      '  <updateIfExists>true</updateIfExists>\n' +
      '</BusinessRuleSet>\n\n' +
      '<!-- --- RULES ----------------------------------------------- -->\n' +
      rulesBlock.join('\n') + '\n\n' +
      '<!-- --- RULE LINKS ------------------------------------------ -->\n' +
      linksBlock.join('\n') + '\n';
  }

  // ===================================================================
  // Team Configuration
  // ===================================================================

  function generateTeamConfig(config) {
    var company = config.company;
    var name = company.name;
    var org = company.org;
    var roles = config.roles;
    var peopleIndex = {};
    var people = config.people || [];
    for (var pi = 0; pi < people.length; pi++) {
      peopleIndex[people[pi].id] = people[pi];
    }
    var ts = timestamp();

    var sections = [];

    sections.push("CONTEXT TEAM ASSIGNMENTS (Preferred Method)");
    sections.push("=======================================================");
    sections.push("Configure these in each Product/Library context team.\n");

    for (var roleId in m.ROLES) {
      var roleDef = m.ROLES[roleId];
      var assigned = roles[roleId] || [];
      sections.push("  " + roleDef.display_name + ":");
      sections.push("    Used by: " + roleDef.used_by.join(", "));
      if (assigned.length > 0) {
        for (var ai = 0; ai < assigned.length; ai++) {
          var pid = assigned[ai];
          var p = peopleIndex[pid];
          if (p) {
            sections.push("    -> " + (p.name || pid) + " (" + (p.username || "?") + ")");
          } else {
            sections.push("    -> " + pid + " (group)");
          }
        }
      } else {
        sections.push("    -> [UNASSIGNED -- configure before go-live]");
      }
      sections.push("");
    }

    sections.push("\nTEAM TEMPLATE OVERRIDE METHOD (Alternative)");
    sections.push("=======================================================");
    sections.push("Use if different workflows need different people for the");
    sections.push("same role (e.g., Change Admin II differs between CR and CN).\n");

    for (var objKey in m.CHANGE_OBJECTS) {
      var obj = m.CHANGE_OBJECTS[objKey];
      var templateName = name + " " + obj.default_team_template;
      var objRoles = [];
      for (var ri = 0; ri < obj.roles.length; ri++) {
        if (m.ROLES[obj.roles[ri]]) objRoles.push(m.ROLES[obj.roles[ri]].display_name);
      }
      sections.push('  Template: "' + templateName + '"');
      sections.push("    Context: Organization/" + org);
      sections.push("    Roles: " + objRoles.join(", "));
      sections.push("");
    }

    return "# ===============================================================\n" +
      "# Windchill Team Template & Context Team Configuration\n" +
      "# Company:   " + name + "\n" +
      "# Org:       " + org + "\n" +
      "# Generated: " + ts + "\n" +
      "# ===============================================================\n" +
      "# Team templates are created via the Windchill UI.\n" +
      "# This file documents the target configuration for your team.\n" +
      "# ===============================================================\n\n" +
      sections.join("\n") + "\n";
  }

  // ===================================================================
  // Preferences Script
  // ===================================================================

  function generatePreferencesScript(config) {
    var company = config.company;
    var name = company.name;
    var org = company.org;
    var ctx = company.context_level;
    var lock = company.lock_preferences ? "true" : "false";
    var prefs = config.preferences;
    var ts = timestamp();

    var prefCommands = [];
    for (var prefKey in m.PREFERENCES) {
      var prefDef = m.PREFERENCES[prefKey];
      var value = prefs[prefKey] || prefDef.default;
      prefCommands.push(
        'REM ' + prefDef.description + '\n' +
        'echo   Setting: ' + prefDef.display_name + ' = ' + value + '\n' +
        'windchill wt.pref.PrefCmd set -contextPath "%CONTEXT_PATH%" -prefNode "' + prefDef.wc_pref_node + '" -prefKey "' + prefDef.wc_pref_key + '" -value "' + value + '" -locked ' + lock + '\n' +
        'if errorlevel 1 echo   [WARNING] Failed to set ' + prefDef.display_name + '\n'
      );
    }

    return '@echo off\r\n' +
      'REM ===============================================================\r\n' +
      'REM WCAI -- Windchill Config AI -- Preferences\r\n' +
      'REM Company:   ' + name + '\r\n' +
      'REM Org:       ' + org + '\r\n' +
      'REM Context:   ' + ctx + '\r\n' +
      'REM Locked:    ' + lock + '\r\n' +
      'REM Generated: ' + ts + '\r\n' +
      'REM ===============================================================\r\n' +
      'REM Run from Windchill shell:\r\n' +
      'REM   cd %WT_HOME%\r\n' +
      'REM   bin\\adminTools\\windchill shell\r\n' +
      'REM   deploy_preferences.bat\r\n' +
      'REM ===============================================================\r\n' +
      '\r\n' +
      'echo.\r\n' +
      'echo ============================================\r\n' +
      'echo   Change Preferences Deployment\r\n' +
      'echo   ' + name + '\r\n' +
      'echo ============================================\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'if "%WT_HOME%"=="" set WT_HOME=C:\\ptc\\Windchill\r\n' +
      'set CONTEXT_PATH=/wt.inf.container.OrgContainer=' + org + '\r\n' +
      '\r\n' +
      prefCommands.join('\r\n') + '\r\n' +
      'echo.\r\n' +
      'echo [ok] All preferences deployed.\r\n' +
      'echo   Context: ' + ctx + '/' + org + '\r\n' +
      'echo   Locked: ' + lock + '\r\n' +
      'echo.\r\n';
  }

  // ===================================================================
  // Association Rules Spec
  // ===================================================================

  function generateAssociationSpec(config) {
    var company = config.company;
    var name = company.name;
    var assocs = config.associations;
    var ts = timestamp();

    var rows = [];
    for (var assocKey in m.ASSOCIATION_TYPES) {
      var assocDef = m.ASSOCIATION_TYPES[assocKey];
      var userAssoc = assocs[assocKey] || {};
      var enabled = userAssoc.enabled ? "ENABLED" : "DISABLED";
      var card = userAssoc.cardinality || "many:1";
      var standard = assocDef.standard ? "Standard" : "Non-standard";

      rows.push("  " + assocDef.role_a + " -> " + assocDef.role_b);
      rows.push("    Status:      " + enabled);
      rows.push("    Type:        " + assocDef.assoc_type);
      rows.push("    Cardinality: " + card);
      rows.push("    Pattern:     " + standard);
      rows.push("    Description: " + assocDef.description);
      rows.push("");
    }

    return "# ===============================================================\n" +
      "# Windchill Change Association Rules Specification\n" +
      "# Company:   " + name + "\n" +
      "# Generated: " + ts + "\n" +
      "# ===============================================================\n" +
      "# Configure via: Site/Org Context -> Utilities -> Business Rules\n" +
      "# PTC recommends disabling OOB rules and defining only yours.\n" +
      "# ===============================================================\n\n" +
      rows.join("\n") + "\n";
  }

  // ===================================================================
  // Master Deployment Script
  // ===================================================================

  function generateDeployScript(config) {
    var company = config.company;
    var name = company.name;
    var org = company.org;
    var ts = timestamp();

    return '@echo off\r\n' +
      'REM ===================================================================\r\n' +
      'REM MASTER DEPLOYMENT SCRIPT\r\n' +
      'REM WCAI -- Windchill Config AI\r\n' +
      'REM ===================================================================\r\n' +
      'REM Company: ' + name + '\r\n' +
      'REM Org:     ' + org + '\r\n' +
      'REM Generated: ' + ts + '\r\n' +
      'REM\r\n' +
      'REM PREREQUISITES:\r\n' +
      'REM   1. Windchill server is running\r\n' +
      'REM   2. Open Windchill shell:  cd %WT_HOME% && bin\\adminTools\\windchill shell\r\n' +
      'REM   3. Deploying user has Site/Org Admin privileges\r\n' +
      'REM   4. All generated files are in the same directory\r\n' +
      'REM\r\n' +
      'REM USAGE:\r\n' +
      'REM   cd [path-to-generated-files]\r\n' +
      'REM   deploy_all.bat              (full deployment)\r\n' +
      'REM   deploy_all.bat --dry-run    (preview only)\r\n' +
      'REM ===================================================================\r\n' +
      '\r\n' +
      'setlocal enabledelayedexpansion\r\n' +
      '\r\n' +
      'set DRY_RUN=0\r\n' +
      'if "%~1"=="--dry-run" set DRY_RUN=1\r\n' +
      '\r\n' +
      'if "%WT_HOME%"=="" set WT_HOME=C:\\ptc\\Windchill\r\n' +
      'set CONTEXT_PATH=/wt.inf.container.OrgContainer=' + org + '\r\n' +
      'set DEPLOY_DIR=%~dp0\r\n' +
      'set LOG_FILE=%DEPLOY_DIR%deploy_%date:~-4%%date:~4,2%%date:~7,2%.log\r\n' +
      '\r\n' +
      'echo.\r\n' +
      'echo ============================================================\r\n' +
      'echo   WINDCHILL CONFIGURATION-AS-CODE DEPLOYMENT\r\n' +
      'echo   ' + name + '\r\n' +
      'echo ============================================================\r\n' +
      'echo   Phase 1: Object Initialization Rules (LoadFromFile)\r\n' +
      'echo   Phase 2: Business Rules (LoadFromFile)\r\n' +
      'echo   Phase 3: Change Preferences (PrefCmd)\r\n' +
      'echo   Phase 4: Association Rules (manual verification)\r\n' +
      'echo   Phase 5: Validation\r\n' +
      'echo ============================================================\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'if %DRY_RUN%==1 (\r\n' +
      '    echo [DRY RUN MODE -- no changes will be made]\r\n' +
      '    echo.\r\n' +
      ')\r\n' +
      '\r\n' +
      'REM --- PHASE 1: Object Initialization Rules ---------------------\r\n' +
      'echo === PHASE 1: Object Initialization Rules ===\r\n' +
      'echo === PHASE 1: Object Initialization Rules === >> "%LOG_FILE%"\r\n' +
      'if exist "%DEPLOY_DIR%oir_config.xml" (\r\n' +
      '    if %DRY_RUN%==1 (\r\n' +
      '        echo [dry] Would load oir_config.xml into %CONTEXT_PATH%\r\n' +
      '    ) else (\r\n' +
      '        echo Loading oir_config.xml...\r\n' +
      '        windchill wt.load.LoadFromFile -d "%DEPLOY_DIR%oir_config.xml" -CONT_PATH "%CONTEXT_PATH%" >> "%LOG_FILE%" 2>&1\r\n' +
      '        if errorlevel 1 (\r\n' +
      '            echo [FAIL] OIR load failed - check %LOG_FILE%\r\n' +
      '        ) else (\r\n' +
      '            echo [ok] OIR loaded successfully\r\n' +
      '        )\r\n' +
      '    )\r\n' +
      ') else (\r\n' +
      '    echo [!] oir_config.xml not found -- skipping\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'REM --- PHASE 2: Business Rules ----------------------------------\r\n' +
      'echo === PHASE 2: Business Rules ===\r\n' +
      'echo === PHASE 2: Business Rules === >> "%LOG_FILE%"\r\n' +
      'if exist "%DEPLOY_DIR%business_rules.xml" (\r\n' +
      '    if %DRY_RUN%==1 (\r\n' +
      '        echo [dry] Would load business_rules.xml into %CONTEXT_PATH%\r\n' +
      '    ) else (\r\n' +
      '        echo Loading business_rules.xml...\r\n' +
      '        windchill wt.load.LoadFromFile -d "%DEPLOY_DIR%business_rules.xml" -CONT_PATH "%CONTEXT_PATH%" >> "%LOG_FILE%" 2>&1\r\n' +
      '        if errorlevel 1 (\r\n' +
      '            echo [FAIL] Business rules load failed - check %LOG_FILE%\r\n' +
      '        ) else (\r\n' +
      '            echo [ok] Business rules loaded successfully\r\n' +
      '        )\r\n' +
      '    )\r\n' +
      ') else (\r\n' +
      '    echo [!] business_rules.xml not found -- skipping\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'REM --- PHASE 3: Preferences ------------------------------------\r\n' +
      'echo === PHASE 3: Change Preferences ===\r\n' +
      'echo === PHASE 3: Change Preferences === >> "%LOG_FILE%"\r\n' +
      'if exist "%DEPLOY_DIR%deploy_preferences.bat" (\r\n' +
      '    if %DRY_RUN%==1 (\r\n' +
      '        echo [dry] Would execute deploy_preferences.bat\r\n' +
      '    ) else (\r\n' +
      '        call "%DEPLOY_DIR%deploy_preferences.bat" >> "%LOG_FILE%" 2>&1\r\n' +
      '        echo [ok] Preferences set\r\n' +
      '    )\r\n' +
      ') else (\r\n' +
      '    echo [!] deploy_preferences.bat not found -- skipping\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'REM --- PHASE 4: Association Rules -------------------------------\r\n' +
      'echo === PHASE 4: Association Rules ===\r\n' +
      'echo Association rules require manual configuration.\r\n' +
      'echo Review: association_rules_spec.txt\r\n' +
      'echo Navigate in Windchill: Site/Org -> Utilities -> Business Rules\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'REM --- PHASE 5: Validation --------------------------------------\r\n' +
      'echo === PHASE 5: Post-Deployment Validation ===\r\n' +
      'if %DRY_RUN%==0 (\r\n' +
      '    echo Checking OIR bindings...\r\n' +
      '    windchill wt.load.LoadFromFile -d "%DEPLOY_DIR%oir_config.xml" -CHECK >> "%LOG_FILE%" 2>&1\r\n' +
      '    if errorlevel 1 (\r\n' +
      '        echo [!] OIR check reported issues - review %LOG_FILE%\r\n' +
      '    ) else (\r\n' +
      '        echo [ok] OIR validation passed\r\n' +
      '    )\r\n' +
      ')\r\n' +
      '\r\n' +
      'echo.\r\n' +
      'echo ============================================================\r\n' +
      'echo   DEPLOYMENT COMPLETE\r\n' +
      'echo   Log: %LOG_FILE%\r\n' +
      'echo ============================================================\r\n' +
      'echo   REMAINING MANUAL STEPS:\r\n' +
      'echo   1. Create/verify team templates in Windchill UI\r\n' +
      'echo   2. Assign context team members per Product/Library\r\n' +
      'echo   3. Configure association rules via Utilities page\r\n' +
      'echo   4. Verify access control policies per role\r\n' +
      'echo   5. Test: Create PR -> CR -> CN -> Task end-to-end\r\n' +
      'echo ============================================================\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'endlocal\r\n';
  }

  // ===================================================================
  // Bulk User Loading -- Users CSV (dev VMs only)
  // ===================================================================

  function generateUsersCsv(config) {
    var people = config.people || [];
    var org = config.company.org || "DefaultOrg";
    var lines = [];

    // PTC CSV header
    lines.push("#User,user,newUser,webServerID,fullName,LastName,Locale,Email,DefiningOrgId,Organization,telephoneNumber,ignore,password");

    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      var username = p.username || p.id;
      var fullName = p.name || username;
      var parts = fullName.trim().split(/\s+/);
      var lastName = parts[parts.length - 1];
      var email = p.email || (username + "@example.com");

      lines.push(
        "User,user,newUser," +
        username + "," +
        fullName + "," +
        lastName + "," +
        "en_US," +
        email + "," +
        org + "," +
        org + "," +
        "," +   // telephoneNumber (blank)
        "ignore," +
        "Password1"
      );
    }

    return lines.join("\r\n") + "\r\n";
  }

  // ===================================================================
  // Bulk User Loading -- User-Group Assignment CSV (dev VMs only)
  // ===================================================================

  function generateUserGroupsCsv(config) {
    var people = config.people || [];
    var groups = config.groups || [];
    var groupIndex = {};
    for (var gi = 0; gi < groups.length; gi++) {
      groupIndex[groups[gi].id] = groups[gi].name || groups[gi].id;
    }

    var lines = [];
    lines.push("#UserGroup,user,groupName,userName");

    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      if (!p.group) continue;
      var groupName = groupIndex[p.group] || p.group;
      var username = p.username || p.id;
      lines.push("UserGroup,user," + groupName + "," + username);
    }

    return lines.join("\r\n") + "\r\n";
  }

  // ===================================================================
  // Bulk User Loading -- Batch Script (dev VMs only)
  // ===================================================================

  function generateLoadUsersBat(config) {
    var company = config.company;
    var name = company.name || "Company";
    var org = company.org || "DefaultOrg";
    var ts = timestamp();

    return '@echo off\r\n' +
      'REM ===================================================================\r\n' +
      'REM BULK USER LOADING SCRIPT (Dev VMs Only)\r\n' +
      'REM WCAI -- Windchill Config AI\r\n' +
      'REM ===================================================================\r\n' +
      'REM Company: ' + name + '\r\n' +
      'REM Org:     ' + org + '\r\n' +
      'REM Generated: ' + ts + '\r\n' +
      'REM\r\n' +
      'REM WARNING: This script is for dev/test VMs with internal Apache DS.\r\n' +
      'REM Do NOT use in production or LDAP-connected environments.\r\n' +
      'REM\r\n' +
      'REM PREREQUISITES:\r\n' +
      'REM   1. Windchill server is running\r\n' +
      'REM   2. Open Windchill shell:  cd %WT_HOME% && bin\\adminTools\\windchill shell\r\n' +
      'REM   3. All CSV files are in the same directory as this script\r\n' +
      'REM   4. Groups must already exist in Windchill (manual step)\r\n' +
      'REM\r\n' +
      'REM USAGE:\r\n' +
      'REM   cd [path-to-generated-files]\r\n' +
      'REM   load_users.bat              (full load)\r\n' +
      'REM   load_users.bat --dry-run    (preview only)\r\n' +
      'REM ===================================================================\r\n' +
      '\r\n' +
      'setlocal enabledelayedexpansion\r\n' +
      '\r\n' +
      'set DRY_RUN=0\r\n' +
      'if "%~1"=="--dry-run" set DRY_RUN=1\r\n' +
      '\r\n' +
      'if "%WT_HOME%"=="" set WT_HOME=C:\\ptc\\Windchill\r\n' +
      'set CONT_PATH=/wt.inf.container.OrgContainer=' + org + '\r\n' +
      'set DEPLOY_DIR=%~dp0\r\n' +
      'set LOG_FILE=%DEPLOY_DIR%load_users_%date:~-4%%date:~4,2%%date:~7,2%.log\r\n' +
      'set WC_ADMIN=wcadmin\r\n' +
      'set WC_PASS=windchill\r\n' +
      '\r\n' +
      'echo.\r\n' +
      'echo ============================================================\r\n' +
      'echo   BULK USER LOADING (Dev VM Only)\r\n' +
      'echo   ' + name + '\r\n' +
      'echo ============================================================\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'if %DRY_RUN%==1 (\r\n' +
      '    echo [DRY RUN MODE -- no changes will be made]\r\n' +
      '    echo.\r\n' +
      ')\r\n' +
      '\r\n' +
      'REM --- PHASE 1: Convert users.csv to XML --------------------------\r\n' +
      'echo === PHASE 1: Convert users.csv to XML ===\r\n' +
      'if exist "%DEPLOY_DIR%users.csv" (\r\n' +
      '    if %DRY_RUN%==1 (\r\n' +
      '        echo [dry] Would convert users.csv to users.xml\r\n' +
      '    ) else (\r\n' +
      '        echo Converting users.csv...\r\n' +
      '        windchill wt.load.CSV2XML -d "%DEPLOY_DIR%users.csv" -o "%DEPLOY_DIR%users.xml" >> "%LOG_FILE%" 2>&1\r\n' +
      '        if errorlevel 1 (\r\n' +
      '            echo [FAIL] CSV2XML failed for users.csv - check %LOG_FILE%\r\n' +
      '            goto :done\r\n' +
      '        ) else (\r\n' +
      '            echo [ok] users.xml created\r\n' +
      '        )\r\n' +
      '    )\r\n' +
      ') else (\r\n' +
      '    echo [FAIL] users.csv not found -- cannot continue\r\n' +
      '    goto :done\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'REM --- PHASE 2: Load users into Windchill -------------------------\r\n' +
      'echo === PHASE 2: Load users into Windchill ===\r\n' +
      'if %DRY_RUN%==1 (\r\n' +
      '    echo [dry] Would load users.xml into %CONT_PATH%\r\n' +
      ') else (\r\n' +
      '    echo Loading users.xml...\r\n' +
      '    windchill wt.load.LoadFromFile -d "%DEPLOY_DIR%users.xml" -CONT_PATH "%CONT_PATH%" -u %WC_ADMIN% -p %WC_PASS% >> "%LOG_FILE%" 2>&1\r\n' +
      '    if errorlevel 1 (\r\n' +
      '        echo [FAIL] LoadFromFile failed for users.xml - check %LOG_FILE%\r\n' +
      '        goto :done\r\n' +
      '    ) else (\r\n' +
      '        echo [ok] Users loaded successfully\r\n' +
      '    )\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'REM --- PHASE 3: Convert user_groups.csv to XML --------------------\r\n' +
      'echo === PHASE 3: Convert user_groups.csv to XML ===\r\n' +
      'if exist "%DEPLOY_DIR%user_groups.csv" (\r\n' +
      '    if %DRY_RUN%==1 (\r\n' +
      '        echo [dry] Would convert user_groups.csv to user_groups.xml\r\n' +
      '    ) else (\r\n' +
      '        echo Converting user_groups.csv...\r\n' +
      '        windchill wt.load.CSV2XML -d "%DEPLOY_DIR%user_groups.csv" -o "%DEPLOY_DIR%user_groups.xml" >> "%LOG_FILE%" 2>&1\r\n' +
      '        if errorlevel 1 (\r\n' +
      '            echo [FAIL] CSV2XML failed for user_groups.csv - check %LOG_FILE%\r\n' +
      '            goto :done\r\n' +
      '        ) else (\r\n' +
      '            echo [ok] user_groups.xml created\r\n' +
      '        )\r\n' +
      '    )\r\n' +
      ') else (\r\n' +
      '    echo [!] user_groups.csv not found -- skipping group assignments\r\n' +
      '    goto :nextsteps\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'REM --- PHASE 4: Load group assignments into Windchill --------------\r\n' +
      'echo === PHASE 4: Load group assignments into Windchill ===\r\n' +
      'if %DRY_RUN%==1 (\r\n' +
      '    echo [dry] Would load user_groups.xml into %CONT_PATH%\r\n' +
      ') else (\r\n' +
      '    echo Loading user_groups.xml...\r\n' +
      '    windchill wt.load.LoadFromFile -d "%DEPLOY_DIR%user_groups.xml" -CONT_PATH "%CONT_PATH%" -u %WC_ADMIN% -p %WC_PASS% >> "%LOG_FILE%" 2>&1\r\n' +
      '    if errorlevel 1 (\r\n' +
      '        echo [FAIL] LoadFromFile failed for user_groups.xml - check %LOG_FILE%\r\n' +
      '    ) else (\r\n' +
      '        echo [ok] Group assignments loaded successfully\r\n' +
      '    )\r\n' +
      ')\r\n' +
      'echo.\r\n' +
      '\r\n' +
      ':nextsteps\r\n' +
      'echo.\r\n' +
      'echo ============================================================\r\n' +
      'echo   BULK USER LOADING COMPLETE\r\n' +
      'echo   Log: %LOG_FILE%\r\n' +
      'echo ============================================================\r\n' +
      'echo   REMAINING MANUAL STEPS:\r\n' +
      'echo   1. Change default passwords for all loaded users\r\n' +
      'echo   2. Assign users to license groups (Site -> License Mgmt)\r\n' +
      'echo   3. Verify group membership in Participant Administration\r\n' +
      'echo   4. Add groups to team template roles\r\n' +
      'echo   5. Configure context teams per Product/Library\r\n' +
      'echo ============================================================\r\n' +
      'echo.\r\n' +
      'goto :eof\r\n' +
      '\r\n' +
      ':done\r\n' +
      'echo.\r\n' +
      'echo [STOPPED] Fix the error above and re-run this script.\r\n' +
      'echo.\r\n' +
      '\r\n' +
      'endlocal\r\n';
  }

  // Export
  WCAI.generators = {
    generateAll: generateAll,
    generateOir: generateOir,
    generateBusinessRules: generateBusinessRules,
    generateTeamConfig: generateTeamConfig,
    generatePreferencesScript: generatePreferencesScript,
    generateAssociationSpec: generateAssociationSpec,
    generateDeployScript: generateDeployScript,
    generateUsersCsv: generateUsersCsv,
    generateUserGroupsCsv: generateUserGroupsCsv,
    generateLoadUsersBat: generateLoadUsersBat,
  };
})();
