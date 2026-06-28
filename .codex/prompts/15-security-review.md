# 15 Security Review

## SPEC

Review Nile Learn for credential safety, auth, RBAC, validation, route protection, API permissions, and privacy.

## PLAN

- Inspect `.env.example`, `.gitignore`, server routes, client env usage, Supabase integration, RBAC maps, and domain actions.
- Do not print secret values if found.

## IMPLEMENT

- Patch high-confidence findings only.
- Keep auth/backend behavior intact unless explicitly asked.

## VERIFY

- `npm run check`
- `npm test -- --run`
- `npm run build`
- Targeted route/API tests for fixed issues.

## REVIEW

- Security reviewer.
- RBAC reviewer.

## FIX

- Remove committed secrets.
- Move private values to env placeholders.
- Add permission checks.
- Add validation.

## DOCUMENT

Document residual risks and external dependency assumptions.
