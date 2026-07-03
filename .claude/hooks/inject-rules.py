#!/usr/bin/env python3
"""PreToolUse hook: inject package-level RULES.md into additionalContext."""
import sys
import json
from pathlib import Path

input_data = json.load(sys.stdin)
file_path = input_data.get("tool_input", {}).get("file_path", "")

if not file_path:
    sys.exit(0)

# Map path prefixes to their RULES.md locations.
# Add entries here for each package in your monorepo.
PACKAGE_RULES: dict[str, str] = {
    # "packages/api/": "packages/api/RULES.md",
    # "packages/web/": "packages/web/RULES.md",
}

for prefix, rules_path in PACKAGE_RULES.items():
    if prefix in file_path:
        p = Path(rules_path)
        if not p.exists():
            break
        rules = p.read_text()[:9000]  # 10k char limit, leave headroom
        package_name = prefix.strip("/").split("/")[-1]
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "additionalContext": f"[{package_name} rules]\n{rules}"
            }
        }))
        break

sys.exit(0)
