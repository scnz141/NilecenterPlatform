# 06 HOD Portal

## SPEC

Build `/app/hod/*` for departments, programs, courses, Moodle source, levels, curriculum, teachers, classes, assessments, certificates, reports, and messages.

## PLAN

- Map Nile departments, programs, levels, offerings, classes, and teachers to
  versioned Moodle templates, delivery courses, sections, activities, and
  question-bank contexts.

## IMPLEMENT

- Build Nile governance for catalog mapping, teacher/class oversight,
  certificate eligibility, and reports.
- Manage Moodle template/course curriculum through full allowlisted CRUD or an
  authenticated native Moodle authoring launch; never create parallel native
  Nile learning records.

## VERIFY

- Create/update/archive a synthetic Moodle curriculum module, inspect read-back
  and reconciliation, approve/issue certificates, and test reports.
- Run `scripts/verify.sh`.

## REVIEW

- Data architect.
- QA reviewer.

## FIX

Fix academic ownership, course mapping, and certificate state issues.

## DOCUMENT

Document academic governance rules.
