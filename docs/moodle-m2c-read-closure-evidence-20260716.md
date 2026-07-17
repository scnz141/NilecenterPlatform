# Moodle M2C-R Read-Closure Evidence

## Decision Boundary

This record closes only the M2C-R read-contract lane on the dedicated practice
sandbox. It does not enable a Nile Learn runtime route, provider persistence,
portal projection, Moodle write, Supabase change, or production credential.

ADR-009 and `docs/MOODLE_INTEGRATION_EXECUTION_PLAN.md` remain authoritative.
All records and content used by this run were synthetic.

## Accepted Contract

- A dedicated authorised-users-only service exposed exactly the 31 approved
  read functions.
- One disposable read-service user and one separate disposable learner were
  used. No real user identity or document entered the campaign.
- The missing H5P and SCORM fixtures were created through a temporary
  administrator-private WebDAV path. That path was not added to Nile Learn.
- H5P evidence contained one attempt with one nested result.
- SCORM evidence contained a completed attempt, score `100`, and bounded total
  time.
- Every live response passed the existing provider-neutral parser,
  boundedness, and forbidden-field checks.

Two complete passes produced 31 successes, zero failures, and the same combined
fingerprint:

`25c9d418fa19337412488068310abf212f2507be4e02d6156385be5170d610d8`

The two sanitized artifacts are byte-identical with SHA-256
`b99fca2c96ac4b492155cbbc7a8b38f1c374e4f2b2f55c5943fecadad003dc82`.
The tracked, machine-readable proof is
`docs/qa-attestations/moodle-m2cr-phase2-20260716.json`.

## Provider Finding And Fix

Moodle 4.5 returned numeric summary tracks such as `score_raw` alongside
standard string-valued `cmi.*` tracks. The old parser rejected the whole
response before deciding whether an element was approved. The parser now first
requires every track value to be a bounded string or finite number, ignores
unknown elements, and projects only the explicit `cmi.*` allowlist. Regression
tests prove that summary tracks cannot become projected authority.

The minimum-privilege read role temporarily required
`mod/h5pactivity:reviewattempts` and `mod/scorm:viewreport`. Both capabilities
were revoked after the reads and were independently observed as unchecked.

## Cleanup And Credential Teardown

Cleanup was completed in dependency order and then checked again as an absent
no-op:

- course-module IDs `9`, `10`, and `11` are absent from course `2`;
- synthetic users `32` and `33` report deleted-account state;
- disposable service ID `5` is absent;
- private fixture uploads are absent after a fresh page load;
- private WebDAV repository instance ID `9` is absent;
- user-context WebDAV instances are disabled again;
- the temporary H5P content type and all eight package dependency libraries are
  absent;
- the retired service token returns Moodle `invalidtoken`;
- temporary local credential files, the ngrok override, the WebDAV process,
  the ngrok process, and listener port `8766` are gone.

The repository stores no token, password, raw provider payload, provider error
detail, or real identity from the campaign.

## Local Quality Gate

The evidence validator checks the two-pass counts and fingerprints, cleanup and
teardown claims, optional local artifact hashes, and credential-shaped text.
The complete phase-boundary `scripts/verify.sh` run passed all static and
portable database, session, and Forms gates; TypeScript; 572 unit tests across
50 files; the production build; and 1,598 portal checks with zero failures. The
portal artifact SHA-256 is
`08a3fc040c2cca399fe15060ef4988bc69b8f53ff9e1f2d1750e040610fab8d5`.

## Remaining Boundary

This closes M2C-R only. The integration stabilization program now advances to
its ownership-matrix phase. Later content, learner, outcome, operations, and
denial loops remain gated until that matrix is complete. Production Moodle
writes and portal provider actions remain blocked.
