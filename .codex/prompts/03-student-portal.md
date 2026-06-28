# 03 Student Portal

## SPEC

Build `/app/student/*` as a complete learner workspace: dashboard, courses, custom player, assignments, quizzes, calendar, attendance, certificates, Quran progress, messages, reports, support, and profile.

## PLAN

- Inspect `WorkflowExperiences.tsx`, `FeaturePage.tsx`, `PlatformShell`, and domain state.
- Identify route params and selected entity behavior.

## IMPLEMENT

- Use real local platform actions for lessons, assignments, quizzes, support tickets, profile updates, and notifications.
- Make course/player UI classroom-board quality and mobile-safe.

## VERIFY

- Complete lesson, submit assignment, submit quiz.
- Save profile, create support ticket, mark notification read.
- Test desktop, mobile, and lesson deep links.
- Run `scripts/verify.sh`.

## REVIEW

- UI reviewer.
- QA reviewer.

## FIX

Fix player selection, stale state, overflow, and disabled-state bugs.

## DOCUMENT

Update student portal checklist and remaining integration notes.
