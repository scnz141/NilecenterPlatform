import crypto from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = readdirSync(path.join(root, "supabase/migrations")).find(file =>
  file.endsWith("_phase1_identity_scope_session_audit_mapping.sql")
);
if (!migration) throw new Error("Phase 1 migration is missing.");
const read = file => readFileSync(path.join(root, "supabase/manual", file), "utf8");
const foundation = readFileSync(path.join(root, "supabase/migrations", migration), "utf8");
const dependencies = ["006_phase6a_moodle_projection_authority.sql","016_transactional_email_delivery.sql",
  "017_account_invitation_lifecycle.sql","019_normalized_profile_support_foundation.sql",
  "020_normalized_admissions_intake_foundation.sql","021_normalized_application_conversion_foundation.sql",
  "022_normalized_placement_foundation.sql","023_normalized_admissions_delivery_read_model.sql",
  "024_normalized_student_enrollment_invitation.sql","025_normalized_teacher_session_attendance.sql"].map(read);
const forward = read("026_normalized_native_assignment_authority.sql");
const rollback = read("926_normalized_native_assignment_authority_rollback.sql");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const id = suffix => `72000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const ids = { teacherAuth:id("1"),studentAuth:id("2"),outsideAuth:id("3"),branch:id("11"),outsideBranch:id("12"),
  department:id("21"),teacher:id("31"),student:id("32"),outsideTeacher:id("33"),teacherGrant:id("41"),
  studentGrant:id("42"),outsideGrant:id("43"),teacherSession:id("51"),studentSession:id("52"),outsideSession:id("53"),
  teacherProfile:id("61"),outsideProfile:id("62"),studentProfile:id("63"),program:id("71"),level:id("72"),
  course:id("73"),run:id("74"),group:id("75"),outsideGroup:id("76"),enrollment:id("77"),membership:id("78") };

const db = new PGlite({ extensions:{ btree_gist,citext,pgcrypto } });
async function rejected(label, operation) { try { await operation(); } catch { return; } throw new Error(`${label} unexpectedly succeeded.`); }
try {
  await db.waitReady;
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values('${ids.teacherAuth}'),('${ids.studentAuth}'),('${ids.outsideAuth}');`);
  await db.exec(foundation); for (const sql of dependencies) await db.exec(sql);
  await db.exec(forward); await db.exec(forward);
  await db.exec(`
    insert into public.branches(id,legacy_id,code,name) values('${ids.branch}','br_runtime','RUN','Runtime Branch'),('${ids.outsideBranch}','br_out','OUT','Outside Branch');
    insert into public.departments(id,code,name) values('${ids.department}','AR','Arabic');
    insert into public.department_branches(department_id,branch_id) values('${ids.department}','${ids.branch}'),('${ids.department}','${ids.outsideBranch}');
    insert into public.app_users(id,auth_user_id,full_name,email,status,activated_at) values
      ('${ids.teacher}','${ids.teacherAuth}','Runtime Teacher','teacher@example.test','active',now()),
      ('${ids.student}','${ids.studentAuth}','Runtime Student','student@example.test','active',now()),
      ('${ids.outsideTeacher}','${ids.outsideAuth}','Outside Teacher','outside@example.test','active',now());
    insert into public.role_grants(id,user_id,role,status,starts_at,granted_by,granted_reason) values
      ('${ids.teacherGrant}','${ids.teacher}','teacher','pending',now()-interval '2 days','${ids.teacher}','Runtime'),
      ('${ids.studentGrant}','${ids.student}','student','pending',now()-interval '2 days','${ids.teacher}','Runtime'),
      ('${ids.outsideGrant}','${ids.outsideTeacher}','teacher','pending',now()-interval '2 days','${ids.teacher}','Runtime');
    insert into public.role_grant_branch_scopes(role_grant_id,branch_id,starts_at,granted_by) values
      ('${ids.teacherGrant}','${ids.branch}',now()-interval '2 days','${ids.teacher}'),
      ('${ids.studentGrant}','${ids.branch}',now()-interval '2 days','${ids.teacher}'),
      ('${ids.outsideGrant}','${ids.outsideBranch}',now()-interval '2 days','${ids.teacher}');
    insert into public.role_grant_department_scopes(role_grant_id,department_id,starts_at,granted_by) values
      ('${ids.teacherGrant}','${ids.department}',now()-interval '2 days','${ids.teacher}'),('${ids.outsideGrant}','${ids.department}',now()-interval '2 days','${ids.teacher}');
    update public.role_grants set status='active';
    insert into public.auth_sessions(id,token_hash,user_id,active_role_grant_id,provider,expires_at) values
      ('${ids.teacherSession}',decode('${hash("teacher-session")}','hex'),'${ids.teacher}','${ids.teacherGrant}','supabase',now()+interval '1 hour'),
      ('${ids.studentSession}',decode('${hash("student-session")}','hex'),'${ids.student}','${ids.studentGrant}','supabase',now()+interval '1 hour'),
      ('${ids.outsideSession}',decode('${hash("outside-session")}','hex'),'${ids.outsideTeacher}','${ids.outsideGrant}','supabase',now()+interval '1 hour');
    insert into public.staff_profiles(id,user_id,title) values('${ids.teacherProfile}','${ids.teacher}','Teacher'),('${ids.outsideProfile}','${ids.outsideTeacher}','Teacher');
    insert into public.student_profiles(id,user_id,home_branch_id) values('${ids.studentProfile}','${ids.student}','${ids.branch}');
    insert into public.programs(id,department_id,code,title,language) values('${ids.program}','${ids.department}','AR','Arabic','en');
    insert into public.course_levels(id,program_id,code,title,sort_order) values('${ids.level}','${ids.program}','L1','Level 1',1);
    insert into public.course_templates(id,program_id,level_id,code,slug,title) values('${ids.course}','${ids.program}','${ids.level}','AR1','runtime-ar1','Arabic 1');
    insert into public.course_runs(id,course_template_id,branch_id,code,term,starts_on,ends_on,status) values('${ids.run}','${ids.course}','${ids.branch}','RUN-1','Runtime',current_date-5,current_date+30,'active');
    insert into public.class_groups(id,course_run_id,code,name,capacity) values('${ids.group}','${ids.run}','A','Group A',10),('${ids.outsideGroup}','${ids.run}','B','Group B',10);
    insert into public.teacher_assignments(class_group_id,teacher_profile_id,starts_at,status) values('${ids.group}','${ids.teacherProfile}',now()-interval '2 days','active');
    insert into public.enrollments(id,student_profile_id,course_run_id,starts_at,status) values('${ids.enrollment}','${ids.studentProfile}','${ids.run}',now()-interval '1 day','active');
    insert into public.class_memberships(id,enrollment_id,course_run_id,class_group_id,starts_at,status) values('${ids.membership}','${ids.enrollment}','${ids.run}','${ids.group}',now()-interval '1 day','active');`);

  const due = new Date(Date.now()+86400000).toISOString();
  const createArgs=[hash("teacher-session"),ids.run,ids.group,"Runtime worksheet",due,"text",JSON.stringify(["Accuracy"]),"assignment:create:runtime-0001",hash("create")];
  const created=await db.query("select * from public.nile_create_teacher_assignment_draft_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9)",createArgs);
  const replay=await db.query("select * from public.nile_create_teacher_assignment_draft_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9)",createArgs);
  if(created.rows[0]?.replayed||!replay.rows[0]?.replayed) throw new Error("Draft replay failed.");
  await rejected("unassigned teacher draft",()=>db.query("select * from public.nile_create_teacher_assignment_draft_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9)",[hash("outside-session"),ids.run,ids.group,"Denied",due,"text","[]","assignment:create:runtime-0002",hash("denied")]));
  const assignment=created.rows[0].assignment_id;
  const publishArgs=[hash("teacher-session"),assignment,1,"assignment:publish:runtime-0001",hash("publish")];
  const published=await db.query("select * from public.nile_publish_teacher_assignment_with_evidence($1,$2,$3,$4,$5)",publishArgs);
  const publishReplay=await db.query("select * from public.nile_publish_teacher_assignment_with_evidence($1,$2,$3,$4,$5)",publishArgs);
  if(published.rows[0]?.assignment_version!==2||!publishReplay.rows[0]?.replayed) throw new Error("Publish/replay failed.");
  await rejected("stale publish",()=>db.query("select * from public.nile_publish_teacher_assignment_with_evidence($1,$2,$3,$4,$5)",[hash("teacher-session"),assignment,1,"assignment:publish:runtime-0002",hash("stale")]));
  const studentBefore=await db.query("select * from public.nile_read_student_native_assignment_workspace($1)",[hash("student-session")]);
  if(studentBefore.rows[0]?.workspace?.assignments?.length!==1) throw new Error("Published student projection failed.");
  const submitArgs=[hash("student-session"),assignment,"My answer","[]",2,"assignment:submit:runtime-0001",hash("submit")];
  const submitted=await db.query("select * from public.nile_submit_student_assignment_with_evidence($1,$2,$3,$4,$5,$6,$7)",submitArgs);
  const submitReplay=await db.query("select * from public.nile_submit_student_assignment_with_evidence($1,$2,$3,$4,$5,$6,$7)",submitArgs);
  if(submitted.rows[0]?.submission_version!==1||!submitReplay.rows[0]?.replayed) throw new Error("Submit/replay failed.");
  const submission=submitted.rows[0].submission_id;
  await rejected("unassigned teacher grade",()=>db.query("select * from public.nile_grade_teacher_assignment_submission_with_evidence($1,$2,$3,$4,$5,$6,$7)",[hash("outside-session"),submission,80,"Denied",1,"assignment:grade:runtime-0002",hash("denied-grade")]));
  const gradeArgs=[hash("teacher-session"),submission,88,"Strong work",1,"assignment:grade:runtime-0001",hash("grade")];
  const graded=await db.query("select * from public.nile_grade_teacher_assignment_submission_with_evidence($1,$2,$3,$4,$5,$6,$7)",gradeArgs);
  const gradeReplay=await db.query("select * from public.nile_grade_teacher_assignment_submission_with_evidence($1,$2,$3,$4,$5,$6,$7)",gradeArgs);
  if(graded.rows[0]?.submission_version!==2||graded.rows[0]?.revision_number!==1||!gradeReplay.rows[0]?.replayed) throw new Error("Grade/replay failed.");
  const studentAfter=await db.query("select * from public.nile_read_student_native_assignment_workspace($1)",[hash("student-session")]);
  if(studentAfter.rows[0]?.workspace?.grades?.[0]?.score!==88) throw new Error("Released grade projection failed.");
  const evidence=await db.query("select (select count(*) from public.audit_logs where action in ('assignment.created','assignment.published','assignment.submitted','assignment.graded'))::int audits,(select count(*) from public.outbox_events where event_type in ('assignment.created','assignment.published','assignment.submitted','assignment.graded'))::int outbox,(select count(*) from public.native_grade_revisions)::int revisions");
  if(evidence.rows[0]?.audits!==4||evidence.rows[0]?.outbox!==4||evidence.rows[0]?.revisions!==1) throw new Error("Assignment evidence is incomplete.");
  await rejected("browser assignment read",()=>db.exec("set role authenticated; select * from public.native_assignments; reset role;")); await db.exec("reset role;");
  await db.exec(rollback); const removed=await db.query("select to_regclass('public.native_assignments') is null removed");
  if(!removed.rows[0]?.removed) throw new Error("Assignment rollback failed."); await db.exec(forward);
  console.log(JSON.stringify({result:"normalized native assignment runtime passed",draftReplay:true,publishReplay:true,submitReplay:true,gradeReplay:true,scopedReads:true,auditRows:4,outboxRows:4,rollbackReapply:true},null,2));
} finally { await db.close(); }
