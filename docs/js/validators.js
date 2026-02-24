/**
 * WCAI -- Windchill Config AI -- Config Validators
 * =================================================
 * Port of wc_config/validators.py to JavaScript.
 * Attached to window.WCAI.validators.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};
  var m = WCAI.model;

  // Issue constructor
  function Issue(severity, section, message, fix_hint) {
    return {
      severity: severity,
      section: section,
      message: message,
      fix_hint: fix_hint || null,
    };
  }

  // ===================================================================
  // Main validate function
  // ===================================================================

  function validate(config) {
    var issues = [];
    issues = issues.concat(validateCompany(config));
    issues = issues.concat(validatePeople(config));
    issues = issues.concat(validateGroups(config));
    issues = issues.concat(validateRoles(config));
    issues = issues.concat(validatePreferences(config));
    issues = issues.concat(validateAssociations(config));
    issues = issues.concat(validateBusinessRules(config));
    return issues;
  }

  // ===================================================================
  // Company
  // ===================================================================

  function validateCompany(config) {
    var issues = [];
    var company = config.company || {};

    if (!company.name) {
      issues.push(Issue("ERROR", "company",
        "Company name is required",
        "Set company.name in your YAML config"));
    }

    if (!company.org) {
      issues.push(Issue("ERROR", "company",
        "Windchill organization name is required",
        "Set company.org to your OrgContainer name"));
    }

    if (company.context_level !== "site" && company.context_level !== "organization") {
      issues.push(Issue("WARNING", "company",
        "Invalid context_level: '" + company.context_level + "' -- defaulting to 'organization'",
        "Use 'site' or 'organization'"));
    }

    return issues;
  }

  // ===================================================================
  // People
  // ===================================================================

  function validatePeople(config) {
    var issues = [];
    var people = config.people || [];

    if (people.length === 0) {
      issues.push(Issue("ERROR", "people",
        "No people defined -- at least one person is needed for role assignment",
        "Add entries under the 'people' section"));
    }

    var idsSeen = {};
    var usernamesSeen = {};

    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      var pid = p.id || "";

      if (!pid) {
        issues.push(Issue("ERROR", "people",
          "Person missing 'id': " + (p.name || "?")));
      } else if (idsSeen[pid]) {
        issues.push(Issue("ERROR", "people",
          "Duplicate person id: '" + pid + "'"));
      }
      idsSeen[pid] = true;

      if (!p.username) {
        issues.push(Issue("ERROR", "people",
          "Person '" + pid + "' missing Windchill username",
          "This must match their Windchill login"));
      } else if (usernamesSeen[p.username]) {
        issues.push(Issue("ERROR", "people",
          "Duplicate username: '" + p.username + "'"));
      }
      usernamesSeen[p.username || ""] = true;

      if (!p.name) {
        issues.push(Issue("WARNING", "people",
          "Person '" + pid + "' has no display name"));
      }
    }

    return issues;
  }

  // ===================================================================
  // Groups
  // ===================================================================

  function validateGroups(config) {
    var issues = [];
    var groupIds = {};
    var groups = config.groups || [];
    for (var gi = 0; gi < groups.length; gi++) {
      groupIds[groups[gi].id] = true;
    }

    var people = config.people || [];
    for (var pi = 0; pi < people.length; pi++) {
      var p = people[pi];
      if (p.group && !groupIds[p.group]) {
        issues.push(Issue("WARNING", "groups",
          "Person '" + p.id + "' references group '" + p.group + "' which doesn't exist",
          "Add the group to the 'groups' section or remove the group reference"));
      }
    }

    return issues;
  }

  // ===================================================================
  // Roles
  // ===================================================================

  function validateRoles(config) {
    var issues = [];
    var roles = config.roles || {};

    // Build set of valid IDs (people + groups)
    var peopleIndex = {};
    var people = config.people || [];
    for (var pi = 0; pi < people.length; pi++) {
      peopleIndex[people[pi].id] = people[pi];
    }
    var groupIds = {};
    var groups = config.groups || [];
    for (var gi = 0; gi < groups.length; gi++) {
      groupIds[groups[gi].id] = true;
    }

    // Critical roles
    var criticalRoles = ["change_admin_1", "change_admin_2", "change_admin_3"];
    for (var ci = 0; ci < criticalRoles.length; ci++) {
      var crid = criticalRoles[ci];
      var assigned = roles[crid] || [];
      if (assigned.length === 0) {
        var roleDef = m.ROLES[crid];
        issues.push(Issue("WARNING", "roles",
          "Critical role '" + roleDef.display_name + "' has no group assigned",
          "Assign at least one group to roles." + crid));
      }
    }

    // Check all assignments reference real groups or people
    for (var roleId in roles) {
      if (!m.ROLES[roleId]) {
        issues.push(Issue("WARNING", "roles",
          "Unknown role: '" + roleId + "'",
          "Valid roles: " + Object.keys(m.ROLES).join(", ")));
        continue;
      }

      var assignedIds = roles[roleId] || [];
      for (var ai = 0; ai < assignedIds.length; ai++) {
        var refId = assignedIds[ai];
        if (!groupIds[refId] && !peopleIndex[refId]) {
          issues.push(Issue("ERROR", "roles",
            "Role '" + roleId + "' references '" + refId + "' which is not a known group or person",
            "Add this as a group in the 'groups' section or as a person in the 'people' section"));
        }
      }
    }

    // Check for role conflicts
    var ca2Groups = roles.change_admin_2 || [];
    var ca2Unique = {};
    for (var c2i = 0; c2i < ca2Groups.length; c2i++) ca2Unique[ca2Groups[c2i]] = true;
    if (Object.keys(ca2Unique).length === 1) {
      issues.push(Issue("INFO", "roles",
        "Change Admin II has a single group for both CR and CN workflows. " +
        "If you need different groups per workflow, consider overriding team templates " +
        "at the sub-organizational level instead of using context teams."));
    }

    // Check every change object has at least one role covered
    for (var objKey in m.CHANGE_OBJECTS) {
      var obj = m.CHANGE_OBJECTS[objKey];
      var covered = false;
      for (var ri = 0; ri < obj.roles.length; ri++) {
        if (roles[obj.roles[ri]] && roles[obj.roles[ri]].length > 0) {
          covered = true;
          break;
        }
      }
      if (!covered) {
        var roleNames = [];
        for (var rni = 0; rni < obj.roles.length; rni++) {
          if (m.ROLES[obj.roles[rni]]) roleNames.push(m.ROLES[obj.roles[rni]].display_name);
        }
        issues.push(Issue("WARNING", "roles",
          "No roles assigned for " + obj.name + " workflow -- needs: " + roleNames.join(", ")));
      }
    }

    return issues;
  }

  // ===================================================================
  // Preferences
  // ===================================================================

  function validatePreferences(config) {
    var issues = [];
    var prefs = config.preferences || {};

    for (var key in prefs) {
      if (!m.PREFERENCES[key]) {
        issues.push(Issue("WARNING", "preferences",
          "Unknown preference: '" + key + "'",
          "Valid preferences: " + Object.keys(m.PREFERENCES).join(", ")));
      } else if (prefs[key] !== "Yes" && prefs[key] !== "No") {
        issues.push(Issue("ERROR", "preferences",
          "Preference '" + key + "' has invalid value '" + prefs[key] + "' -- must be 'Yes' or 'No'"));
      }
    }

    if (prefs.cn_without_cr === "Yes" && prefs.auto_cn_creation === "Yes") {
      issues.push(Issue("WARNING", "preferences",
        "Both 'CN without CR' and 'Auto CN Creation' are enabled -- " +
        "auto creation only applies when a CR exists, so this combination may be redundant"));
    }

    return issues;
  }

  // ===================================================================
  // Associations
  // ===================================================================

  function validateAssociations(config) {
    var issues = [];
    var assocs = config.associations || {};
    var prefs = config.preferences || {};

    var crToCn = assocs.cr_to_cn || {};
    if (!crToCn.enabled && prefs.cn_without_cr !== "Yes") {
      issues.push(Issue("ERROR", "associations",
        "CR->CN association is disabled but 'CN without CR' preference is 'No' -- " +
        "change notices cannot be created",
        "Enable cr_to_cn association OR set cn_without_cr to 'Yes'"));
    }

    var prToCr = assocs.pr_to_cr || {};
    var prToCn = assocs.pr_to_cn || {};
    if (!prToCr.enabled && !prToCn.enabled) {
      issues.push(Issue("INFO", "associations",
        "Problem reports have no path to either CRs or CNs -- " +
        "they will be standalone items"));
    }

    return issues;
  }

  // ===================================================================
  // Business Rules
  // ===================================================================

  function validateBusinessRules(config) {
    var issues = [];
    var rules = config.business_rules || {};

    if (!rules.rule_set_name) {
      issues.push(Issue("WARNING", "business_rules",
        "No rule set name defined -- a default will be generated"));
    }

    var blockNumbers = {};
    var rulesList = rules.rules || [];
    var hasDup = false;
    for (var ri = 0; ri < rulesList.length; ri++) {
      var bn = rulesList[ri].block_number;
      if (blockNumbers[bn]) hasDup = true;
      blockNumbers[bn] = true;
    }
    if (hasDup) {
      issues.push(Issue("WARNING", "business_rules",
        "Duplicate block numbers found -- rules with the same block number " +
        "may execute in any order"));
    }

    return issues;
  }

  // Export
  WCAI.validators = {
    validate: validate,
  };
})();
