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
  local guides=(
    CLAUDE.md
    AGENTS.md
    package.json
    docs/NILE_LEARN_MASTER_PLAN.md
    docs/MODERNIZATION_EXECUTION_CONTRACT.md
  )
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
    package.json
    docs/NILE_LEARN_MASTER_PLAN.md
    docs/MODERNIZATION_EXECUTION_CONTRACT.md
    docs/UI_INFORMATION_ARCHITECTURE.md
    docs/DESIGN_V2.md
    docs/SIMPLE_UI.md
    docs/legacy-ems-discovery.md
    docs/production-persistence-architecture.md
    docs/production-persistence-plan.md
    docs/session-hardening-plan.md
    docs/auth-session-hardening.md
    docs/internal-admin-workflows.md
    docs/qa-baseline.md
    supabase/manual/README.md
    docs/decisions/README.md
    docs/decisions/ADR-001-system-authority.md
    docs/decisions/ADR-002-durable-sessions-and-role-grants.md
    docs/decisions/ADR-003-moodle-read-projection.md
    docs/decisions/ADR-004-finite-legacy-ems-migration.md
    docs/decisions/ADR-005-atomic-audit-and-outbox.md
    docs/decisions/ADR-006-nile-forms-authority.md
    docs/decisions/ADR-007-nile-forms-processing-boundary.md
    scripts/validate-phase1-schema.mjs
    scripts/validate-phase1-pglite.mjs
    scripts/validate-phase2-session-schema.mjs
    scripts/validate-phase2-session-pglite.mjs
    scripts/validate-phase2-session-postgrest.mjs
    scripts/validate-phase2-session-supabase.ts
    scripts/validate-nile-forms-schema.mjs
    scripts/validate-nile-forms-pglite.mjs
    scripts/validate-nile-forms-program-contract.mjs
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
    .codex/prompts/16-modernization-execution.md
    .codex/prompts/17-nile-forms.md
    .codex/prompts/18-nile-forms-production-core.md
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
    if kill -0 "$QA_SERVER_PID" >/dev/null 2>&1; then
      kill "$QA_SERVER_PID" >/dev/null 2>&1 || true
      wait "$QA_SERVER_PID" >/dev/null 2>&1 || true
    fi
  fi
}

portal_qa_summary_path() {
  node -e 'const path = require("node:path"); const dir = process.env.QA_OUTPUT_DIR || path.join(process.cwd(), "output", "playwright"); console.log(path.join(dir, "portal-qa-summary.json"));'
}

print_portal_qa_summary() {
  local summary_path
  summary_path="$(portal_qa_summary_path)"
  if [[ ! -r "$summary_path" ]]; then
    printf 'Portal QA summary was not written: %s\n' "$summary_path" >&2
    return 0
  fi
  node -e '
    const fs = require("node:fs");
    const summary = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const simplify = (value) => {
      if (!value) return value;
      if (typeof value !== "object") return value;
      const result = {};
      for (const key of ["stage", "elapsedMs", "role", "route", "firstRoute", "lastRoute", "routeCount"]) {
        if (value[key] !== undefined) result[key] = value[key];
      }
      return Object.keys(result).length ? result : value;
    };
    console.error("Portal QA summary:");
    console.error(JSON.stringify({
      outputPath: process.argv[1],
      inProgress: summary.inProgress ?? false,
      interrupted: summary.interrupted ?? false,
      elapsedMs: summary.elapsedMs,
      totalChecks: summary.totalChecks,
      failedChecks: summary.failedChecks,
      currentProgress: simplify(summary.currentProgress),
      lastCheck: summary.lastCheck ? {
        name: summary.lastCheck.name,
        ok: summary.lastCheck.ok,
        role: summary.lastCheck.role,
        route: summary.lastCheck.route,
      } : null,
      lastBrowserCommand: summary.lastBrowserCommand,
      failures: (summary.failures || []).slice(0, 5),
    }, null, 2));
  ' "$summary_path" >&2
}

run_portal_qa() {
  set +e
  run_package_script qa:portals
  local status=$?
  set -e
  if [[ "$status" -ne 0 ]]; then
    print_portal_qa_summary
  fi
  return "$status"
}

handle_verify_signal() {
  local signal="$1"
  printf '\nVerification interrupted by %s\n' "$signal" >&2
  print_portal_qa_summary
  stop_portal_qa_server
  if [[ "$signal" == "SIGINT" ]]; then
    exit 130
  fi
  exit 143
}

