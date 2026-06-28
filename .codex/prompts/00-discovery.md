# 00 Discovery

## SPEC

Understand the current Nile Learn repository before implementing any portal slice.

## PLAN

- Inspect `package.json`, `client/src`, `server`, `shared`, `supabase`, `scripts`, and `ideas.md`.
- Identify routes, roles, domain models, design system files, and available validation commands.
- Confirm whether `.codex`, `AGENTS.md`, and verification scripts exist.

## IMPLEMENT

- Do not implement product changes during discovery unless explicitly asked.
- Produce a route/data/component map and identify the next highest-value missing workflow.

## VERIFY

- Run read-only checks first.
- Use `npm run check`, `npm test -- --run`, and `npm run build` only after edits.

## REVIEW

- Ask data/security/UI reviewer agents for targeted gaps when scope is large.

## FIX

- Patch only concrete issues found during implementation.

## DOCUMENT

- Update `AGENTS.md`, prompt files, README, or feature checklist when workflow knowledge changes.
