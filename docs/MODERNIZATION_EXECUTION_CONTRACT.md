# Nile Learn Modernization Execution Contract

## Authority

This contract governs agent orchestration and phase gates.

For every implementation slice, read:

- `CLAUDE.md`
- `AGENTS.md`
- `docs/NILE_LEARN_MASTER_PLAN.md`
- this contract
- the matching `.codex/prompts/*.md` file

UI work also requires `DESIGN.md`, `docs/DESIGN_V2.md`, and
`docs/SIMPLE_UI.md`. The stricter rule wins.

## Non-Negotiables

- Nile Learn remains in internal alpha stabilization and modernization.
- Preserve the accepted portal QA baseline: exactly 1,634 checks and 0
  failures. A count change requires an intentional QA-scope decision and an
  updated accepted baseline.
- Preserve server-derived identity and scope, RBAC, RLS, validation, action
  gates, audit logging, and fake-only demo data.
- Full synthetic Moodle CRUD is approved only in the dedicated sandbox under
  ADR-011 and the current master-plan checkpoint. Production Moodle activation,
  EMS, payment, email/SMS/WhatsApp, meeting, and production media integrations
  remain prohibited until their master-plan phase is explicitly approved.
- Legacy staff credentials and browser automation are discovery tools only.
  They are never production integration mechanisms.
- A live provider requires server-only credentials, a threat and data design,
  sandbox proof, idempotency, reconciliation, rollback, and full validation.

## Slice Rule

One slice changes one workflow, route family, infrastructure boundary, or
component family. It has one primary owner and one explicit write set.

The current checkpoint and only approved next implementation slice live in
`docs/NILE_LEARN_MASTER_PLAN.md` under **Current Modernization Checkpoint**.
Agents must read that section at task start and must not restate phase status or
the next slice in this contract. No agent may apply a migration remotely,
switch a runtime default, or begin an unapproved phase without a new checkpoint
and its own gate evidence.

Before implementation, define:

- user and role;
- problem and desired outcome;
- authoritative data source;
- domain transition and invariants;
- server permissions and scope;
- route and page type;
- loading, empty, error, disabled, success, and denied states;
- exact files allowed to change;
- focused and regression tests;
- rollback plan.

## Ownership

- The primary execution agent owns scope, write-set approval, implementation,
  integration, validation, and completion evidence.
- There is one writer per shared file or authority boundary.
- UI reviewer owns visual, responsive, accessibility, and design-contract
  review.
- QA reviewer owns route, workflow, state-transition, and regression review.
- RBAC and security reviewers own protected routes, APIs, sessions, scope, RLS,
  privacy, and credentials.
- Data architect owns domain relationships, persistence, reports, migration,
  reconciliation, and provider authority.
- Review agents remain read-only until assigned a specific fix with an explicit
  write set.

## Allowed Parallelism

- One writer at a time in the primary worktree.
- Up to three read-only reviewers may run concurrently after scope is locked.
- Parallel writers require separate worktrees and disjoint route, file, and test
  ownership approved by the primary agent.
- Shared authority files are serialized: routing, shell/navigation, domain
  types, actions, auth, server gates, repositories, migrations/RLS, QA scripts,
  package/config files, lockfiles, and global styling.
- Integration and final verification are always serial.
- More agents do not justify broader scope.

## Execution Gates

### Gate 0: Baseline

- Record branch and worktree status.
- Identify existing unrelated changes without reverting them.
- Record the accepted QA artifact and current protected count.
- Stop if an existing failure cannot be separated from the requested work.

### Gate 1: Spec

- Lock the slice, role, data authority, permissions, UX states, acceptance
  criteria, write set, tests, owners, and reviewers.
- Link the relevant master-plan phase and matching feature prompt.
- Do not implement while a source-of-truth decision is unresolved.

### Gate 2: Implement

- Make the smallest coherent diff.
- Preserve compatibility unless the approved slice explicitly removes it.
- Add focused tests with the behavior.
- Do not cross authorization, provider, migration, or file-ownership boundaries.

### Gate 3: Focused Verify

Run the smallest relevant checks first:

- affected unit or server tests;
- `npm run check`;
- `npm test -- --run`;
- `npm run build`;
- focused browser or portal workflow checks;
- assigned reviewer passes.

### Gate 4: Integrated Verify

Run `scripts/verify.sh` when routes, workflows, RBAC, persistence, shared UI, or
portal behavior can change.

Completion requires:

- command exit status 0;
- a final portal summary that is not interrupted or in progress;
- 1,634 checks and 0 failures, unless an approved QA-scope change establishes a
  new baseline;
- no unresolved high-confidence reviewer finding.

Documentation-only work may use targeted formatting and clean-diff checks when
no executable behavior changed.

### Gate 5: Close

- Resolve or explicitly disposition every finding.
- Update architecture, workflow, QA, or migration documentation when authority
  changed.
- Report exact evidence and remaining limitations.
- Do not declare a phase complete because a UI renders.

## Stop Conditions

Stop and report when:

- scope is materially ambiguous;
- the baseline is red;
- another writer changes owned files;
- the task cascades beyond the approved slice;
- real credentials or production data are required without approval;
- a destructive migration lacks rollback;
- a provider cannot support the required capability;
- success requires weakening security, tests, audit, RLS, or RBAC;
- an interrupted or missing QA artifact is the only evidence;
- the same failure makes no progress after two evidence-based attempts.

## Completion Evidence

Every implementation report includes:

- mandatory guidance files read;
- master-plan phase and slice;
- owner and write set;
- exact files changed;
- exact commands and exit results;
- focused test results;
- reviewer findings and dispositions;
- UI evidence where applicable;
- QA artifact path and final check/failure count;
- integration-authority confirmation;
- rollback posture;
- remaining risks and limitations.

## Definition Of Done

A slice is done only when behavior, authorization, persistence, audit, UI state,
tests, documentation, and rollback posture agree. Partial implementation must be
reported as partial and must not advance the next dependent phase.
