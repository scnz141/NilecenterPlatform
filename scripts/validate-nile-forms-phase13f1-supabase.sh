#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_ID="$(sed -n 's/^project_id = "\([^"]*\)"/\1/p' supabase/config.toml | head -1)"
API_PORT="$(sed -n '/^\[api\]/,/^\[/s/^port = \([0-9]*\)/\1/p' supabase/config.toml | head -1)"
DB_CONTAINER="supabase_db_${PROJECT_ID}"
LOCK_PID=""
LOCK_MARKER=""
LOCK_LOG=""

cleanup() {
  if [[ -n "$LOCK_PID" ]] && kill -0 "$LOCK_PID" >/dev/null 2>&1; then
    kill "$LOCK_PID" >/dev/null 2>&1 || true
    wait "$LOCK_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$LOCK_MARKER" ]]; then
    docker exec "$DB_CONTAINER" rm -f "$LOCK_MARKER" >/dev/null 2>&1 || true
  fi
  if [[ -n "$LOCK_LOG" ]]; then
    rm -f "$LOCK_LOG"
  fi
}
trap cleanup EXIT

fail() {
  printf 'Phase 13F1 local Supabase acceptance refused: %s\n' "$1" >&2
  exit 1
}

if [[ -z "$PROJECT_ID" || -z "$API_PORT" ]]; then
  fail "local project_id or API port is missing from supabase/config.toml."
fi

for linked_reference in supabase/.temp/project-ref .supabase/project-ref; do
  if [[ -s "$linked_reference" ]]; then
    fail "remove the linked project reference before local acceptance: $linked_reference"
  fi
done

if [[ -z "${DOCKER_HOST:-}" ]] && [[ -S "$HOME/.colima/nile-learn/docker.sock" ]]; then
  export DOCKER_HOST="unix://$HOME/.colima/nile-learn/docker.sock"
fi

for command_name in docker node npm supabase; do
  command -v "$command_name" >/dev/null 2>&1 \
    || fail "required command is unavailable: $command_name"
done

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 \
  || fail "recognized disposable local Supabase is not running: $DB_CONTAINER"

CONTAINER_PROJECT_ID="$(docker inspect "$DB_CONTAINER" \
  --format '{{ index .Config.Labels "com.supabase.cli.project" }}')"
COMPOSE_PROJECT_ID="$(docker inspect "$DB_CONTAINER" \
  --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
if [[ "$CONTAINER_PROJECT_ID" != "$PROJECT_ID" ]] \
  || [[ "$COMPOSE_PROJECT_ID" != "$PROJECT_ID" ]]; then
  fail "database container labels do not match the local project."
fi

run_step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  "$@"
}

psql_file() {
  local file_path="$1"
  docker exec -i "$DB_CONTAINER" \
    psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file_path"
}

psql_statement() {
  docker exec -i "$DB_CONTAINER" \
    psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$1"
}

status_value() {
  local value
  value="$(printf '%s\n' "$STATUS_OUTPUT" | sed -n "s/^$1=//p" | head -1)"
  value="${value#\"}"
  value="${value%\"}"
  printf '%s' "$value"
}

run_data_api() {
  local data_api_mode="$1"
  NILE_FORMS_PHASE13F1_DISPOSABLE_LOCAL="1" \
  SUPABASE_URL="$API_URL" \
  SUPABASE_SECRET_KEY="$SERVICE_ROLE_KEY" \
  NILE_LOCAL_SUPABASE_ANON_KEY="$ANON_KEY" \
  NILE_LOCAL_SUPABASE_JWT_SECRET="$JWT_SECRET" \
  NILE_FORMS_PHASE13F1_RACE_LOCKED="${NILE_FORMS_PHASE13F1_RACE_LOCKED:-0}" \
    node --import tsx scripts/validate-nile-forms-phase13f1-data-api.ts \
      "--mode=${data_api_mode}"
}

reload_data_api_schema() {
  psql_statement "notify pgrst, 'reload schema';"
  sleep 1
}

assert_preserved_evidence() {
  local result
  result="$(docker exec -i "$DB_CONTAINER" \
    psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -At <<'SQL'
select
  (select count(*) from public.form_definitions where id = 'f1000000-0000-4000-8000-000000000001') || '|' ||
  (select count(*) from public.form_versions where id = 'f2000000-0000-4000-8000-000000000001') || '|' ||
  (select count(*) from public.form_submissions where id in (
    'f6000000-0000-4000-8000-000000000001',
    'f6000000-0000-4000-8000-000000000002',
    'f6000000-0000-4000-8000-000000000003'
  )) || '|' ||
  (select count(*) from public.form_reviews where id = 'f8000000-0000-4000-8000-000000000001') || '|' ||
  (select count(*) from pg_catalog.pg_tables where schemaname = 'public' and tablename = 'nile_forms_repository_contract');
SQL
)"
  [[ "$result" == "1|1|3|1|0" ]] \
    || fail "rollback did not preserve the accepted Forms evidence exactly: $result"
  printf 'Accepted Phase 13A-E evidence preserved: %s\n' "$result"
}

