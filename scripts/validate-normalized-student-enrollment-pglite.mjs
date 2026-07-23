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
const phase1 = readFileSync(
  path.join(root, "supabase/migrations", phase1File),
  "utf8"
);
const read = file =>
  readFileSync(path.join(root, "supabase/manual", file), "utf8");
const packages = [
  "006_phase6a_moodle_projection_authority.sql",
  "016_transactional_email_delivery.sql",
  "017_account_invitation_lifecycle.sql",
  "019_normalized_profile_support_foundation.sql",
  "020_normalized_admissions_intake_foundation.sql",
  "021_normalized_application_conversion_foundation.sql",
  "022_normalized_placement_foundation.sql",
  "023_normalized_admissions_delivery_read_model.sql",
].map(read);
const forward = read("024_normalized_student_enrollment_invitation.sql");
const rollback = read(
  "924_normalized_student_enrollment_invitation_rollback.sql"
);
const hash = value =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const ids = {
  adminAuth: "61000000-0000-4000-8000-000000000001",
  registrarAuth: "61000000-0000-4000-8000-000000000002",
  teacherAuth: "61000000-0000-4000-8000-000000000003",
  studentAuth: "61000000-0000-4000-8000-000000000004",
  outsideAuth: "61000000-0000-4000-8000-000000000005",
  cairo: "62000000-0000-4000-8000-000000000001",
  alex: "62000000-0000-4000-8000-000000000002",
  department: "63000000-0000-4000-8000-000000000001",
  admin: "64000000-0000-4000-8000-000000000001",
  registrar: "64000000-0000-4000-8000-000000000002",
  teacher: "64000000-0000-4000-8000-000000000003",
  adminGrant: "65000000-0000-4000-8000-000000000001",
  registrarGrant: "65000000-0000-4000-8000-000000000002",
  teacherGrant: "65000000-0000-4000-8000-000000000003",
  adminSession: "66000000-0000-4000-8000-000000000001",
  registrarSession: "66000000-0000-4000-8000-000000000002",
  studentSession: "66000000-0000-4000-8000-000000000003",
  teacherSession: "66000000-0000-4000-8000-000000000004",
  teacherProfile: "67000000-0000-4000-8000-000000000001",
  program: "68000000-0000-4000-8000-000000000001",
  level: "69000000-0000-4000-8000-000000000001",
  course: "6a000000-0000-4000-8000-000000000001",
  run: "6b000000-0000-4000-8000-000000000001",
  group: "6c000000-0000-4000-8000-000000000001",
  invitation: "6d000000-0000-4000-8000-000000000001",
  outsideInvitation: "6d000000-0000-4000-8000-000000000002",
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
      ('${ids.adminAuth}'), ('${ids.registrarAuth}'), ('${ids.teacherAuth}'),
      ('${ids.studentAuth}'), ('${ids.outsideAuth}');
  `);
  await database.exec(phase1);
  for (const sql of packages) await database.exec(sql);
  await database.exec(forward);
  await database.exec(forward);

  await database.exec(`
    insert into public.branches (id, legacy_id, code, name) values
      ('${ids.cairo}', 'br_cairo', 'CAIRO', 'Cairo'),
      ('${ids.alex}', 'br_alex', 'ALEX', 'Alexandria');
    insert into public.departments (id, code, name) values
      ('${ids.department}', 'ARABIC', 'Arabic and Quran');
    insert into public.department_branches (department_id, branch_id) values
      ('${ids.department}', '${ids.cairo}');
    insert into public.app_users (
      id, auth_user_id, full_name, email, status, activated_at
    ) values
      ('${ids.admin}', '${ids.adminAuth}', 'Runtime Admin',
       'admin@example.test', 'active', now()),
      ('${ids.registrar}', '${ids.registrarAuth}', 'Runtime Registrar',
       'registrar@example.test', 'active', now()),
      ('${ids.teacher}', '${ids.teacherAuth}', 'Runtime Teacher',
       'teacher@example.test', 'active', now());
    insert into public.role_grants (
      id, user_id, role, status, starts_at, granted_by, granted_reason
    ) values
      ('${ids.adminGrant}', '${ids.admin}', 'superadmin', 'active', now(),
       '${ids.admin}', 'Student lifecycle runtime fixture'),
      ('${ids.registrarGrant}', '${ids.registrar}', 'registrar', 'pending',
       '2026-07-01T00:00:00Z', '${ids.admin}', 'Student lifecycle runtime fixture'),
      ('${ids.teacherGrant}', '${ids.teacher}', 'teacher', 'pending',
       '2026-07-01T00:00:00Z', '${ids.admin}', 'Student lifecycle runtime fixture');
    insert into public.role_grant_branch_scopes (
      role_grant_id, branch_id, starts_at, granted_by
    ) values
      ('${ids.registrarGrant}', '${ids.cairo}', '2026-07-01T00:00:00Z', '${ids.admin}'),
      ('${ids.teacherGrant}', '${ids.cairo}', '2026-07-01T00:00:00Z', '${ids.admin}');
    insert into public.role_grant_department_scopes (
      role_grant_id, department_id, starts_at, granted_by
    ) values
      ('${ids.teacherGrant}', '${ids.department}', '2026-07-01T00:00:00Z', '${ids.admin}');
    update public.role_grants set status = 'active'
    where id in ('${ids.registrarGrant}', '${ids.teacherGrant}');
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values
      ('${ids.adminSession}', decode('${hash("student-admin-session")}', 'hex'),
       '${ids.admin}', '${ids.adminGrant}', 'supabase', now() + interval '1 hour'),
      ('${ids.registrarSession}', decode('${hash("student-registrar-session")}', 'hex'),
       '${ids.registrar}', '${ids.registrarGrant}', 'supabase', now() + interval '1 hour'),
      ('${ids.teacherSession}', decode('${hash("student-teacher-session")}', 'hex'),
       '${ids.teacher}', '${ids.teacherGrant}', 'supabase', now() + interval '1 hour');
    insert into public.staff_profiles (id, user_id, title) values
      ('${ids.teacherProfile}', '${ids.teacher}', 'Arabic Teacher');
    insert into public.programs (id, department_id, code, title, language)
    values ('${ids.program}', '${ids.department}', 'AR', 'Arabic', 'en');
    insert into public.course_levels (id, program_id, code, title, sort_order)
    values ('${ids.level}', '${ids.program}', 'L1', 'Arabic Level 1', 1);
    insert into public.course_templates (
      id, program_id, level_id, code, slug, title, description
    ) values (
      '${ids.course}', '${ids.program}', '${ids.level}', 'AR-L1',
      'arabic-level-1', 'Arabic Level 1', 'Runtime course'
    );
    insert into public.course_runs (
      id, course_template_id, branch_id, code, term, starts_on, ends_on, status
    ) values (
      '${ids.run}', '${ids.course}', '${ids.cairo}', 'AR-L1-S26',
      'Summer 2026', '2026-07-01', '2026-09-30', 'active'
    );
    insert into public.class_groups (id, course_run_id, code, name, capacity)
    values ('${ids.group}', '${ids.run}', 'A', 'Arabic Level 1 Group A', 2);
    insert into public.teacher_assignments (
      class_group_id, teacher_profile_id, assignment_type, starts_at, status
    ) values (
      '${ids.group}', '${ids.teacherProfile}', 'primary',
      now() - interval '1 day', 'active'
    );
  `);

  const args = [
    hash("student-registrar-session"),
    ids.invitation,
    ids.studentAuth,
    "Invited Student",
    "student@example.test",
    "+201000000041",
    ids.cairo,
    "English",
    "Arabic Language",
    "Adult",
    null,
    null,
    "Arabic Level 1",
    "Direct normalized enrollment.",
    ids.run,
    ids.group,
    "direct",
    null,
    null,
    null,
    "en",
    `v1.${"a".repeat(80)}`,
    new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
    "student-invite:runtime-proof-0001",
    hash("student-invitation-enrollment-request-0001"),
  ];
  const created = await database.query(
    "select * from public.nile_create_student_enrollment_invitation_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)",
    args
  );
  const replay = await database.query(
    "select * from public.nile_create_student_enrollment_invitation_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)",
    args
  );
  if (
    created.rows[0]?.replayed ||
    !replay.rows[0]?.replayed ||
    replay.rows[0]?.enrollment_id !== created.rows[0]?.enrollment_id
  ) {
    throw new Error("Student invitation replay evidence is incomplete.");
  }

  await expectRejected("registrar cross-branch student", () =>
    database.query(
      "select * from public.nile_create_student_enrollment_invitation_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)",
      [
        hash("student-registrar-session"),
        ids.outsideInvitation,
        ids.outsideAuth,
        "Outside Student",
        "outside@example.test",
        "+201000000042",
        ids.alex,
        "English",
        "Arabic Language",
        "Adult",
        null,
        null,
        "Arabic Level 1",
        null,
        ids.run,
        ids.group,
        "direct",
        null,
        null,
        null,
        "en",
        `v1.${"b".repeat(80)}`,
        new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
        "student-invite:cross-branch-0001",
        hash("cross-branch-student"),
      ]
    )
  );

  const pending = await database.query(`
    select app_user.status as user_status, role_grant.status as grant_status,
      invitation.status as invitation_status, enrollment.status as enrollment_status,
      membership.status as membership_status,
      (select count(*) from public.audit_logs
       where action = 'student.invited_and_enrolled') as audits,
      (select count(*) from public.outbox_events
       where event_type = 'email.delivery.requested') as outbox_rows
    from public.user_invitations as invitation
    join public.app_users as app_user on app_user.id = invitation.user_id
    join public.role_grants as role_grant on role_grant.id = invitation.role_grant_id
    join public.student_profiles as profile on profile.user_id = app_user.id
    join public.enrollments as enrollment on enrollment.student_profile_id = profile.id
    join public.class_memberships as membership on membership.enrollment_id = enrollment.id
    where invitation.id = '${ids.invitation}'
  `);
  if (
    pending.rows[0]?.user_status !== "invited" ||
    pending.rows[0]?.grant_status !== "pending" ||
    pending.rows[0]?.enrollment_status !== "pending" ||
    pending.rows[0]?.membership_status !== "active" ||
    Number(pending.rows[0]?.audits) !== 1 ||
    Number(pending.rows[0]?.outbox_rows) !== 1
  ) {
    throw new Error("Pending student lifecycle was not persisted atomically.");
  }

  const admissions = await database.query(
    "select * from public.nile_read_admissions_student_workspace($1)",
    [hash("student-registrar-session")]
  );
  if (
    admissions.rows[0]?.workspace?.students?.length !== 1 ||
    admissions.rows[0]?.workspace?.enrollments?.[0]?.teacherId !==
      ids.teacher ||
    admissions.rows[0]?.workspace?.classGroups?.[0]?.studentIds?.length !== 1
  ) {
    throw new Error("Registrar student readback is not relationship-complete.");
  }

  const pendingTeacherRoster = await database.query(
    "select * from public.nile_read_teacher_class_workspace($1)",
    [hash("student-teacher-session")]
  );
  if (pendingTeacherRoster.rows[0]?.workspace?.students?.length !== 0) {
    throw new Error("Teacher projection exposed an unaccepted student.");
  }

  const accepted = await database.query(
    "select * from public.nile_accept_user_invitation_with_enrollment($1,$2)",
    [ids.invitation, ids.studentAuth]
  );
  await database.exec(`
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values (
      '${ids.studentSession}', decode('${hash("student-learning-session")}', 'hex'),
      '${accepted.rows[0]?.user_id}', '${created.rows[0]?.role_grant_id}',
      'supabase', now() + interval '1 hour'
    );
  `);
  const learning = await database.query(
    "select * from public.nile_read_student_learning_workspace($1)",
    [hash("student-learning-session")]
  );
  if (
    learning.rows[0]?.workspace?.courses?.length !== 1 ||
    learning.rows[0]?.workspace?.courseRuns?.[0]?.teacherId !== ids.teacher ||
    learning.rows[0]?.workspace?.enrollments?.[0]?.status !== "active"
  ) {
    throw new Error("Accepted student learning projection is incomplete.");
  }

  const teacherWorkspace = await database.query(
    "select * from public.nile_read_teacher_class_workspace($1)",
    [hash("student-teacher-session")]
  );
  if (
    teacherWorkspace.rows[0]?.workspace?.students?.[0]?.id !==
      created.rows[0]?.student_profile_id ||
    teacherWorkspace.rows[0]?.workspace?.classGroups?.[0]?.studentIds?.[0] !==
      created.rows[0]?.student_profile_id ||
    teacherWorkspace.rows[0]?.workspace?.enrollments?.[0]?.teacherId !==
      ids.teacher
  ) {
    throw new Error("Teacher roster projection is not class-derived.");
  }

  await expectRejected("browser role student learning read", () =>
    database.exec(`
      set role authenticated;
      select * from public.nile_read_student_learning_workspace(
        '${hash("student-learning-session")}'
      );
    `)
  );
  await database.exec("reset role;");
  await expectRejected("browser role teacher class read", () =>
    database.exec(`
      set role authenticated;
      select * from public.nile_read_teacher_class_workspace(
        '${hash("student-teacher-session")}'
      );
    `)
  );
  await database.exec("reset role;");

  await database.exec(rollback);
  const removed = await database.query(`
    select
      to_regprocedure(
        'public.nile_create_student_enrollment_invitation_with_evidence(text,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,uuid,uuid,text,uuid,uuid,uuid,text,text,timestamptz,text,text)'
      ) is null as command_removed,
      to_regprocedure('public.nile_read_student_learning_workspace(text)')
        is null as read_removed,
      to_regprocedure('public.nile_read_teacher_class_workspace(text)')
        is null as teacher_read_removed
  `);
  if (
    !removed.rows[0]?.command_removed ||
    !removed.rows[0]?.read_removed ||
    !removed.rows[0]?.teacher_read_removed
  ) {
    throw new Error("Student enrollment package rollback is incomplete.");
  }
  await database.exec(forward);

  console.log(
    JSON.stringify({
      ok: true,
      invitation: "pending-then-accepted",
      enrollment: "pending-then-active",
      teacherAuthority: "class-assignment-derived",
      teacherRoster: "accepted-students-only",
      branchScope: "denied-outside-branch",
      replay: "deterministic",
      auditOutbox: "atomic",
      browserRoleAccess: "denied",
      rollback: "passed",
      reapply: "passed",
    })
  );
} finally {
  await database.close();
}
