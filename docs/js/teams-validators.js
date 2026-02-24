/**
 * WCAI -- Teams & Participants -- Validators
 * ============================================
 * Validates teams config: licenses, groups, org admin, orphaned users.
 * Attached to window.WCAI.teamsValidators.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};
  var tm = WCAI.teamsModel;

  function Issue(severity, section, message, fix_hint) {
    return {
      severity: severity,
      section: section,
      message: message,
      fix_hint: fix_hint || null,
    };
  }

  function validate(teamsConfig, sharedConfig) {
    var issues = [];
    issues = issues.concat(validateOrg(teamsConfig));
    issues = issues.concat(validateUsers(sharedConfig));
    issues = issues.concat(validateGroups(sharedConfig));
    issues = issues.concat(validateLicenses(teamsConfig, sharedConfig));
    issues = issues.concat(validateContextRoles(teamsConfig, sharedConfig));
    return issues;
  }

  function validateOrg(tc) {
    var issues = [];
    var org = tc.org || {};
    if (!org.name) {
      issues.push(Issue("ERROR", "organization",
        "Organization name is required",
        "Set the organization name in Step 1"));
    }
    if (!org.admins || org.admins.length === 0) {
      issues.push(Issue("WARNING", "organization",
        "No organization administrators assigned",
        "Assign at least one org admin before creating groups or configuring access control"));
    }
    return issues;
  }

  function validateUsers(sc) {
    var issues = [];
    var people = sc.people || [];
    if (people.length === 0) {
      issues.push(Issue("WARNING", "users",
        "No users defined yet",
        "Add users in Step 3"));
    }
    var idsSeen = {};
    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      if (!p.username) {
        issues.push(Issue("ERROR", "users",
          "User '" + (p.name || "?") + "' has no username"));
      }
      if (p.id && idsSeen[p.id]) {
        issues.push(Issue("ERROR", "users",
          "Duplicate user ID: '" + p.id + "'"));
      }
      idsSeen[p.id || ""] = true;
    }
    return issues;
  }

  function validateGroups(sc) {
    var issues = [];
    var groups = sc.groups || [];
    var people = sc.people || [];

    if (groups.length === 0) {
      issues.push(Issue("WARNING", "groups",
        "No groups defined yet",
        "Add groups in Step 4"));
    }

    var groupIds = {};
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      groupIds[g.id] = true;
      var members = [];
      for (var pi = 0; pi < people.length; pi++) {
        if (people[pi].group === g.id) members.push(people[pi]);
      }
      if (members.length === 0) {
        issues.push(Issue("WARNING", "groups",
          "Group '" + (g.name || g.id) + "' has no members",
          "Add users to this group or remove it if unused"));
      }
    }

    for (var pi2 = 0; pi2 < people.length; pi2++) {
      var p = people[pi2];
      if (!p.group) {
        issues.push(Issue("WARNING", "groups",
          "User '" + (p.name || p.username || "?") + "' is not in any group",
          "Assign this user to a group for proper role resolution"));
      } else if (!groupIds[p.group]) {
        issues.push(Issue("ERROR", "groups",
          "User '" + (p.name || p.username) + "' references non-existent group '" + p.group + "'"));
      }
    }

    return issues;
  }

  function validateLicenses(tc, sc) {
    var issues = [];
    var licenses = tc.licenses || {};
    var people = sc.people || [];

    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      var pid = p.id || p.username;
      if (!pid) continue;
      if (!licenses[pid]) {
        issues.push(Issue("WARNING", "licenses",
          "User '" + (p.name || pid) + "' has no license assigned",
          "All users need a license group to access Windchill"));
      } else if (licenses[pid] === 'ptc_view' || licenses[pid] === 'ptc_contributor') {
        var lt = tm.LICENSE_TYPES[licenses[pid]];
        issues.push(Issue("INFO", "licenses",
          "User '" + (p.name || pid) + "' has '" + (lt ? lt.name : licenses[pid]) +
          "' license -- this may not support all change management actions"));
      }
    }

    return issues;
  }

  function validateContextRoles(tc, sc) {
    var issues = [];
    var ctxRoles = tc.context_roles || {};
    var groupIds = {};
    var groups = sc.groups || [];
    for (var gi = 0; gi < groups.length; gi++) {
      groupIds[groups[gi].id] = true;
    }

    for (var roleId in ctxRoles) {
      var gids = ctxRoles[roleId] || [];
      for (var i = 0; i < gids.length; i++) {
        if (!groupIds[gids[i]]) {
          issues.push(Issue("ERROR", "teams",
            "Context role '" + roleId + "' references non-existent group '" + gids[i] + "'"));
        }
      }
    }

    return issues;
  }

  WCAI.teamsValidators = {
    validate: validate,
  };
})();
