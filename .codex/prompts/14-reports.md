# 14 Reports

## SPEC

Build role-specific reports with filters, summaries, saved views, CSV export, and audit/report row visibility.

## PLAN

- Inspect `exportReportRows`, report routes, stats, and role scopes.

## IMPLEMENT

- Build reports from local platform state, not fake static metrics only.
- Scope rows to role where necessary.

## VERIFY

- Change report type, export CSV, inspect rows, test mobile.
- Run `scripts/verify.sh`.

## REVIEW

- QA reviewer.
- Data architect.
- Security reviewer for data leakage.

## FIX

Fix metrics, filters, export shape, and role leakage.

## DOCUMENT

Document report sources and limitations.
