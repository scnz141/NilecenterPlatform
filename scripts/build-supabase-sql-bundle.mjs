import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(
  repositoryRoot,
  "supabase/manual/000_nile_learn_staging_bootstrap.sql"
);
const invitationOutputPath = resolve(
  repositoryRoot,
  "supabase/manual/018_transactional_email_account_invitation_bundle.sql"
);

const sections = [
  {
    title: "Compatibility platform tables",
    path: "supabase/migrations/20260626185139_platform_demo_seed_tables.sql",
  },
  {
    title: "Compatibility state snapshots and events",
    path: "supabase/migrations/20260627110345_platform_state_snapshots.sql",
  },
  {
    title: "Phase 1 identity, scope, audit, and mapping",
    path: "supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql",
  },
  {
    title: "Phase 2B atomic session lifecycle",
    path: "supabase/migrations/20260710132000_phase2b_atomic_session_lifecycle.sql",
  },
  {
    title: "Compatibility cross-instance sessions",
    path: "supabase/migrations/20260718193000_compatibility_auth_sessions.sql",
  },
  {
    title: "Nile Forms foundation",
    path: "supabase/migrations/20260711143555_nile_forms_foundation.sql",
  },
  {
    title: "Nile Forms finite legacy import evidence",
    path: "supabase/migrations/20260711193000_nile_forms_legacy_import.sql",
  },
  {
    title: "Core installation verification",
    path: "supabase/manual/200_install_verification.sql",
  },
  {
    title: "Phase 6I Supabase pgcrypto compatibility",
    path: "supabase/manual/015_phase6i_pgcrypto_schema_compatibility.sql",
  },
  {
    title: "Phase 6A Moodle projection authority",
    path: "supabase/manual/006_phase6a_moodle_projection_authority.sql",
  },
  {
    title: "Phase 6B Moodle projection observations",
    path: "supabase/manual/007_phase6b_moodle_projection_observation.sql",
  },
  {
    title: "Phase 6E Moodle user mapping authority",
    path: "supabase/manual/008_phase6e_moodle_user_mapping_authority.sql",
  },
  {
    title: "Phase 6F Moodle enrollment and group observations",
    path: "supabase/manual/009_phase6f_moodle_enrollment_group_observation.sql",
  },
  {
    title: "Phase 6G Moodle assessment status observations",
    path: "supabase/manual/010_phase6g_moodle_assessment_status_observation.sql",
  },
  {
    title: "Phase 6H1 Moodle assignment result observations",
    path: "supabase/manual/011_phase6h1_moodle_assignment_result_observation.sql",
  },
  {
    title: "Phase 6H2 Moodle quiz attempt observations",
    path: "supabase/manual/012_phase6h2_moodle_quiz_attempt_observation.sql",
  },
  {
    title: "Phase 6H3 Moodle grade outcome observations",
    path: "supabase/manual/013_phase6h3_moodle_grade_outcome_observation.sql",
  },
  {
    title: "Phase 6H4 Moodle activity outcome observations",
    path: "supabase/manual/014_phase6h4_moodle_activity_outcome_observation.sql",
  },
  {
    title: "Transactional email delivery",
    path: "supabase/manual/016_transactional_email_delivery.sql",
  },
  {
    title: "Account invitation lifecycle",
    path: "supabase/manual/017_account_invitation_lifecycle.sql",
  },
];

const invitationSections = sections.slice(-2);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function renderSections(sourceSections) {
  const renderedSections = [];

  for (const [index, section] of sourceSections.entries()) {
    const sourcePath = resolve(repositoryRoot, section.path);
    const source = (await readFile(sourcePath, "utf8")).trimEnd();
    const number = String(index + 1).padStart(2, "0");

    renderedSections.push(
      [
        "-- ============================================================================",
        `-- ${number}. ${section.title}`,
        `-- Source: ${section.path}`,
        `-- SHA-256: ${sha256(source)}`,
        "-- ============================================================================",
        "",
        source,
      ].join("\n")
    );
  }

  return renderedSections.join("\n\n");
}

async function buildBundle() {
  const renderedSections = await renderSections(sections);

  const header = `-- Nile Learn single-file Supabase staging bootstrap
--
-- GENERATED FILE. Run \`npm run build:supabase-sql-bundle\` after changing any
-- source migration. Verify it with \`npm run check:supabase-sql-bundle\`.
--
-- TARGET: a fresh, disposable Nile Learn Supabase staging project only.
-- DO NOT paste this into production, a shared school database, or a project
-- that already contains any of these migrations. The source migrations are
-- intentionally not idempotent and each section preserves its own transaction.
-- A later section failure does not roll back sections already committed.
--
-- INCLUDED: promoted migration-history SQL, core read-only verification,
-- accepted Phase 6 read-only Moodle projection packages, and the disabled
-- transactional-email/account-invitation foundation in dependency order.
--
-- EXCLUDED: fake/demo seeds, semantic assertion fixtures, rollback drills,
-- provider credentials, Moodle writes, and Phase 13F1 normalized persistence.
-- Phase 13F1 is explicitly local-only and is not approved for remote Supabase.
--
-- This file changes schema only. It does not activate Moodle, email delivery,
-- account invitations, or any runtime environment variable.
--
-- Generated from ${sections.length} reviewed SQL sources.
`;

  const footer = `-- ============================================================================
-- Bootstrap completion marker
-- ============================================================================

select
  'Nile Learn staging schema bootstrap completed' as result,
  current_database() as database_name,
  current_timestamp as completed_at;
`;

  return `${header}\n${renderedSections}\n\n${footer}`;
}

async function buildInvitationBundle() {
  const renderedSections = await renderSections(invitationSections);
  const header = `-- Nile Learn transactional email and account invitation bundle
--
-- GENERATED FILE. Use this once after the main staging bootstrap has already
-- been applied. It contains no credentials, demo users, or provider calls.
-- Run both local static and portable-runtime invitation gates before applying.
--
-- The two included packages are rerunnable. Existing tables are preserved while
-- functions, triggers, grants, and constraints are reconciled to this version.
`;
  const footer = `-- ============================================================================
-- Account invitation bundle completion marker
-- ============================================================================

select
  'Nile Learn transactional email and account invitations installed' as result,
  current_database() as database_name,
  current_timestamp as completed_at;
`;

  return `${header}\n${renderedSections}\n\n${footer}`;
}

const expected = await buildBundle();
const expectedInvitation = await buildInvitationBundle();
const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  let current;
  try {
    current = await readFile(outputPath, "utf8");
  } catch {
    throw new Error(
      "Supabase SQL bundle is missing. Run npm run build:supabase-sql-bundle."
    );
  }

  if (current !== expected) {
    throw new Error(
      "Supabase SQL bundle is stale. Run npm run build:supabase-sql-bundle."
    );
  }

  let currentInvitation;
  try {
    currentInvitation = await readFile(invitationOutputPath, "utf8");
  } catch {
    throw new Error(
      "Account invitation SQL bundle is missing. Run npm run build:supabase-sql-bundle."
    );
  }
  if (currentInvitation !== expectedInvitation) {
    throw new Error(
      "Account invitation SQL bundle is stale. Run npm run build:supabase-sql-bundle."
    );
  }

  console.log(
    `Supabase SQL bundles are current (${sections.length} bootstrap sources).`
  );
} else {
  await writeFile(outputPath, expected, "utf8");
  await writeFile(invitationOutputPath, expectedInvitation, "utf8");
  console.log(
    `Wrote Supabase bootstrap and invitation bundles from ${sections.length} sources.`
  );
}
