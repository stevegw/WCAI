"""
WCAI -- Core Data Model & Constants
=========================================================
Defines the canonical Windchill change objects, roles, preferences,
and their relationships. This is the 'schema' that the YAML config
maps onto.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


# ═══════════════════════════════════════════════════════════════════
# Windchill Change Object Types
# ═══════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class ChangeObjectType:
    """Represents a Windchill change object and its default bindings."""
    name: str
    java_type: str
    default_lifecycle: str
    default_workflow: str
    default_team_template: str
    roles: tuple  # Role IDs used by this object's workflow


CHANGE_OBJECTS = {
    "problem_report": ChangeObjectType(
        name="Problem Report",
        java_type="wt.change2.WTChangeIssue",
        default_lifecycle="Problem Report Life Cycle",
        default_workflow="Problem Report Workflow",
        default_team_template="Problem Report Team",
        roles=("change_admin_1", "pr_author"),
    ),
    "change_request": ChangeObjectType(
        name="Change Request",
        java_type="wt.change2.WTChangeRequest2",
        default_lifecycle="Change Request Life Cycle",
        default_workflow="Change Request Workflow",
        default_team_template="Change Request Team",
        roles=("change_admin_1", "change_admin_2", "change_review_board", "cr_author"),
    ),
    "change_notice": ChangeObjectType(
        name="Change Notice",
        java_type="wt.change2.WTChangeOrder2",
        default_lifecycle="Change Notice Life Cycle",
        default_workflow="Change Notice Workflow",
        default_team_template="Change Notice Team",
        roles=("change_admin_2", "change_admin_3", "change_impl"),
    ),
    "change_activity": ChangeObjectType(
        name="Change Activity",
        java_type="wt.change2.WTChangeActivity2",
        default_lifecycle="Change Activity Life Cycle",
        default_workflow="Change Activity Workflow",
        default_team_template="Change Activity Team",
        roles=("assignee", "reviewer"),
    ),
}


# ═══════════════════════════════════════════════════════════════════
# Windchill Change Management Roles
# ═══════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class ChangeRole:
    """A role in the Windchill change management workflow."""
    id: str
    display_name: str
    description: str
    used_by: tuple  # Change object names that use this role


ROLES = {
    "change_admin_1": ChangeRole(
        id="change_admin_1",
        display_name="Change Admin I",
        description="Manages problem reports and change request analysis",
        used_by=("Problem Report", "Change Request"),
    ),
    "change_admin_2": ChangeRole(
        id="change_admin_2",
        display_name="Change Admin II",
        description="Creates change notices, manages CRB, audits completion",
        used_by=("Change Request", "Change Notice", "Change Activity"),
    ),
    "change_admin_3": ChangeRole(
        id="change_admin_3",
        display_name="Change Admin III",
        description="Oversees change notice execution and release",
        used_by=("Change Notice",),
    ),
    "change_impl": ChangeRole(
        id="change_impl",
        display_name="Change Implementation",
        description="Executes implementation plan tasks",
        used_by=("Change Notice",),
    ),
    "change_review_board": ChangeRole(
        id="change_review_board",
        display_name="Change Review Board",
        description="Reviews and approves/rejects change requests",
        used_by=("Change Request",),
    ),
    "pr_author": ChangeRole(
        id="pr_author",
        display_name="Problem Report Author",
        description="Creates and submits problem reports",
        used_by=("Problem Report",),
    ),
    "cr_author": ChangeRole(
        id="cr_author",
        display_name="Change Request Author",
        description="Creates and submits change requests",
        used_by=("Change Request",),
    ),
    "assignee": ChangeRole(
        id="assignee",
        display_name="Assignee",
        description="Assigned to change notice tasks",
        used_by=("Change Activity",),
    ),
    "reviewer": ChangeRole(
        id="reviewer",
        display_name="Reviewer",
        description="Reviews change notice task deliverables",
        used_by=("Change Activity",),
    ),
}


# ═══════════════════════════════════════════════════════════════════
# Change Management Preferences
# ═══════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class ChangePref:
    """A Windchill change management preference."""
    yaml_key: str
    display_name: str
    wc_pref_key: str
    wc_pref_node: str
    default: str
    description: str


PREFERENCES = {
    "cn_without_cr": ChangePref(
        yaml_key="cn_without_cr",
        display_name="Change Notices without Change Requests",
        wc_pref_key="changeNoticeWithoutCR",
        wc_pref_node="ChangeManagement",
        default="No",
        description="Enables creating a CN without a CR",
    ),
    "auto_cn_creation": ChangePref(
        yaml_key="auto_cn_creation",
        display_name="Automatic Change Notice Creation",
        wc_pref_key="autoChangeNotice",
        wc_pref_node="ChangeManagement",
        default="No",
        description="Auto-create CN from CR task page",
    ),
    "sequenced_plan": ChangePref(
        yaml_key="sequenced_plan",
        display_name="Sequenced Plan Execution Order",
        wc_pref_key="sequencedPlan",
        wc_pref_node="ChangeManagement",
        default="No",
        description="Execute change tasks in sequence",
    ),
    "cr_to_cn_cardinality": ChangePref(
        yaml_key="cr_to_cn_cardinality",
        display_name="CR to CN Cardinality",
        wc_pref_key="crToCnCardinality",
        wc_pref_node="ChangeManagement",
        default="No",
        description="Many CRs to many CNs",
    ),
    "cr_to_pr_cardinality": ChangePref(
        yaml_key="cr_to_pr_cardinality",
        display_name="CR to PR Cardinality",
        wc_pref_key="crToPrCardinality",
        wc_pref_node="ChangeManagement",
        default="No",
        description="Many CRs to many PRs",
    ),
    "optional_review": ChangePref(
        yaml_key="optional_review",
        display_name="Optional Review Allowed",
        wc_pref_key="optionalReview",
        wc_pref_node="ChangeManagement",
        default="No",
        description="Change task without review",
    ),
    "info_propagation": ChangePref(
        yaml_key="info_propagation",
        display_name="Change Information Propagation",
        wc_pref_key="infoPropagation",
        wc_pref_node="ChangeManagement",
        default="No",
        description="Propagate data PR→CR→CN",
    ),
    "affected_end_items": ChangePref(
        yaml_key="affected_end_items",
        display_name="Affected End Items Display",
        wc_pref_key="affectedEndItems",
        wc_pref_node="ChangeManagement",
        default="Yes",
        description="Show affected end items table",
    ),
}


# ═══════════════════════════════════════════════════════════════════
# Association Rule Types
# ═══════════════════════════════════════════════════════════════════

ASSOCIATION_TYPES = {
    "pr_to_cr": {
        "role_a": "Problem Report",
        "role_b": "Change Request",
        "assoc_type": "Change Process",
        "standard": True,
        "description": "Group problems into formal change requests",
    },
    "cr_to_cn": {
        "role_a": "Change Request",
        "role_b": "Change Notice",
        "assoc_type": "Change Process",
        "standard": True,
        "description": "Approved requests become implementation orders",
    },
    "cn_to_task": {
        "role_a": "Change Notice",
        "role_b": "Change Activity",
        "assoc_type": "Change Process",
        "standard": True,
        "description": "Break notices into assignable tasks",
    },
    "pr_to_cn": {
        "role_a": "Problem Report",
        "role_b": "Change Notice",
        "assoc_type": "Change Process",
        "standard": False,
        "description": "Shortcut: Skip CR step for urgent/simple changes",
    },
}