trap stop_portal_qa_server EXIT
trap 'handle_verify_signal SIGINT' INT
trap 'handle_verify_signal SIGTERM' TERM

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
  local data_dir="${QA_LOCAL_DATA_DIR:-${ROOT_DIR}/.local-data/portal-qa-${QA_SESSION:-$$}}"
  export QA_BASE_URL="$base_url"

  if [[ "${QA_RESET_LOCAL_STATE:-1}" == "1" ]]; then
    rm -f "${data_dir}/platform-state.json" "${data_dir}/platform-records.json"
  fi

  if node -e "fetch(process.argv[1]).then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))" "${base_url}/auth/login"; then
    printf 'Using existing portal server at %s\n' "$base_url"
    return 0
  fi

  printf 'Starting portal QA server at %s\n' "$base_url"
  PORT="$port" \
    NODE_ENV=production \
    NILE_PLATFORM_STATE_LOCAL_ONLY=1 \
    NILE_FORMS_COMPATIBILITY_ENABLED=1 \
    NILE_FORMS_DRAFT_KEY=000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f \
    NILE_FORMS_PUBLIC_HMAC_KEY=101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f \
    NILE_FORMS_PUBLIC_HMAC_KEY_VERSION=1 \
    NILE_FORMS_ALLOWED_ORIGINS="$base_url" \
    NILE_LOCAL_DATA_DIR="$data_dir" \
    node dist-server/index.js >/tmp/nile-learn-portal-qa.log 2>&1 &
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

if has_script "check:phase1-schema"; then
  run_step "Phase 1 schema contract" run_package_script check:phase1-schema
fi

if has_script "check:phase1-schema:runtime"; then
  run_step "Phase 1 PostgreSQL runtime" run_package_script check:phase1-schema:runtime
fi

if has_script "check:phase2-session-schema"; then
  run_step "Phase 2B session schema contract" \
    run_package_script check:phase2-session-schema
fi

if has_script "check:phase2-session-schema:runtime"; then
  run_step "Phase 2B session PostgreSQL runtime" \
    run_package_script check:phase2-session-schema:runtime
fi

if has_script "check:forms-program"; then
  run_step "Nile Forms program contract" run_package_script check:forms-program
fi

if has_script "check:forms-schema"; then
  run_step "Nile Forms schema contract" run_package_script check:forms-schema
fi

if has_script "check:forms-schema:runtime"; then
  run_step "Nile Forms PostgreSQL runtime" \
    run_package_script check:forms-schema:runtime
fi

if has_script "check:forms-phase13f1"; then
  run_step "Nile Forms Phase 13F1 contract" \
    run_package_script check:forms-phase13f1
fi

if has_script "check:forms-phase13f1:runtime"; then
  run_step "Nile Forms Phase 13F1 PostgreSQL runtime" \
    run_package_script check:forms-phase13f1:runtime
fi

if has_script "check:phase1-schema:supabase"; then
  if [[ "${RUN_SUPABASE_LOCAL_CHECK:-0}" == "1" ]]; then
    run_step "Phase 1 local Supabase promotion gate" \
      run_package_script check:phase1-schema:supabase
  else
    printf '\n==> Phase 1 local Supabase promotion gate skipped (RUN_SUPABASE_LOCAL_CHECK=1 to enable)\n'
  fi
fi

if has_script "check:forms-phase13f1:supabase"; then
  if [[ "${RUN_SUPABASE_LOCAL_CHECK:-0}" == "1" ]]; then
    run_step "Nile Forms Phase 13F1 local Supabase gate" \
      run_package_script check:forms-phase13f1:supabase
  else
    printf '\n==> Nile Forms Phase 13F1 local Supabase gate skipped (RUN_SUPABASE_LOCAL_CHECK=1 to enable)\n'
  fi
fi

run_step "TypeScript check" run_package_script check
run_step "Unit tests" run_package_script test
run_step "Production build" run_package_script build

if has_script "qa:portals"; then
  if [[ "${SKIP_PORTAL_QA:-0}" != "1" ]]; then
    export QA_SESSION="${QA_SESSION:-nile-portals-verify-$$}"
    export NILE_DEMO_PASSWORD="${NILE_DEMO_PASSWORD:-qa-${QA_SESSION}}"
    export QA_SUITE_TIMEOUT_MS="${QA_SUITE_TIMEOUT_MS:-2700000}"
    export QA_COMMAND_TIMEOUT_MS="${QA_COMMAND_TIMEOUT_MS:-90000}"
    export QA_ROUTE_MATRIX_ROUTE_TIMEOUT_MS="${QA_ROUTE_MATRIX_ROUTE_TIMEOUT_MS:-7000}"
    export QA_WORKFLOW_READY_TIMEOUT_MS="${QA_WORKFLOW_READY_TIMEOUT_MS:-8000}"
    export QA_WORKFLOW_ACTION_TIMEOUT_MS="${QA_WORKFLOW_ACTION_TIMEOUT_MS:-12000}"
    export QA_LOGIN_TIMEOUT_MS="${QA_LOGIN_TIMEOUT_MS:-30000}"
    run_step "Portal QA server" start_portal_qa_server
    run_step "Portal QA" run_portal_qa
  else
    printf '\n==> Portal QA skipped (SKIP_PORTAL_QA=1)\n'
  fi
fi

printf '\nVerification complete.\n'
