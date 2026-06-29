#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  "$@"
}

check_required_guides() {
  local guides=(CLAUDE.md AGENTS.md)
  for guide in "${guides[@]}"; do
    if [[ ! -r "$guide" ]]; then
      printf 'Required guide is missing or unreadable: %s\n' "$guide" >&2
      return 1
    fi
  done
}

if [[ "${USE_PNPM:-0}" == "1" ]] && command -v pnpm >/dev/null 2>&1; then
  PM="pnpm"
else
  PM="npm"
fi

run_prettier_check() {
  local targets=(
    CLAUDE.md
    AGENTS.md
    .codex/hooks.json
    .codex/prompts/00-discovery.md
    .codex/prompts/01-public-site.md
    .codex/prompts/02-auth-rbac.md
    .codex/prompts/03-student-portal.md
    .codex/prompts/04-teacher-portal.md
    .codex/prompts/05-registrar-portal.md
    .codex/prompts/06-hod-portal.md
    .codex/prompts/07-branch-admin.md
    .codex/prompts/08-super-admin.md
    .codex/prompts/09-assessments.md
    .codex/prompts/10-attendance.md
    .codex/prompts/11-calendar.md
    .codex/prompts/12-certificates.md
    .codex/prompts/13-quran-features.md
    .codex/prompts/14-reports.md
    .codex/prompts/15-security-review.md
  )

  if [[ "${FULL_FORMAT_CHECK:-0}" == "1" ]]; then
    targets=(.)
  fi

  if [[ -x "node_modules/.bin/prettier" ]]; then
    node_modules/.bin/prettier --check "${targets[@]}"
    return
  fi
  if command -v prettier >/dev/null 2>&1; then
    prettier --check "${targets[@]}"
    return
  fi
  if command -v npx >/dev/null 2>&1; then
    npx --no-install prettier --check "${targets[@]}"
    return
  fi
  printf 'Prettier is not available; skipping format check.\n'
}

run_package_script() {
  local script="$1"
  shift || true
  if [[ "$PM" == "pnpm" ]]; then
    pnpm run "$script" "$@"
  else
    npm run "$script" -- "$@"
  fi
}

has_script() {
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1)" "$1"
}

QA_SERVER_PID=""

stop_portal_qa_server() {
  if [[ -n "${QA_SERVER_PID:-}" ]]; then
    kill "$QA_SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap stop_portal_qa_server EXIT

wait_for_url() {
  local url="$1"
  for _ in {1..40}; do
    if node -e "fetch(process.argv[1]).then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))" "$url"; then
      return 0
    fi
    sleep 0.5
  done
  printf 'Timed out waiting for %s\n' "$url" >&2
  return 1
}

start_portal_qa_server() {
  local port="${QA_PORT:-3001}"
  local base_url="${QA_BASE_URL:-http://127.0.0.1:${port}}"
  export QA_BASE_URL="$base_url"

  if node -e "fetch(process.argv[1]).then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))" "${base_url}/auth/login"; then
    printf 'Using existing portal server at %s\n' "$base_url"
    return 0
  fi

  printf 'Starting portal QA server at %s\n' "$base_url"
  PORT="$port" NODE_ENV=production node dist/index.js >/tmp/nile-learn-portal-qa.log 2>&1 &
  QA_SERVER_PID="$!"
  wait_for_url "${base_url}/auth/login"
}

run_step "Package manager" printf '%s\n' "$PM"
run_step "Required guides" check_required_guides

if [[ "${SKIP_FORMAT_CHECK:-0}" != "1" ]]; then
  run_step "Prettier check" run_prettier_check
else
  printf '\n==> Prettier check skipped (SKIP_FORMAT_CHECK=1)\n'
fi

if has_script "qa:portals"; then
  run_step "Portal QA syntax" node --check scripts/qa-portals-cli.mjs
fi

run_step "TypeScript check" run_package_script check
run_step "Unit tests" run_package_script test
run_step "Production build" run_package_script build

if has_script "qa:portals"; then
  if [[ "${SKIP_PORTAL_QA:-0}" != "1" ]]; then
    run_step "Portal QA server" start_portal_qa_server
    run_step "Portal QA" run_package_script qa:portals
  else
    printf '\n==> Portal QA skipped (SKIP_PORTAL_QA=1)\n'
  fi
fi

printf '\nVerification complete.\n'
