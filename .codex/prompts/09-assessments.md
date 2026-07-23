# 09 Assessments

## SPEC

Build assessments across student, teacher, HOD, and admin roles: assignments, quizzes, question bank, grading, attempts, submissions, feedback, and manual review.

## PLAN

- Inspect assignment, submission, quiz, attempt, grade, and rubric models.

## IMPLEMENT

- Treat Moodle as the sole authority for assignments, submissions, quizzes,
  questions, attempts, grades, and feedback.
- Use server-authorized Moodle projections for reads. Supported writes must use
  durable Moodle commands; complex authoring and attempts use a short-lived
  authenticated Moodle launch.
- In the dedicated sandbox, exercise complete create, read, update,
  archive/restore, and safe delete lifecycles for assignments, submissions,
  quizzes, questions, attempts, grades, feedback, and completion.
- Never report success from client state or a local domain mutation.
- Add teacher/HOD review where supported.

## VERIFY

- Submit assignment, submit quiz, inspect grade/attempt state, test disabled attempt state.
- Run `scripts/verify.sh`.

## REVIEW

- QA reviewer.
- Data architect.

## FIX

Fix attempt counts, feedback state, and grading queue issues.

## DOCUMENT

Document manual grading and storage limitations.
