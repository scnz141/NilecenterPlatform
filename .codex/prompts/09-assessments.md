# 09 Assessments

## SPEC

Build assessments across student, teacher, HOD, and admin roles: assignments, quizzes, question bank, grading, attempts, submissions, feedback, and manual review.

## PLAN

- Inspect assignment, submission, quiz, attempt, grade, and rubric models.

## IMPLEMENT

- Use domain store actions for assignment submit and quiz submit.
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
