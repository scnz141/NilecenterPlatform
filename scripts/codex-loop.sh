#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FEATURE="${1:-}"
PROMPT="${2:-}"

if [[ -z "$FEATURE" ]]; then
  cat <<'USAGE'
Usage:
  scripts/codex-loop.sh <feature-name> <prompt-file>

Examples:
  scripts/codex-loop.sh student-dashboard .codex/prompts/03-student-portal.md
  RUN_PORTAL_QA=1 scripts/codex-loop.sh super-admin .codex/prompts/08-super-admin.md
USAGE
  exit 2
fi

if [[ -z "$PROMPT" ]]; then
  printf 'Prompt file is required. Pass the matching .codex/prompts/*.md file.\n' >&2
  exit 2
fi

for guide in CLAUDE.md AGENTS.md; do
  if [[ ! -r "$guide" ]]; then
    printf 'Required guide is missing or unreadable: %s\n' "$guide" >&2
    exit 2
  fi
done

printf 'Nile Learn Codex loop\n'
printf 'Feature: %s\n' "$FEATURE"

if [[ ! -r "$PROMPT" ]]; then
  printf 'Prompt file not found or unreadable: %s\n' "$PROMPT" >&2
  exit 2
fi

printf 'Prompt: %s\n\n' "$PROMPT"
sed -n '1,220p' "$PROMPT"
printf '\n'

cat <<'LOOP'
Loop:
  1. READ      Read CLAUDE.md, AGENTS.md, matching prompt, and target files.
  2. SPEC      Define route, role, data model, permissions, UX states, acceptance criteria.
  3. PLAN      Identify files, components, store actions, routes, tests.
  4. IMPLEMENT Make the scoped change.
  5. VERIFY    Run scripts/verify.sh or targeted commands.
  6. REVIEW    Use reviewer agents/manual review.
  7. FIX       Patch findings and rerun failing checks.
  8. DOCUMENT  Update AGENTS.md, prompt notes, README, or checklist.
LOOP

if [[ "${CODEX_LOOP_READ_ONLY:-0}" == "1" ]]; then
  printf '\nRead-only loop complete. Verification skipped because CODEX_LOOP_READ_ONLY=1.\n'
elif [[ "${CODEX_LOOP_FULL:-0}" == "1" ]]; then
  printf '\nRunning full verification now...\n'
  "$ROOT_DIR/scripts/verify.sh"
else
  printf '\nRunning fast loop verification now...\n'
  if [[ "${USE_PNPM:-0}" == "1" ]] && command -v pnpm >/dev/null 2>&1; then
    pnpm run check
    pnpm run test
  else
    npm run check
    npm test -- --run
  fi
  printf '\nFast loop complete. Set CODEX_LOOP_FULL=1 to run scripts/verify.sh.\n'
fi
