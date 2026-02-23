"""
Windchill Config — Interactive CLI
===================================
The main entry point. Provides:
  - wizard     Interactive setup that builds your company YAML
  - validate   Check a YAML config for issues
  - generate   Produce deployment artifacts from a YAML config
  - deploy     Deploy artifacts to Windchill (or --dry-run)
  - show       Display current config summary

Usage:
  python -m wc_config wizard                     # Interactive setup
  python -m wc_config generate -c config.yaml    # Generate artifacts
  python -m wc_config validate -c config.yaml    # Validate config
  python -m wc_config show -c config.yaml        # Show summary
"""

import argparse
import sys
from pathlib import Path

from .loader import load_config, save_config
from .validators import validate, format_report, Severity
from .generators import generate_all
from .model import ROLES, PREFERENCES, CHANGE_OBJECTS, ASSOCIATION_TYPES
from .wizard import run_wizard


def main():
    parser = argparse.ArgumentParser(
        prog="wc-config",
        description="Windchill Change Management — Configuration-as-Code",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m wc_config wizard                         # Interactive setup
  python -m wc_config wizard -o my_company.yaml      # Save to specific file
  python -m wc_config validate -c config.yaml        # Check config
  python -m wc_config generate -c config.yaml        # Generate all artifacts
  python -m wc_config generate -c config.yaml -o out # Output to 'out' dir
  python -m wc_config show -c config.yaml            # Display summary
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # ─── wizard ───────────────────────────────────────────────
    p_wizard = subparsers.add_parser("wizard", help="Interactive setup wizard")
    p_wizard.add_argument("-o", "--output", default="company_config.yaml",
                          help="Output YAML file (default: company_config.yaml)")
    p_wizard.add_argument("-c", "--config", default=None,
                          help="Existing config to edit (resume wizard)")

    # ─── validate ─────────────────────────────────────────────
    p_validate = subparsers.add_parser("validate", help="Validate a YAML config")
    p_validate.add_argument("-c", "--config", required=True, help="YAML config file")

    # ─── generate ─────────────────────────────────────────────
    p_generate = subparsers.add_parser("generate", help="Generate deployment artifacts")
    p_generate.add_argument("-c", "--config", required=True, help="YAML config file")
    p_generate.add_argument("-o", "--output", default="generated",
                            help="Output directory (default: generated)")
    p_generate.add_argument("--force", action="store_true",
                            help="Generate even with validation warnings")

    # ─── show ─────────────────────────────────────────────────
    p_show = subparsers.add_parser("show", help="Display config summary")
    p_show.add_argument("-c", "--config", required=True, help="YAML config file")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    try:
        if args.command == "wizard":
            cmd_wizard(args)
        elif args.command == "validate":
            cmd_validate(args)
        elif args.command == "generate":
            cmd_generate(args)
        elif args.command == "show":
            cmd_show(args)
    except KeyboardInterrupt:
        print("\n\nAborted.")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_wizard(args):
    """Run the interactive setup wizard."""
    existing = None
    if args.config:
        existing = load_config(args.config)
        print(f"\n  Resuming wizard from: {args.config}")

    config = run_wizard(existing_config=existing)

    save_config(config, args.output)
    print(f"\n  ✓ Configuration saved to: {args.output}")
    print(f"    Next: python -m wc_config validate -c {args.output}")
    print(f"          python -m wc_config generate -c {args.output}")


def cmd_validate(args):
    """Validate a config file."""
    config = load_config(args.config)
    issues = validate(config)
    report = format_report(issues)
    print(report)

    errors = [i for i in issues if i.severity == Severity.ERROR]
    sys.exit(1 if errors else 0)


def cmd_generate(args):
    """Generate deployment artifacts."""
    config = load_config(args.config)

    # Validate first
    issues = validate(config)
    errors = [i for i in issues if i.severity == Severity.ERROR]

    if errors and not args.force:
        print(format_report(issues))
        print("  ✗ Fix errors before generating. Use --force to override.")
        sys.exit(1)

    if issues:
        print(format_report(issues))

    output_dir = Path(args.output)
    files = generate_all(config, output_dir)

    print(f"\n{'═' * 60}")
    print(f"  ARTIFACTS GENERATED")
    print(f"  Company: {config['company']['name']}")
    print(f"  Output:  {output_dir.resolve()}")
    print(f"{'═' * 60}")
    for f in files:
        size = f.stat().st_size
        print(f"  {'✓':>3s} {f.name:<35s} {size:>6,d} bytes")
    print(f"{'═' * 60}")
    print(f"\n  Deploy with:")
    print(f"    cd {output_dir.resolve()}")
    print(f"    source $WT_HOME/bin/adminTools/windchillenv.sh")
    print(f"    bash deploy_all.sh          # full deployment")
    print(f"    bash deploy_all.sh --dry-run # preview only")
    print()


def cmd_show(args):
    """Display a summary of the config."""
    config = load_config(args.config)
    company = config["company"]
    people = config["people"]
    groups = config["groups"]
    roles = config["roles"]
    prefs = config["preferences"]
    assocs = config["associations"]

    print(f"\n{'═' * 60}")
    print(f"  {company['name']} — Windchill Change Configuration")
    print(f"{'═' * 60}")

    print(f"\n  COMPANY")
    print(f"  {'Organization:':<20s} {company['org']}")
    print(f"  {'Site:':<20s} {company['site']}")
    print(f"  {'Context level:':<20s} {company['context_level']}")
    print(f"  {'Lock preferences:':<20s} {'Yes' if company.get('lock_preferences') else 'No'}")
    print(f"  {'Flexible change:':<20s} {'Yes' if company.get('use_flexible_change') else 'No'}")

    print(f"\n  GROUPS ({len(groups)})")
    for g in groups:
        print(f"    {g['id']:<12s} {g['name']}")

    print(f"\n  PEOPLE ({len(people)})")
    for p in people:
        grp = p.get('group', '')
        print(f"    {p['username']:<12s} {p['name']:<25s} [{grp}]")

    print(f"\n  ROLE ASSIGNMENTS")
    for role_id, role_def in ROLES.items():
        assigned = roles.get(role_id, [])
        names = [config.get("_people_index", {}).get(pid, {}).get("name", pid) for pid in assigned]
        status = ", ".join(names) if names else "— UNASSIGNED —"
        print(f"    {role_def.display_name:<25s} {status}")

    print(f"\n  PREFERENCES")
    for pref_key, pref_def in PREFERENCES.items():
        val = prefs.get(pref_key, pref_def.default)
        marker = "●" if val == "Yes" else "○"
        print(f"    {marker} {pref_def.display_name:<45s} {val}")

    print(f"\n  ASSOCIATIONS")
    for assoc_key, assoc_def in ASSOCIATION_TYPES.items():
        user_assoc = assocs.get(assoc_key, {})
        enabled = user_assoc.get("enabled", False)
        marker = "●" if enabled else "○"
        print(f"    {marker} {assoc_def['role_a']:<18s} → {assoc_def['role_b']:<18s} {'ENABLED' if enabled else 'DISABLED'}")

    print(f"\n{'═' * 60}\n")


if __name__ == "__main__":
    main()
