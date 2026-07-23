import crypto from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase1File = readdirSync(path.join(root, "supabase/migrations")).find(
  file => file.endsWith("_phase1_identity_scope_session_audit_mapping.sql")
);
if (!phase1File) throw new Error("Phase 1 migration is missing.");

const readManual = file =>
  readFileSync(path.join(root, "supabase/manual", file), "utf8");
const phase1 = readFileSync(
  path.join(root, "supabase/migrations", phase1File),
  "utf8"
);
const phase6a = readManual("006_phase6a_moodle_projection_authority.sql");
const intake = readManual("020_normalized_admissions_intake_foundation.sql");
const applications = readManual(
  "021_normalized_application_conversion_foundation.sql"
);
const placement = readManual("022_normalized_placement_foundation.sql");
const forward = readManual(
  "023_normalized_admissions_delivery_read_model.sql"
);
const rollback = readManual(
  "923_normalized_admissions_delivery_read_model_rollback.sql"
);
const hash = value =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const ids = {
  registrarAuth: "51000000-0000-4000-8000-000000000001",
  adminAuth: "51000000-0000-4000-8000-000000000002",
  teacherAuth: "51000000-0000-4000-8000-000000000003",
  cairo: "52000000-0000-4000-8000-000000000001",
  alex: "52000000-0000-4000-8000-000000000002",
  department: "53000000-0000-4000-8000-000000000001",
  registrar: "54000000-0000-4000-8000-000000000001",
  admin: "54000000-0000-4000-8000-000000000002",
  teacher: "54000000-0000-4000-8000-000000000003",
  registrarGrant: "55000000-0000-4000-8000-000000000001",
  adminGrant: "55000000-0000-4000-8000-000000000002",
  teacherGrant: "55000000-0000-4000-8000-000000000003",
  registrarSession: "56000000-0000-4000-8000-000000000001",
  adminSession: "56000000-0000-4000-8000-000000000002",
  teacherProfile: "57000000-0000-4000-8000-000000000001",
  cairoProgram: "58000000-0000-4000-8000-000000000001",
  alexProgram: "58000000-0000-4000-8000-000000000002",
  cairoLevel: "59000000-0000-4000-8000-000000000001",
  alexLevel: "59000000-0000-4000-8000-000000000002",
  cairoCourse: "5a000000-0000-4000-8000-000000000001",
  alexCourse: "5a000000-0000-4000-8000-000000000002",
  cairoRun: "5b000000-0000-4000-8000-000000000001",
  alexRun: "5b000000-0000-4000-8000-000000000002",
  cairoClass: "5c000000-0000-4000-8000-000000000001",
  alexClass: "5c000000-0000-4000-8000-000000000002",
};

const database = new PGlite({ extensions: { btree_gist, citext, pgcrypto } });

async function expectRejected(label, operation) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