run_locked_race() {
  local race_mode="$1"
  local token_character="$2"
  LOCK_MARKER="/tmp/nile-forms-phase13f1-${race_mode}.lock"
  LOCK_LOG="$(mktemp -t nile-forms-phase13f1-race.XXXXXX)"
  docker exec "$DB_CONTAINER" rm -f "$LOCK_MARKER" >/dev/null 2>&1 || true

  docker exec -i "$DB_CONTAINER" \
    psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
      >"$LOCK_LOG" 2>&1 <<SQL &
begin;
select id
from public.auth_sessions
where token_hash = decode(repeat('${token_character}', 64), 'hex')
for update;
\! touch ${LOCK_MARKER}
select pg_sleep(8);
commit;
\! rm -f ${LOCK_MARKER}
SQL
  LOCK_PID=$!

  local marker_ready="0"
  for _ in {1..100}; do
    if docker exec "$DB_CONTAINER" test -f "$LOCK_MARKER" >/dev/null 2>&1; then
      marker_ready="1"
      break
    fi
    if ! kill -0 "$LOCK_PID" >/dev/null 2>&1; then
      cat "$LOCK_LOG" >&2
      fail "the PostgreSQL race lock exited before becoming ready."
    fi
    sleep 0.05
  done
  [[ "$marker_ready" == "1" ]] || fail "the PostgreSQL race lock did not become ready."

  NILE_FORMS_PHASE13F1_RACE_LOCKED="1" run_data_api "$race_mode"
  wait "$LOCK_PID"
  LOCK_PID=""
  docker exec "$DB_CONTAINER" rm -f "$LOCK_MARKER" >/dev/null 2>&1 || true
  rm -f "$LOCK_LOG"
  LOCK_MARKER=""
  LOCK_LOG=""
}

run_step "Phase 13F1 static contract" npm run check:forms-phase13f1
run_step "Phase 13F1 portable PostgreSQL runtime" npm run check:forms-phase13f1:runtime
run_step "Reset recognized disposable local Supabase" supabase db reset --local
run_step "Load accepted Forms preservation fixture" \
  psql_file supabase/manual/113_phase13f1_fake_seed.sql
run_step "Apply reviewed Phase 13F1 manual SQL" \
  psql_file supabase/manual/013_phase13f1_nile_forms_normalized_persistence.sql
run_step "First Phase 13F1 semantic assertions" \
  psql_file supabase/manual/013_phase13f1_assertions.sql
reload_data_api_schema

STATUS_OUTPUT="$(supabase status -o env 2>/dev/null)"
API_URL="$(status_value API_URL)"
ANON_KEY="$(status_value ANON_KEY)"
SERVICE_ROLE_KEY="$(status_value SERVICE_ROLE_KEY)"
JWT_SECRET="$(status_value JWT_SECRET)"
EXPECTED_API_URL="http://127.0.0.1:${API_PORT}"
[[ "$API_URL" == "$EXPECTED_API_URL" ]] \
  || fail "Supabase status returned a non-local or unexpected API URL: $API_URL"
[[ -n "$ANON_KEY" && -n "$SERVICE_ROLE_KEY" && -n "$JWT_SECRET" ]] \
  || fail "Supabase status omitted required local acceptance keys."

run_step "Local Data API lifecycle" run_data_api core
run_step "Concurrent revoke-first race" run_locked_race revoke-first e
run_step "Concurrent command-first race" run_locked_race command-first f
run_step "Post-runtime semantic assertions" \
  psql_file supabase/manual/013_phase13f1_assertions.sql
run_step "Apply reviewed Phase 13F1 rollback" \
  psql_file supabase/manual/913_phase13f1_rollback.sql
run_step "Verify accepted evidence survived rollback" assert_preserved_evidence
run_step "Reapply reviewed Phase 13F1 manual SQL" \
  psql_file supabase/manual/013_phase13f1_nile_forms_normalized_persistence.sql
run_step "Second Phase 13F1 semantic assertions" \
  psql_file supabase/manual/013_phase13f1_assertions.sql
reload_data_api_schema
run_step "Reapplied Data API contract" run_data_api contract-only

printf '\nPhase 13F1 local Supabase and Data API acceptance passed.\n'
