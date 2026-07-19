# Moodle M2C-C Synthetic Course Lifecycle Evidence

## Boundary

This evidence covers only the dedicated practice Moodle at
`moodle-no-data.enesekremergunesh.com`. It does not enable a Nile Learn portal
write, production Moodle write, normalized runtime, Supabase mutation, worker,
or scheduler.

The fixture used generated text only. No real learner, staff, admissions,
document, payment, message, or licensed course content entered Moodle.

## Service Contract

A temporary authorised-users-only custom service exposed exactly five
functions:

- `core_webservice_get_site_info`
- `core_course_get_courses_by_field`
- `core_course_create_courses`
- `core_course_update_courses`
- `core_course_delete_courses`

The CLI client required HTTPS, the exact approved sandbox hostname, an exact
synthetic acknowledgement, a configured category, an exact capability probe,
and one canonical `NILE-M2CC-*` marker. It rejected arbitrary course IDs and
unreconciled updates or deletion.

The temporary service used the sandbox administrator as the fixture operator.
The exact service-function surface was verified, but this does not prove a
production minimum-capability role. A future production connector must use a
dedicated non-interactive service identity and a fresh capability audit.

## Accepted Live Run

- Local date: `2026-07-19`
- Sandbox course ID: `3`
- Marker: `NILE-M2CC-20260718T220614Z-e06d5f0d`
- Ensure passes: `2`
- Initial lookup: absent
- Create: completed as a hidden synthetic course
- Exact-marker readback: verified
- Update: verified by readback
- Replay: adopted the same course without duplication
- Delete: completed
- Cleanup verification: absent twice

The temporary custom service was then deleted. Moodle confirmed that deleting
the service also deleted its related token. A final client probe with the
retired token failed, and manual course management inspection found no
`NILE-M2CC-*` course.

## Local Verification

- Six focused client and workflow tests pass.
- TypeScript passes.
- The fast integration gate passes all 17 contract checks and 12 implementation
  checks, including all Phase 6 portable database lifecycles, unit tests, and
  the production build.
- The isolated full portal suite completed with `1,634` checks, `0` failures,
  and no interruption. Its summary is stored at
  `output/playwright/moodle-m2cc-portal-final-20260719-c/portal-qa-summary.json`.

Plain `scripts/verify.sh` stopped before its portal stage because the existing
Nile Forms program validator still requires the master plan to say Phase 14B is
the next unstarted slice, while the current master plan records Phase 14B as an
accepted local foundation. That unrelated checkpoint contract was not changed
as part of this Moodle proof.

## Remaining Production Gates

This proof validates Moodle course API semantics only. Production course or
enrolment writes remain blocked until all of these exist:

- normalized internal-to-external course mappings;
- durable sessions and current role/scope authority;
- atomic command, audit, and outbox writes;
- worker leases, idempotency, retry, and unknown-outcome reconciliation;
- human reconciliation for missing or conflicting mappings;
- dedicated minimum-privilege production service identity;
- production threat, privacy, rollback, and credential-rotation review.
