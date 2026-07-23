-- RETIRED: do not apply.
-- Moodle is the sole writable authority for assignments, submissions, grades,
-- quizzes, questions, attempts, completion, and learning feedback.
-- See docs/decisions/ADR-010-moodle-owned-learning-authority.md.

do $$
begin
  raise exception using
    message = 'Package 026 is retired: learning records are managed in Moodle.',
    hint = 'Use the reviewed Moodle projection and command packages instead.';
end;
$$;