try {
  await database.waitReady;
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values
      ('${ids.registrarAuth}'), ('${ids.adminAuth}'), ('${ids.teacherAuth}');
  `);
  await database.exec(phase1);
  await database.exec(phase6a);
  await database.exec(intake);
  await database.exec(applications);
  await database.exec(placement);
  await database.exec(forward);
  await database.exec(forward);

  await database.exec(`
    insert into public.branches (id, legacy_id, code, name) values
      ('${ids.cairo}', 'br_cairo', 'CAIRO', 'Cairo'),
      ('${ids.alex}', 'br_alex', 'ALEX', 'Alexandria');
    insert into public.departments (id, code, name) values
      ('${ids.department}', 'ARABIC', 'Arabic and Quran');
    insert into public.department_branches (department_id, branch_id) values
      ('${ids.department}', '${ids.cairo}'),
      ('${ids.department}', '${ids.alex}');
    insert into public.app_users (
      id, auth_user_id, full_name, email, status, activated_at
    ) values
      ('${ids.registrar}', '${ids.registrarAuth}', 'Runtime Registrar',
       'registrar@example.test', 'active', now()),
      ('${ids.admin}', '${ids.adminAuth}', 'Runtime Admin',
       'admin@example.test', 'active', now()),
      ('${ids.teacher}', '${ids.teacherAuth}', 'Runtime Teacher',
       'teacher@example.test', 'active', now());
    insert into public.role_grants (
      id, user_id, role, status, starts_at, granted_by, granted_reason
    ) values
      ('${ids.registrarGrant}', '${ids.registrar}', 'registrar', 'pending',
       '2026-07-01T00:00:00Z', '${ids.admin}', 'Admissions delivery runtime fixture'),
      ('${ids.adminGrant}', '${ids.admin}', 'superadmin', 'active', now(),
       '${ids.admin}', 'Admissions delivery runtime fixture'),
      ('${ids.teacherGrant}', '${ids.teacher}', 'teacher', 'pending',
       '2026-07-01T00:00:00Z', '${ids.admin}', 'Admissions delivery runtime fixture');
    insert into public.role_grant_branch_scopes (
      role_grant_id, branch_id, starts_at, granted_by
    ) values
      ('${ids.registrarGrant}', '${ids.cairo}', '2026-07-01T00:00:00Z', '${ids.admin}'),
      ('${ids.teacherGrant}', '${ids.cairo}', '2026-07-01T00:00:00Z', '${ids.admin}');
    insert into public.role_grant_department_scopes (
      role_grant_id, department_id, starts_at, granted_by
    ) values
      ('${ids.teacherGrant}', '${ids.department}', '2026-07-01T00:00:00Z', '${ids.admin}');
    update public.role_grants
    set status = 'active'
    where id in ('${ids.registrarGrant}', '${ids.teacherGrant}');
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values
      ('${ids.registrarSession}', decode('${hash("delivery-registrar-session")}', 'hex'),
       '${ids.registrar}', '${ids.registrarGrant}', 'supabase', now() + interval '1 hour'),
      ('${ids.adminSession}', decode('${hash("delivery-admin-session")}', 'hex'),
       '${ids.admin}', '${ids.adminGrant}', 'supabase', now() + interval '1 hour');
    insert into public.staff_profiles (id, user_id, title) values
      ('${ids.teacherProfile}', '${ids.teacher}', 'Arabic Teacher');

    insert into public.programs (
      id, department_id, code, title, language
    ) values
      ('${ids.cairoProgram}', '${ids.department}', 'AR-CAIRO', 'Cairo Arabic', 'en'),
      ('${ids.alexProgram}', '${ids.department}', 'AR-ALEX', 'Alex Arabic', 'en');
    insert into public.course_levels (
      id, program_id, code, title, sort_order
    ) values
      ('${ids.cairoLevel}', '${ids.cairoProgram}', 'L1', 'Cairo Level 1', 1),
      ('${ids.alexLevel}', '${ids.alexProgram}', 'L1', 'Alex Level 1', 1);
    insert into public.course_templates (
      id, program_id, level_id, code, slug, title, description
    ) values
      ('${ids.cairoCourse}', '${ids.cairoProgram}', '${ids.cairoLevel}',
       'AR-C-1', 'cairo-arabic-1', 'Cairo Arabic Level 1', 'Cairo course'),
      ('${ids.alexCourse}', '${ids.alexProgram}', '${ids.alexLevel}',
       'AR-A-1', 'alex-arabic-1', 'Alex Arabic Level 1', 'Alex course');
    insert into public.course_runs (
      id, course_template_id, branch_id, code, term, starts_on, ends_on, status
    ) values
      ('${ids.cairoRun}', '${ids.cairoCourse}', '${ids.cairo}',
       'CAIRO-S26', 'Summer 2026', '2026-07-01', '2026-09-30', 'active'),
      ('${ids.alexRun}', '${ids.alexCourse}', '${ids.alex}',
       'ALEX-S26', 'Summer 2026', '2026-07-01', '2026-09-30', 'active');
    insert into public.class_groups (
      id, course_run_id, code, name, capacity
    ) values
      ('${ids.cairoClass}', '${ids.cairoRun}', 'GROUP-A', 'Cairo Group A', 20),
      ('${ids.alexClass}', '${ids.alexRun}', 'GROUP-A', 'Alex Group A', 18);
    insert into public.teacher_assignments (
      class_group_id, teacher_profile_id, assignment_type, starts_at, status
    ) values
      ('${ids.cairoClass}', '${ids.teacherProfile}', 'primary', now() - interval '1 day', 'active');
  `);

  const registrarResult = await database.query(
    "select * from public.nile_read_admissions_operational_workspace($1)",
    [hash("delivery-registrar-session")]
  );
  const adminResult = await database.query(
    "select * from public.nile_read_admissions_operational_workspace($1)",
    [hash("delivery-admin-session")]
  );
  const registrar = registrarResult.rows[0]?.workspace;
  const admin = adminResult.rows[0]?.workspace;

  if (
    registrar?.programs?.length !== 1 ||
    registrar?.courses?.length !== 1 ||
    registrar?.courseRuns?.length !== 1 ||
    registrar?.classGroups?.length !== 1 ||
    registrar.courseRuns[0]?.branchId !== ids.cairo ||
    registrar.courseRuns[0]?.teacherId !== ids.teacher ||
    registrar.classGroups[0]?.schedule !== "Schedule not configured"
  ) {
    throw new Error("Registrar delivery choices are not branch-scoped.");
  }
  if (
    admin?.programs?.length !== 2 ||
    admin?.courses?.length !== 2 ||
    admin?.courseRuns?.length !== 2 ||
    admin?.classGroups?.length !== 2
  ) {
    throw new Error("Super Admin delivery choices are incomplete.");
  }

  await expectRejected("browser role delivery read", () =>
    database.exec(`
      set role anon;
      select * from public.nile_read_admissions_operational_workspace(
        '${hash("delivery-registrar-session")}'
      );
    `)
  );
  await database.exec("reset role;");

  await database.exec(rollback);
  const rolledBack = await database.query(`
    select to_regprocedure(
      'public.nile_read_admissions_operational_workspace(text)'
    ) is null as read_model_removed
  `);
  if (!rolledBack.rows[0]?.read_model_removed) {
    throw new Error("Admissions delivery rollback did not remove its RPC.");
  }
  await database.exec(forward);

  console.log(
    JSON.stringify({
      ok: true,
      registrarPrograms: 1,
      registrarCourseRuns: 1,
      adminCourseRuns: 2,
      teacherAuthority: "class-assignment-derived",
      branchScope: "enforced",
      browserRoleAccess: "denied",
      rollback: "passed",
      reapply: "passed",
    })
  );
} finally {
  await database.close();
}
