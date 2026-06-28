# 05 Registrar Portal

## SPEC

Build `/app/registrar/*` for leads, applications, students, placement tests, enrollments, classes, schedule, payments, messages, reports, and settings.

## PLAN

- Map EMS-like lead/application/placement/enrollment/payment lifecycle.

## IMPLEMENT

- Use local domain actions for lead creation, conversion, placement result, payment record, and communication.

## VERIFY

- Create lead, convert application, record placement, record payment.
- Test detail routes and mobile layout.
- Run `scripts/verify.sh`.

## REVIEW

- QA reviewer.
- Data architect.

## FIX

Fix pipeline transitions, duplicate conversion, and payment balance issues.

## DOCUMENT

Document EMS/import boundaries.
