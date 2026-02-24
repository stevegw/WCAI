"""
Windchill Config -- Validator
============================
Validates a loaded config against Windchill requirements. Returns
a list of issues (errors, warnings, info) so the user can fix
their YAML before generating artifacts.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from .model import ROLES, PREFERENCES, CHANGE_OBJECTS


class Severity(Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class Issue:
    severity: Severity
    section: str
    message: str
    fix_hint: Optional[str] = None


def validate(config: dict) -> list[Issue]:
    """Validate a config and return all issues found."""
    issues = []
    issues.extend(_validate_company(config))
    issues.extend(_validate_people(config))
    issues.extend(_validate_groups(config))
    issues.extend(_validate_roles(config))
    issues.extend(_validate_preferences(config))
    issues.extend(_validate_associations(config))
    issues.extend(_validate_business_rules(config))
    return issues


def _validate_company(config: dict) -> list[Issue]:
    issues = []
    company = config.get("company", {})

    if not company.get("name"):
        issues.append(Issue(
            Severity.ERROR, "company",
            "Company name is required",
            "Set company.name in your YAML config"
        ))

    if not company.get("org"):
        issues.append(Issue(
            Severity.ERROR, "company",
            "Windchill organization name is required",
            "Set company.org to your OrgContainer name"
        ))

    if company.get("context_level") not in ("site", "organization"):
        issues.append(Issue(
            Severity.WARNING, "company",
            f"Invalid context_level: '{company.get('context_level')}' -- defaulting to 'organization'",
            "Use 'site' or 'organization'"
        ))

    return issues


def _validate_people(config: dict) -> list[Issue]:
    issues = []
    people = config.get("people", [])

    if not people:
        issues.append(Issue(
            Severity.ERROR, "people",
            "No people defined -- at least one person is needed for role assignment",
            "Add entries under the 'people' section"
        ))

    ids_seen = set()
    usernames_seen = set()
    for p in people:
        pid = p.get("id", "")
        if not pid:
            issues.append(Issue(Severity.ERROR, "people", f"Person missing 'id': {p.get('name', '?')}"))
        elif pid in ids_seen:
            issues.append(Issue(Severity.ERROR, "people", f"Duplicate person id: '{pid}'"))
        ids_seen.add(pid)

        if not p.get("username"):
            issues.append(Issue(
                Severity.ERROR, "people",
                f"Person '{pid}' missing Windchill username",
                "This must match their Windchill login"
            ))
        elif p["username"] in usernames_seen:
            issues.append(Issue(Severity.ERROR, "people", f"Duplicate username: '{p['username']}'"))
        usernames_seen.add(p.get("username", ""))

        if not p.get("name"):
            issues.append(Issue(Severity.WARNING, "people", f"Person '{pid}' has no display name"))

    return issues


def _validate_groups(config: dict) -> list[Issue]:
    issues = []
    group_ids = {g["id"] for g in config.get("groups", [])}

    for p in config.get("people", []):
        if p.get("group") and p["group"] not in group_ids:
            issues.append(Issue(
                Severity.WARNING, "groups",
                f"Person '{p['id']}' references group '{p['group']}' which doesn't exist",
                "Add the group to the 'groups' section or remove the group reference"
            ))

    return issues


def _validate_roles(config: dict) -> list[Issue]:
    issues = []
    roles = config.get("roles", {})
    people_index = config.get("_people_index", {})
    group_ids = {g["id"] for g in config.get("groups", [])}
    valid_ids = set(people_index.keys()) | group_ids

    # Check critical roles have assignments
    critical_roles = ["change_admin_1", "change_admin_2", "change_admin_3"]
    for role_id in critical_roles:
        assigned = roles.get(role_id, [])
        if not assigned:
            role_def = ROLES.get(role_id)
            issues.append(Issue(
                Severity.WARNING, "roles",
                f"Critical role '{role_def.display_name}' has no group assigned",
                f"Assign at least one group to roles.{role_id}"
            ))

    # Check all assignments reference real groups or people
    for role_id, assigned_ids in roles.items():
        if role_id not in ROLES:
            issues.append(Issue(
                Severity.WARNING, "roles",
                f"Unknown role: '{role_id}'",
                f"Valid roles: {', '.join(ROLES.keys())}"
            ))
            continue

        for ref_id in assigned_ids:
            if ref_id not in valid_ids:
                issues.append(Issue(
                    Severity.ERROR, "roles",
                    f"Role '{role_id}' references '{ref_id}' which is not a known group or person",
                    "Add this as a group in the 'groups' section or as a person in the 'people' section"
                ))

    # Check for role conflicts
    ca2_groups = set(roles.get("change_admin_2", []))
    if ca2_groups and len(ca2_groups) == 1:
        issues.append(Issue(
            Severity.INFO, "roles",
            "Change Admin II has a single group for both CR and CN workflows. "
            "If you need different groups per workflow, consider overriding team templates "
            "at the sub-organizational level instead of using context teams.",
        ))

    # Check every change object has at least one role covered
    for obj_key, obj in CHANGE_OBJECTS.items():
        covered = any(roles.get(role_id) for role_id in obj.roles)
        if not covered:
            issues.append(Issue(
                Severity.WARNING, "roles",
                f"No roles assigned for {obj.name} workflow -- "
                f"needs: {', '.join(ROLES[r].display_name for r in obj.roles)}",
            ))

    return issues


def _validate_preferences(config: dict) -> list[Issue]:
    issues = []
    prefs = config.get("preferences", {})

    for key, val in prefs.items():
        if key not in PREFERENCES:
            issues.append(Issue(
                Severity.WARNING, "preferences",
                f"Unknown preference: '{key}'",
                f"Valid preferences: {', '.join(PREFERENCES.keys())}"
            ))
        elif val not in ("Yes", "No"):
            issues.append(Issue(
                Severity.ERROR, "preferences",
                f"Preference '{key}' has invalid value '{val}' -- must be 'Yes' or 'No'"
            ))

    # Logical consistency checks
    if prefs.get("cn_without_cr") == "Yes" and prefs.get("auto_cn_creation") == "Yes":
        issues.append(Issue(
            Severity.WARNING, "preferences",
            "Both 'CN without CR' and 'Auto CN Creation' are enabled -- "
            "auto creation only applies when a CR exists, so this combination may be redundant"
        ))

    return issues


def _validate_associations(config: dict) -> list[Issue]:
    issues = []
    assocs = config.get("associations", {})
    prefs = config.get("preferences", {})

    if not assocs.get("cr_to_cn", {}).get("enabled") and prefs.get("cn_without_cr") != "Yes":
        issues.append(Issue(
            Severity.ERROR, "associations",
            "CR->CN association is disabled but 'CN without CR' preference is 'No' -- "
            "change notices cannot be created",
            "Enable cr_to_cn association OR set cn_without_cr to 'Yes'"
        ))

    if not assocs.get("pr_to_cr", {}).get("enabled") and not assocs.get("pr_to_cn", {}).get("enabled"):
        issues.append(Issue(
            Severity.INFO, "associations",
            "Problem reports have no path to either CRs or CNs -- "
            "they will be standalone items"
        ))

    return issues


def _validate_business_rules(config: dict) -> list[Issue]:
    issues = []
    rules = config.get("business_rules", {})

    if not rules.get("rule_set_name"):
        issues.append(Issue(
            Severity.WARNING, "business_rules",
            "No rule set name defined -- a default will be generated"
        ))

    # Check block number uniqueness
    block_numbers = [r.get("block_number") for r in rules.get("rules", [])]
    if len(block_numbers) != len(set(block_numbers)):
        issues.append(Issue(
            Severity.WARNING, "business_rules",
            "Duplicate block numbers found -- rules with the same block number "
            "may execute in any order"
        ))

    return issues


def format_report(issues: list[Issue]) -> str:
    """Format validation issues as a human-readable report."""
    if not issues:
        return "[ok] Configuration is valid -- no issues found."

    errors = [i for i in issues if i.severity == Severity.ERROR]
    warnings = [i for i in issues if i.severity == Severity.WARNING]
    infos = [i for i in issues if i.severity == Severity.INFO]

    lines = []
    lines.append(f"\n{'=' * 60}")
    lines.append(f"  VALIDATION REPORT")
    lines.append(f"  {len(errors)} errors - {len(warnings)} warnings - {len(infos)} info")
    lines.append(f"{'=' * 60}")

    for severity_name, group, icon in [
        ("ERRORS", errors, "X"),
        ("WARNINGS", warnings, "!"),
        ("INFO", infos, "i"),
    ]:
        if not group:
            continue
        lines.append(f"\n  {severity_name}:")
        for issue in group:
            lines.append(f"  {icon} [{issue.section}] {issue.message}")
            if issue.fix_hint:
                lines.append(f"    -> {issue.fix_hint}")

    lines.append(f"\n{'=' * 60}")

    can_generate = len(errors) == 0
    if can_generate:
        lines.append("  [ok] No errors -- safe to generate configuration artifacts.")
    else:
        lines.append("  [FAIL] Fix errors above before generating artifacts.")
    lines.append(f"{'=' * 60}\n")

    return "\n".join(lines)
