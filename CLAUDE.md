# CLAUDE.md

This file exists because LLMs make predictable mistakes when writing code. These are not suggestions. They are repository rules for Nile Learn work.

Follow this file together with `AGENTS.md` and the matching `.codex/prompts/*.md` prompt before changing code.

## Scope And Precedence

`CLAUDE.md` owns engineering discipline: read-before-write, simplicity, surgical diffs, debugging, dependency discipline, verification, communication, and anti-patterns.

`AGENTS.md` owns Nile Learn product scope, roles, security/RBAC rules, route coverage, repository commands, portal specs, and response format.

The matching `.codex/prompts/*.md` file owns feature-specific acceptance criteria.

If instructions conflict, follow the stricter rule. For auth, backend behavior, RBAC, RLS, secrets, and Nile Learn product behavior, defer to `AGENTS.md` unless the user explicitly asks for a safer stricter change.

## 1. Read Before You Write

Before writing anything:

- Read the files you are about to modify.
- Read nearby files that already solve a similar problem.
- Check imports before introducing a new library or style.
- Check tests and domain store behavior before changing logic.
- Prefer existing components, routes, data models, design tokens, and helper APIs.

Do not generate code that is alien to this codebase. If there is no established pattern, say so and choose the smallest consistent approach.

## 2. Think Before You Code

Do not start coding until the target behavior is clear.

- State assumptions when requirements are broad.
- Name important tradeoffs before implementing them.
- Keep architectural decisions visible.
- If multiple approaches exist, briefly identify the practical options and choose one.
- If the requirement is unclear enough that a wrong implementation would be costly, stop and ask.

For Nile Learn, preserve the current auth/backend behavior unless the user explicitly asks to change it.

## 3. Simplicity

Write the minimum code that solves this specific problem now.

Avoid:

- premature abstractions
- interfaces with one implementation
- configurable values that do not need configuration
- generic services for one current use case
- speculative error handling that hides the real state

Prefer direct, readable, typed implementation that matches the surrounding code.

## 4. Surgical Changes

Keep diffs focused.

- Do not touch unrelated files.
- Do not reformat unrelated code.
- Match the style of the file you edit.
- Clean up only the unused imports, variables, and code caused by your own change.
- Do not run repo-wide formatting unless the task is explicitly a formatting pass.

Every changed line should have a direct connection to the requested feature or fix.

## 5. Verification

The difference between code that works and code you think works is verification.

For normal implementation work, run:

- `scripts/verify.sh`

For a fast inner loop, run:

- `scripts/codex-loop.sh <feature-name> <prompt-file>`

Use `AGENTS.md` and `.codex/config.toml` as the command inventory. Do not duplicate command policy in this file.

If a command fails:

1. Read the full error.
2. Make the smallest relevant fix.
3. Rerun the failing command.
4. Report any blocker honestly.

Do not claim a check passed unless it actually ran and passed.

## 6. Goal-Driven Execution

Every task must have a clear success criterion. Use the Standard Loop in `AGENTS.md` for portal and feature work.

Do not skip directly from a vague request to implementation.

## 7. Debugging

When something breaks, investigate instead of guessing.

- Read the full error message and stack trace.
- Reproduce before fixing.
- Change one thing at a time.
- Do not add workarounds until the root cause is understood.
- If repeated attempts do not make progress, state what was tried and what is still unknown.

## 8. Dependencies

Do not add dependencies casually.

Before adding a package:

- Check whether the project already has a tool for the job.
- Check whether the standard library is enough.
- Check bundle/runtime impact.
- Check maintenance and security posture.

When adding a dependency is justified, say why and update the relevant lockfile through the project package manager.

## 9. Communication

Be precise and useful.

- Say what changed and why.
- Flag tradeoffs and remaining risks.
- Do not explain basics the user already knows.
- Report exact commands run and their results.
- Use file references for important changes.

For review-style work, list findings first, ordered by severity, with file/line evidence.

## 10. Common Failure Modes To Avoid

- Kitchen sink changes: do not restructure half the repo for one feature.
- Wrong abstraction: do not generalize before there are real repeated cases.
- Invisible decisions: do not hide schema, auth, route, or API choices.
- Optimistic path only: implement loading, empty, error, disabled, and success states where relevant.
- Knowledge hallucination: inspect actual source and installed APIs before using them.
- Style drift: match the project, not a preferred style.
- Runaway refactor: if a small change cascades, stop and reassess.

## Nile Learn Boundary

Do not restate Nile Learn product, role, portal, security, RBAC, RLS, or design rules here. Those rules live in `AGENTS.md` and the matching `.codex/prompts/*.md` file.

This file may add stricter engineering discipline, but it must not weaken or partially duplicate `AGENTS.md`.
