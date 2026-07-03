#!/usr/bin/env python3
"""PreCompact hook: inject COMPACT_RULES.md into compaction prompt."""
import sys
import json
from pathlib import Path

json.load(sys.stdin)  # consume stdin even if unused

rules_file = Path(".claude/COMPACT_RULES.md")
if not rules_file.exists():
    sys.exit(0)

rules = rules_file.read_text()[:9000]  # 10k char limit, leave headroom
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreCompact",
        "additionalContext": rules
    }
}))

sys.exit(0)
