# 04 Teacher Portal

## SPEC

Build `/app/teacher/*` for classes, sessions, students, materials, assignments, grading, quizzes, question bank, calendar, messages, reports, Quran review, and profile.

## PLAN

- Map the teacher to Nile classes/rosters and exact Moodle delivery courses,
  sections, resources, assignments, quizzes, outcomes, attendance, and messages.

## IMPLEMENT

- Keep class allocation, schedules, attendance, reminders, and Quran review in
  Nile Learn.
- Implement Moodle-owned materials, assignments, quizzes, questions, grading,
  feedback, and completion through scoped projections, full allowlisted CRUD
  commands, or authenticated native Moodle launches.
- Keep state auditable.

## VERIFY

- Create a Nile session, save attendance, create/update/archive a synthetic
  Moodle resource, assignment, and quiz, verify grading read-back, and send a
  Nile message.
- Test desktop/mobile routes.
- Run `scripts/verify.sh`.

## REVIEW

- UI reviewer.
- QA reviewer.
- Data architect.

## FIX

Fix class selection, roster, attendance, and material state issues.

## DOCUMENT

Update teacher portal notes.
