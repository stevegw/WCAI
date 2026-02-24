/**
 * WCAI -- Teams & Participants -- Domain Constants
 * ==================================================
 * License types, OOTB context roles, team template types,
 * directory types, and access control patterns.
 * Attached to window.WCAI.teamsModel.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};

  var LICENSE_TYPES = {
    ptc_author: {
      id: "ptc_author",
      name: "PTC Author",
      description: "Full authoring license including all change management actions",
      change_capable: true,
    },
    ptc_pdmlink: {
      id: "ptc_pdmlink",
      name: "PTC PDMLink Module",
      description: "Core PDM module that includes change management capabilities",
      change_capable: true,
    },
    ptc_contributor: {
      id: "ptc_contributor",
      name: "PTC Contributor",
      description: "Limited capabilities -- may not cover all change management actions",
      change_capable: false,
    },
    ptc_view: {
      id: "ptc_view",
      name: "PTC View and Print Only",
      description: "View and print only -- cannot create or modify change objects",
      change_capable: false,
    },
  };

  var CONTEXT_ROLES = {
    guest: {
      id: "guest",
      name: "Guest",
      description: "View-only access to context",
      ootb: true,
    },
    members: {
      id: "members",
      name: "Members",
      description: "Standard access to context objects",
      ootb: true,
    },
    product_manager: {
      id: "product_manager",
      name: "Product Manager",
      description: "Manages the Product or Library context",
      ootb: true,
    },
    change_admin_1: {
      id: "change_admin_1",
      name: "Change Admin I",
      description: "Manages problem reports, analyzes and triages CRs",
      ootb: true,
    },
    change_admin_2: {
      id: "change_admin_2",
      name: "Change Admin II",
      description: "Creates CNs, manages CRB meetings, audits completion",
      ootb: true,
    },
    change_admin_3: {
      id: "change_admin_3",
      name: "Change Admin III",
      description: "Oversees CN execution and final release",
      ootb: true,
    },
    change_review_board: {
      id: "change_review_board",
      name: "Change Review Board",
      description: "Reviews and votes on change requests",
      ootb: true,
    },
    promotion_approvers: {
      id: "promotion_approvers",
      name: "Promotion Approvers",
      description: "Approves promotion requests",
      ootb: true,
    },
    promotion_reviewers: {
      id: "promotion_reviewers",
      name: "Promotion Reviewers",
      description: "Reviews promotion requests",
      ootb: true,
    },
  };

  var TEAM_TEMPLATES = {
    problem_report: {
      id: "problem_report",
      name: "Problem Report Team",
      roles: ["change_admin_1", "pr_author"],
    },
    change_request: {
      id: "change_request",
      name: "Change Request Team",
      roles: ["change_admin_1", "change_admin_2", "change_review_board", "cr_author"],
    },
    change_notice: {
      id: "change_notice",
      name: "Change Notice Team",
      roles: ["change_admin_2", "change_admin_3", "change_impl"],
    },
    change_activity: {
      id: "change_activity",
      name: "Change Activity Team",
      roles: ["assignee", "reviewer"],
    },
  };

  var DIRECTORY_TYPES = {
    windchill: {
      id: "windchill",
      name: "Windchill Directory (Built-in)",
      description: "Users managed directly in Windchill. Suitable for small or dev/test environments.",
    },
    ldap: {
      id: "ldap",
      name: "LDAP / Active Directory",
      description: "Users synchronized from enterprise directory. Recommended for production environments.",
    },
  };

  var AUTH_METHODS = {
    windchill: {
      id: "windchill",
      name: "Windchill Authentication",
      description: "Built-in username/password authentication",
    },
    ldap: {
      id: "ldap",
      name: "LDAP Authentication",
      description: "Authenticate against LDAP/AD directory server",
    },
    sso: {
      id: "sso",
      name: "Single Sign-On (SSO)",
      description: "SAML, OAuth, or other SSO integration",
    },
  };

  function getDefaultTeamsConfig() {
    return {
      org: {
        name: "",
        domain: "",
        admins: [],
      },
      directory: {
        type: "windchill",
        auth_method: "windchill",
        notes: "",
      },
      licenses: {},
      context_roles: {},
    };
  }

  WCAI.teamsModel = {
    LICENSE_TYPES: LICENSE_TYPES,
    CONTEXT_ROLES: CONTEXT_ROLES,
    TEAM_TEMPLATES: TEAM_TEMPLATES,
    DIRECTORY_TYPES: DIRECTORY_TYPES,
    AUTH_METHODS: AUTH_METHODS,
    getDefaultTeamsConfig: getDefaultTeamsConfig,
  };
})();
