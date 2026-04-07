#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name // "Claude"')
DIR=$(echo "$input" | jq -r '.workspace.current_dir // "."')
PROJECT="${DIR##*/}"
BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null || echo "")
IS_DIRTY=$(git -C "$DIR" status --porcelain 2>/dev/null | head -1)

CTX_PCT=$(echo "$input" | jq -r '(.context_window.used_percentage // 0) | floor')
USAGE_PCT=$(echo "$input" | jq -r '(.rate_limits.five_hour.used_percentage // 0)' | awk '{printf "%d", $1}')
RESETS_AT=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // 0')

R="\033[0m"
c() { printf "\033[38;2;%s;%s;%sm" "$1" "$2" "$3"; }

CYAN=$(c 94 173 247)      # #5EADF7 — model name
YELLOW=$(c 232 196 97)    # #E8C461 — project name
PURPLE=$(c 160 86 212)    # #A056D4 — git branch
GRAY=$(c 102 102 102)     # #666666 — labels, dim text
WHITE=$(c 255 255 255)    # #FFFFFF — usage pct

# TrueColor bar: filled and empty use █ with different fg colors
# Context: filled=#2d5a2d (dark green), empty=#1a2e1a (darker green)
# Usage:   filled=#5EADF7 (cyan-blue),  empty=#1a2a40 (dark navy)
make_bar() {
  local pct=$1 width=$2 fc=$3 ec=$4
  local filled=$(( pct * width / 100 ))
  local empty=$(( width - filled ))
  local bar=""
  [ "$filled" -gt 0 ] && bar+="${fc}" && for ((i=0;i<filled;i++)); do bar+="█"; done
  [ "$empty"  -gt 0 ] && bar+="${ec}" && for ((i=0;i<empty;i++));  do bar+="█"; done
  bar+="${R}"
  printf "%b" "$bar"
}

CTX_FILL=$(c 70 140 70)
CTX_EMPTY=$(c 26 46 26)
USG_FILL=$(c 94 173 247)
USG_EMPTY=$(c 26 42 64)

reset_str=""
if [ "$RESETS_AT" -gt 0 ] 2>/dev/null; then
  NOW=$(date +%s)
  DIFF=$(( RESETS_AT - NOW ))
  if [ "$DIFF" -gt 0 ]; then
    HRS=$(( DIFF / 3600 ))
    MINS=$(( (DIFF % 3600) / 60 ))
    reset_str=" (resets in ${HRS}h ${MINS}m)"
  fi
fi

branch_display=""
if [ -n "$BRANCH" ]; then
  star=""; [ -n "$IS_DIRTY" ] && star="*"
  branch_display=" ${PURPLE}git:(${BRANCH}${star})${R}"
fi

printf "${CYAN}[${MODEL}]${R} | ${YELLOW}${PROJECT}${R}${branch_display}\n"

CTX_BAR=$(make_bar "$CTX_PCT" 10 "$CTX_FILL" "$CTX_EMPTY")
USG_BAR=$(make_bar "$USAGE_PCT" 10 "$USG_FILL" "$USG_EMPTY")

printf "${GRAY}Context${R} ${CTX_BAR} ${GRAY}${CTX_PCT}%%${R} | ${GRAY}Usage${R} ${USG_BAR} ${WHITE}${USAGE_PCT}%%${R}${GRAY}${reset_str}${R}\n"
