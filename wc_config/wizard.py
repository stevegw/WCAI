"""
Windchill Config -- Interactive Wizard
======================================
A step-by-step terminal wizard that walks users through defining
their company's Windchill configuration.

Produces a complete config dict that can be saved to YAML.
"""

import sys
from typing import Optional

from .model import ROLES, PREFERENCES, ASSOCIATION_TYPES


# --- Terminal Colors ----------------------------------------------

class C:
    """Terminal formatting -- auto-detects Windows and disables colors if needed."""
    _enabled = True

    @classmethod
    def _init(cls):
        import os, sys
        # Disable colors if not a real terminal or on older Windows
        if not hasattr(sys.stdout, "isatty") or not sys.stdout.isatty():
            cls._enabled = False
            return
        if os.name == "nt":
            # Try to enable ANSI on Windows 10+
            try:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
            except Exception:
                cls._enabled = False

    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[32m"
    CYAN = "\033[36m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    MAGENTA = "\033[35m"
    WHITE = "\033[97m"
    BG_DIM = "\033[48;5;236m"

    @staticmethod
    def _wrap(code, s):
        if not C._enabled:
            return str(s)
        return f"{code}{s}{C.RESET}"

    @staticmethod
    def green(s): return C._wrap(C.GREEN, s)
    @staticmethod
    def cyan(s): return C._wrap(C.CYAN, s)
    @staticmethod
    def yellow(s): return C._wrap(C.YELLOW, s)
    @staticmethod
    def red(s): return C._wrap(C.RED, s)
    @staticmethod
    def bold(s): return C._wrap(C.BOLD, s)
    @staticmethod
    def dim(s): return C._wrap(C.DIM, s)
    @staticmethod
    def mag(s): return C._wrap(C.MAGENTA, s)


C._init()


# --- Input Helpers ------------------------------------------------

def ask(prompt: str, default: str = "", required: bool = False) -> str:
    """Prompt user for text input with optional default."""
    suffix = f" [{C.dim(default)}]" if default else ""
    while True:
        try:
            val = input(f"  {C.cyan('>')} {prompt}{suffix}: ").strip()
        except EOFError:
            val = ""
        if not val:
            val = default
        if required and not val:
            print(f"    {C.red('Required')} -- please enter a value.")
            continue
        return val


def ask_yn(prompt: str, default: bool = True) -> bool:
    """Prompt for yes/no."""
    hint = "Y/n" if default else "y/N"
    while True:
        val = input(f"  {C.cyan('>')} {prompt} [{C.dim(hint)}]: ").strip().lower()
        if not val:
            return default
        if val in ("y", "yes"):
            return True
        if val in ("n", "no"):
            return False
        print(f"    {C.red('Enter y or n')}")


def ask_choice(prompt: str, options: list[str], default: str = "") -> str:
    """Prompt user to pick from a list."""
    print(f"  {C.cyan('>')} {prompt}")
    for i, opt in enumerate(options, 1):
        marker = C.green("*") if opt == default else C.dim("o")
        print(f"    {marker} {C.bold(str(i))}. {opt}")
    while True:
        val = input(f"    Choice [1-{len(options)}]: ").strip()
        if not val and default:
            return default
        try:
            idx = int(val) - 1
            if 0 <= idx < len(options):
                return options[idx]
        except ValueError:
            pass
        print(f"    {C.red(f'Enter 1-{len(options)}')}")


def ask_multi_choice(prompt: str, options: list[tuple[str, str]],
                     selected: list[str] = None) -> list[str]:
    """Prompt user to toggle multiple options on/off."""
    if selected is None:
        selected = []
    selected = set(selected)

    print(f"  {C.cyan('>')} {prompt}")
    print(f"    {C.dim('Enter numbers to toggle, or')} {C.bold('done')} {C.dim('to continue')}")
    while True:
        for i, (key, label) in enumerate(options, 1):
            marker = C.green("[x]") if key in selected else C.dim("[ ]")
            print(f"    {marker} {C.bold(str(i))}. {label}")
        val = input(f"    Toggle [1-{len(options)}] or {C.bold('done')}: ").strip().lower()
        if val in ("done", "d", ""):
            return [key for key, _ in options if key in selected]
        try:
            idx = int(val) - 1
            if 0 <= idx < len(options):
                key = options[idx][0]
                if key in selected:
                    selected.discard(key)
                else:
                    selected.add(key)
                continue
        except ValueError:
            pass
        print(f"    {C.red(f'Enter 1-{len(options)} or done')}")


# --- Wizard Banner ------------------------------------------------

def banner():
    print("""
============================================================
  WCAI -- WINDCHILL CONFIG AI
  Configuration Wizard
============================================================

  This wizard will walk you through defining your company's
  Windchill configuration. Your answers will
  be saved as a YAML file that can be version-controlled and
  used to generate all deployment artifacts.

  Press Ctrl+C at any time to abort.
  Press Enter to accept [defaults].
""")


# --- Wizard Steps -------------------------------------------------

def step_company(existing: dict = None) -> dict:
    """Step 1: Company & org details."""
    ex = existing or {}
    print(f"\n{C.bold('  STEP 1 OF 6: Company & Organization')}")
    print(f"  {C.dim('Define your Windchill site and organization context.')}\n")

    name = ask("Company name", ex.get("name", ""), required=True)
    org = ask("Windchill Organization (OrgContainer)", ex.get("org", ""), required=True)
    site = ask("Windchill Site name", ex.get("site", ""))

    ctx = ask_choice(
        "Deploy config at which context level?",
        ["organization", "site"],
        ex.get("context_level", "organization"),
    )

    lock = ask_yn("Lock preferences to prevent lower-context overrides?",
                   ex.get("lock_preferences", True))

    flexible = ask_yn("Use flexible change items (Windchill 11.2+)?",
                       ex.get("use_flexible_change", True))

    return {
        "name": name, "org": org, "site": site,
        "context_level": ctx, "lock_preferences": lock,
        "use_flexible_change": flexible,
    }


def step_groups(existing: list = None) -> list:
    """Step 2: Groups / departments."""
    groups = list(existing or [])

    print(f"\n{C.bold('  STEP 2 OF 6: Groups & Departments')}")
    print(f"  {C.dim('Define organizational groups. People will be assigned to these.')}")

    if groups:
        print(f"\n  Existing groups:")
        for g in groups:
            print(f"    * {g['id']}: {g['name']}")
        if not ask_yn("Keep existing groups and add more?", True):
            groups = []

    while True:
        print()
        add = ask_yn("Add a group?", default=len(groups) == 0)
        if not add:
            break

        gid = ask("Group ID (short code)", required=True)
        gname = ask("Group name", required=True)
        gdesc = ask("Description", "")

        groups.append({"id": gid, "name": gname, "description": gdesc})
        print(f"    {C.green('[ok]')} Added: {gname}")

    return groups


def step_people(existing: list = None, groups: list = None) -> list:
    """Step 3: People."""
    people = list(existing or [])
    group_ids = [g["id"] for g in (groups or [])]
    group_names = {g["id"]: g["name"] for g in (groups or [])}

    print(f"\n{C.bold('  STEP 3 OF 6: People')}")
    print(f"  {C.dim('Add team members who will participate in the change process.')}")

    if people:
        print(f"\n  Existing people:")
        for p in people:
            print(f"    * {p['username']}: {p['name']} [{p.get('group', '')}]")
        if not ask_yn("Keep existing people and add more?", True):
            people = []

    while True:
        print()
        add = ask_yn("Add a person?", default=len(people) == 0)
        if not add:
            break

        name = ask("Full name", required=True)
        username = ask("Windchill username", required=True)
        email = ask("Email", "")

        group = ""
        if group_ids:
            assign_group = ask_yn("Assign to a group?", True)
            if assign_group:
                group_options = [f"{gid} -- {group_names.get(gid, '')}" for gid in group_ids]
                choice = ask_choice("Select group", group_options)
                group = choice.split(" -- ")[0]

        pid = username  # Use username as ID by default
        people.append({
            "id": pid, "name": name, "username": username,
            "email": email, "group": group,
        })
        print(f"    {C.green('[ok]')} Added: {name} ({username})")

    return people


def step_roles(existing: dict = None, people: list = None) -> dict:
    """Step 4: Map people to roles."""
    roles = dict(existing or {})
    people = people or []

    print(f"\n{C.bold('  STEP 4 OF 6: Role Assignments')}")
    print(f"  {C.dim('Map your people to Windchill change management roles.')}")
    print(f"  {C.dim('Each role controls who gets workflow tasks.')}\n")

    if not people:
        print(f"  {C.yellow('[!]')} No people defined -- skipping role assignment.")
        return roles

    people_options = [(p["id"], f"{p['name']} ({p['username']})") for p in people]

    for role_id, role_def in ROLES.items():
        current = roles.get(role_id, [])
        print(f"\n  {C.bold(role_def.display_name)}")
        print(f"  {C.dim(role_def.description)}")
        print(f"  {C.dim('Used by: ' + ', '.join(role_def.used_by))}")

        selected = ask_multi_choice(
            f"Assign people to {role_def.display_name}:",
            people_options,
            selected=current,
        )
        roles[role_id] = selected

        if selected:
            names = [dict(people_options).get(pid, pid) for pid in selected]
            print(f"    {C.green('[x]')} {', '.join(names)}")
        else:
            print(f"    {C.yellow('[ ]')} No one assigned")

    return roles


def step_preferences(existing: dict = None) -> dict:
    """Step 5: Change management preferences."""
    prefs = dict(existing or {})

    print(f"\n{C.bold('  STEP 5 OF 6: Change Management Preferences')}")
    print(f"  {C.dim('Toggle preferences that control your change process behavior.')}\n")

    for pref_key, pref_def in PREFERENCES.items():
        current = prefs.get(pref_key, pref_def.default)
        is_yes = current == "Yes"

        val = ask_yn(
            f"{pref_def.display_name} {C.dim('-- ' + pref_def.description)}",
            default=is_yes,
        )
        prefs[pref_key] = "Yes" if val else "No"

    return prefs


def step_associations(existing: dict = None) -> dict:
    """Step 6: Association rules."""
    assocs = dict(existing or {})

    print(f"\n{C.bold('  STEP 6 OF 6: Change Association Rules')}")
    print(f"  {C.dim('Define which change objects can be linked together.')}")
    print(f"  {C.dim('PTC recommends disabling OOB rules and defining only yours.')}\n")

    for assoc_key, assoc_def in ASSOCIATION_TYPES.items():
        current = assocs.get(assoc_key, {})
        current_enabled = current.get("enabled", assoc_def["standard"])

        standard_hint = " (standard)" if assoc_def["standard"] else " (non-standard shortcut)"
        enabled = ask_yn(
            f"{assoc_def['role_a']} -> {assoc_def['role_b']}{C.dim(standard_hint)}",
            default=current_enabled,
        )

        if enabled:
            card = ask(
                f"  Cardinality",
                current.get("cardinality", "many:1"),
            )
        else:
            card = current.get("cardinality", "many:1")

        assocs[assoc_key] = {
            "enabled": enabled,
            "cardinality": card,
            "owning_role": current.get("owning_role", "none"),
            "required_role": current.get("required_role", "none"),
        }

    return assocs


# --- Main Wizard Flow ---------------------------------------------

def run_wizard(existing_config: Optional[dict] = None) -> dict:
    """Run the full interactive wizard and return a config dict."""
    banner()

    ex = existing_config or {}

    # Step 1: Company
    company = step_company(ex.get("company"))

    # Step 2: Groups
    groups = step_groups(ex.get("groups"))

    # Step 3: People
    people = step_people(ex.get("people"), groups)

    # Step 4: Roles
    roles = step_roles(ex.get("roles"), people)

    # Step 5: Preferences
    preferences = step_preferences(ex.get("preferences"))

    # Step 6: Associations
    associations = step_associations(ex.get("associations"))

    # Build config
    config = {
        "company": company,
        "groups": groups,
        "people": people,
        "roles": roles,
        "preferences": preferences,
        "associations": associations,
        "business_rules": ex.get("business_rules", {
            "rule_set_name": f"{company['name'].replace(' ', '_').upper()}_PRE_RELEASE",
            "rules": [
                {"key": f"{company['name'].replace(' ', '_').upper()}_CHECKOUT_RULE",
                 "selector": "CHECKOUT_RULE",
                 "description": "Fails if changeable is checked out",
                 "block_number": 1},
                {"key": f"{company['name'].replace(' ', '_').upper()}_RELEASE_TARGET_RULE",
                 "selector": "RELEASE_TARGET_RULE",
                 "description": "Validates change transition",
                 "block_number": 10},
            ],
        }),
        "custom_attributes": ex.get("custom_attributes", []),
        "_people_index": {p["id"]: p for p in people},
    }

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  WIZARD COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Company:      {company['name']}")
    print(f"  Organization: {company['org']}")
    print(f"  Groups:       {len(groups)}")
    print(f"  People:       {len(people)}")
    assigned = sum(1 for r in roles.values() if r)
    print(f"  Roles mapped: {assigned}/{len(ROLES)}")
    print(f"{'=' * 60}")

    return config
