/**
 * WCAI -- Windchill Config AI -- Data Model & Constants
 * =====================================================
 * Port of wc_config/model.py to JavaScript.
 * All constants are attached to window.WCAI.model.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};

  // ===================================================================
  // Windchill Change Object Types
  // ===================================================================

  var CHANGE_OBJECTS = {
    problem_report: {
      name: "Problem Report",
      java_type: "wt.change2.WTChangeIssue",
      default_lifecycle: "Problem Report Life Cycle",
      default_workflow: "Problem Report Workflow",
      default_team_template: "Problem Report Team",
      roles: ["change_admin_1", "pr_author"],
    },
    change_request: {
      name: "Change Request",
      java_type: "wt.change2.WTChangeRequest2",
      default_lifecycle: "Change Request Life Cycle",
      default_workflow: "Change Request Workflow",
      default_team_template: "Change Request Team",
      roles: ["change_admin_1", "change_admin_2", "change_review_board", "cr_author"],
    },
    change_notice: {
      name: "Change Notice",
      java_type: "wt.change2.WTChangeOrder2",
      default_lifecycle: "Change Notice Life Cycle",
      default_workflow: "Change Notice Workflow",
      default_team_template: "Change Notice Team",
      roles: ["change_admin_2", "change_admin_3", "change_impl"],
    },
    change_activity: {
      name: "Change Activity",
      java_type: "wt.change2.WTChangeActivity2",
      default_lifecycle: "Change Activity Life Cycle",
      default_workflow: "Change Activity Workflow",
      default_team_template: "Change Activity Team",
      roles: ["assignee", "reviewer"],
    },
  };

  // ===================================================================
  // Windchill Change Management Roles
  // ===================================================================

  var ROLES = {
    change_admin_1: {
      id: "change_admin_1",
      display_name: "Change Admin I",
      description: "Manages problem reports and change request analysis",
      used_by: ["Problem Report", "Change Request"],
    },
    change_admin_2: {
      id: "change_admin_2",
      display_name: "Change Admin II",
      description: "Creates change notices, manages CRB, audits completion",
      used_by: ["Change Request", "Change Notice", "Change Activity"],
    },
    change_admin_3: {
      id: "change_admin_3",
      display_name: "Change Admin III",
      description: "Oversees change notice execution and release",
      used_by: ["Change Notice"],
    },
    change_impl: {
      id: "change_impl",
      display_name: "Change Implementation",
      description: "Executes implementation plan tasks",
      used_by: ["Change Notice"],
    },
    change_review_board: {
      id: "change_review_board",
      display_name: "Change Review Board",
      description: "Reviews and approves/rejects change requests",
      used_by: ["Change Request"],
    },
    pr_author: {
      id: "pr_author",
      display_name: "Problem Report Author",
      description: "Creates and submits problem reports",
      used_by: ["Problem Report"],
    },
    cr_author: {
      id: "cr_author",
      display_name: "Change Request Author",
      description: "Creates and submits change requests",
      used_by: ["Change Request"],
    },
    assignee: {
      id: "assignee",
      display_name: "Assignee",
      description: "Assigned to change notice tasks",
      used_by: ["Change Activity"],
    },
    reviewer: {
      id: "reviewer",
      display_name: "Reviewer",
      description: "Reviews change notice task deliverables",
      used_by: ["Change Activity"],
    },
  };

  // ===================================================================
  // Change Management Preferences
  // ===================================================================

  var PREFERENCES = {
    cn_without_cr: {
      yaml_key: "cn_without_cr",
      display_name: "Change Notices without Change Requests",
      wc_pref_key: "changeNoticeWithoutCR",
      wc_pref_node: "ChangeManagement",
      default: "No",
      description: "Enables creating a CN without a CR",
    },
    auto_cn_creation: {
      yaml_key: "auto_cn_creation",
      display_name: "Automatic Change Notice Creation",
      wc_pref_key: "autoChangeNotice",
      wc_pref_node: "ChangeManagement",
      default: "No",
      description: "Auto-create CN from CR task page",
    },
    sequenced_plan: {
      yaml_key: "sequenced_plan",
      display_name: "Sequenced Plan Execution Order",
      wc_pref_key: "sequencedPlan",
      wc_pref_node: "ChangeManagement",
      default: "No",
      description: "Execute change tasks in sequence",
    },
    cr_to_cn_cardinality: {
      yaml_key: "cr_to_cn_cardinality",
      display_name: "CR to CN Cardinality",
      wc_pref_key: "crToCnCardinality",
      wc_pref_node: "ChangeManagement",
      default: "No",
      description: "Allow many:many CR-to-CN linking (default: many:1)",
    },
    cr_to_pr_cardinality: {
      yaml_key: "cr_to_pr_cardinality",
      display_name: "CR to PR Cardinality",
      wc_pref_key: "crToPrCardinality",
      wc_pref_node: "ChangeManagement",
      default: "No",
      description: "Allow many:many CR-to-PR linking (default: many:1)",
    },
    optional_review: {
      yaml_key: "optional_review",
      display_name: "Optional Review Allowed",
      wc_pref_key: "optionalReview",
      wc_pref_node: "ChangeManagement",
      default: "No",
      description: "Change task without review",
    },
    info_propagation: {
      yaml_key: "info_propagation",
      display_name: "Change Information Propagation",
      wc_pref_key: "infoPropagation",
      wc_pref_node: "ChangeManagement",
      default: "No",
      description: "Propagate data PR->CR->CN",
    },
    affected_end_items: {
      yaml_key: "affected_end_items",
      display_name: "Affected End Items Display",
      wc_pref_key: "affectedEndItems",
      wc_pref_node: "ChangeManagement",
      default: "Yes",
      description: "Show affected end items table",
    },
  };

  // ===================================================================
  // Association Rule Types
  // ===================================================================

  var ASSOCIATION_TYPES = {
    pr_to_cr: {
      role_a: "Problem Report",
      role_b: "Change Request",
      assoc_type: "Change Process",
      standard: true,
      description: "Group problems into formal change requests",
    },
    cr_to_cn: {
      role_a: "Change Request",
      role_b: "Change Notice",
      assoc_type: "Change Process",
      standard: true,
      description: "Approved requests become implementation orders",
    },
    cn_to_task: {
      role_a: "Change Notice",
      role_b: "Change Activity",
      assoc_type: "Change Process",
      standard: true,
      description: "Break notices into assignable tasks",
    },
    pr_to_cn: {
      role_a: "Problem Report",
      role_b: "Change Notice",
      assoc_type: "Change Process",
      standard: false,
      description: "Shortcut: Skip CR step for urgent/simple changes",
    },
  };

  // ===================================================================
  // Helper: Build model metadata (mirrors Python get_model_metadata)
  // ===================================================================

  function getModelMetadata() {
    var rolesOut = {};
    for (var rk in ROLES) {
      rolesOut[rk] = {
        display_name: ROLES[rk].display_name,
        description: ROLES[rk].description,
        used_by: ROLES[rk].used_by.slice(),
      };
    }

    var prefsOut = {};
    for (var pk in PREFERENCES) {
      prefsOut[pk] = {
        display_name: PREFERENCES[pk].display_name,
        description: PREFERENCES[pk].description,
        default: PREFERENCES[pk].default,
      };
    }

    var assocsOut = {};
    for (var ak in ASSOCIATION_TYPES) {
      assocsOut[ak] = {
        role_a: ASSOCIATION_TYPES[ak].role_a,
        role_b: ASSOCIATION_TYPES[ak].role_b,
        description: ASSOCIATION_TYPES[ak].description,
        standard: ASSOCIATION_TYPES[ak].standard,
      };
    }

    var objsOut = {};
    for (var ok in CHANGE_OBJECTS) {
      objsOut[ok] = {
        name: CHANGE_OBJECTS[ok].name,
        java_type: CHANGE_OBJECTS[ok].java_type,
        default_lifecycle: CHANGE_OBJECTS[ok].default_lifecycle,
        default_workflow: CHANGE_OBJECTS[ok].default_workflow,
        default_team_template: CHANGE_OBJECTS[ok].default_team_template,
        roles: CHANGE_OBJECTS[ok].roles.slice(),
      };
    }

    return {
      roles: rolesOut,
      preferences: prefsOut,
      associations: assocsOut,
      change_objects: objsOut,
    };
  }

  // Export
  WCAI.model = {
    CHANGE_OBJECTS: CHANGE_OBJECTS,
    ROLES: ROLES,
    PREFERENCES: PREFERENCES,
    ASSOCIATION_TYPES: ASSOCIATION_TYPES,
    getModelMetadata: getModelMetadata,
  };
})();
