# 03 Student Portal

## SPEC

Build `/app/student/*` as a complete learner workspace: dashboard, courses, custom player, assignments, quizzes, calendar, attendance, certificates, Quran progress, messages, reports, support, and profile.

## PLAN

- Inspect `StudentLearningPage.tsx`, `StudentAssessmentPage.tsx`, `StudentRecordsPage.tsx`, `StudentSupportPage.tsx`, `PortalMessagesPage.tsx`, `WorkflowExperiences.tsx`, `PlatformShell`, and domain state.
- Identify route params and selected entity behavior.

## IMPLEMENT

- Use Moodle projections and authenticated native Moodle launches for lessons,
  assignment submissions, quiz attempts, completion, grades, and feedback.
- Use Nile Learn actions only for support, profile, attendance, messages,
  certificates, and other Nile-owned operations.
- Make course/player UI classroom-board quality and mobile-safe.

## VERIFY

- Complete a projected lesson, submit an assignment, and attempt a quiz through
  the mapped Moodle sandbox workflow.
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
