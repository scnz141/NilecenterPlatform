# 01 Public Site

## SPEC

Build and harden public Nile Center pages: homepage, course catalog, course details, trial/placement booking, and certificate verification.

## PLAN

- Inspect public routes and catalog data.
- Map forms to local/domain service behavior.
- Define loading, empty, success, and error states.

## IMPLEMENT

- Use existing Nile Learn visual system.
- Avoid generic marketing-only pages; make booking and verification usable.
- Keep English/Arabic/RTL readiness.

## VERIFY

- `npm run check`
- `npm test -- --run`
- `npm run build`
- Browser test desktop and mobile public routes.

## REVIEW

- UI reviewer for visual hierarchy and responsiveness.
- QA reviewer for form behavior.

## FIX

Fix validation, route, layout, and accessibility findings.

## DOCUMENT

Document public flow assumptions and remaining external integration limits.
