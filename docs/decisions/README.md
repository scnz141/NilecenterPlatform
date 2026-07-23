# Nile Learn Architecture Decisions

These records lock the production-foundation decisions referenced by
`docs/NILE_LEARN_MASTER_PLAN.md`. They are implementation constraints, not
runtime changes.

| Decision                                                             | Status             | Scope                                                         |
| -------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------- |
| [ADR-001](ADR-001-system-authority.md)                               | Accepted           | Nile Learn, Moodle, and legacy EMS authority                  |
| [ADR-002](ADR-002-durable-sessions-and-role-grants.md)               | Accepted           | Identity mapping, role grants, scopes, and sessions           |
| [ADR-003](ADR-003-moodle-read-projection.md)                         | Superseded in part | Historical first Moodle projection and reconciliation         |
| [ADR-004](ADR-004-finite-legacy-ems-migration.md)                    | Accepted           | One-way EMS migration and cutover                             |
| [ADR-005](ADR-005-atomic-audit-and-outbox.md)                        | Accepted           | Transactional domain, audit, and outbox writes                |
| [ADR-006](ADR-006-nile-forms-authority.md)                           | Accepted           | Structured forms, review, promotion, and migration            |
| [ADR-007](ADR-007-nile-forms-processing-boundary.md)                 | Accepted           | Forms evidence and typed processing-module boundary           |
| [ADR-008](ADR-008-moodle-synthetic-sandbox-write-proof.md)           | Accepted           | Synthetic-only Moodle sandbox mutation proof                  |
| [ADR-009](ADR-009-moodle-comprehensive-sandbox-contract-campaign.md) | Accepted           | Comprehensive synthetic Moodle provider-contract campaign     |
| [ADR-010](ADR-010-moodle-owned-learning-authority.md)                | Accepted           | Moodle-owned learning records and controlled command boundary |
| [ADR-011](ADR-011-full-moodle-sandbox-crud.md)                       | Accepted           | Full synthetic Moodle sandbox CRUD authorization              |

Changing an accepted decision requires a superseding ADR, affected threat and
data review, rollback plan, updated tests, and explicit approval. Do not edit an
accepted ADR to hide an architectural change.
