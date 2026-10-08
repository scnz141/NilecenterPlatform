import { describe, expect, it } from "vitest";
import { legacyStaffTarget } from "./legacy-redirects";

describe("legacyStaffTarget", () => {
  it("returns null outside the removed staff prefixes", () => {
    expect(legacyStaffTarget("/app/branches")).toBeNull();
    expect(legacyStaffTarget("/app/student/dashboard")).toBeNull();
    expect(legacyStaffTarget("/app/staff")).toBeNull();
    expect(legacyStaffTarget("/app/administration")).toBeNull();
    expect(legacyStaffTarget("/")).toBeNull();
    expect(legacyStaffTarget("/courses")).toBeNull();
  });

  it("maps Nile Forms addresses keeping their IDs", () => {
    for (const portal of ["admin", "registrar", "hod", "branch", "teacher"]) {
      expect(legacyStaffTarget(`/app/${portal}/forms/review/sub_123`)).toBe(
        "/app/forms/responses/sub_123"
      );
      expect(legacyStaffTarget(`/app/${portal}/forms/manage/f_9/builder`)).toBe(
        "/app/forms/f_9"
      );
      expect(legacyStaffTarget(`/app/${portal}/forms/manage/f_9`)).toBe(
        "/app/forms/f_9"
      );
      expect(legacyStaffTarget(`/app/${portal}/forms/manage/new`)).toBe(
        "/app/forms"
      );
      expect(legacyStaffTarget(`/app/${portal}/forms`)).toBe("/app/forms");
      expect(legacyStaffTarget(`/app/${portal}/forms/offline`)).toBe(
        "/app/forms"
      );
      expect(
        legacyStaffTarget(`/app/${portal}/forms/pub_1/responses/sub_2`)
      ).toBe("/app/forms");
    }
    expect(legacyStaffTarget("/app/admin/forms/migration")).toBe(
      "/app/forms/import"
    );
    expect(legacyStaffTarget("/app/teacher/forms/migration/x")).toBe(
      "/app/forms/import"
    );
  });

  it("maps profile, settings/profile and messages", () => {
    expect(legacyStaffTarget("/app/teacher/profile")).toBe("/app/profile");
    expect(legacyStaffTarget("/app/admin/settings/profile")).toBe(
      "/app/profile"
    );
    expect(legacyStaffTarget("/app/hod/settings/profile")).toBe("/app/profile");
    expect(legacyStaffTarget("/app/admin/settings")).toBe("/app/dashboard");
    expect(legacyStaffTarget("/app/teacher/messages/new")).toBe(
      "/app/notifications"
    );
    expect(legacyStaffTarget("/app/branch/messages")).toBe("/app/notifications");
  });

  it("maps staff, departments, rooms, audit and system admin routes", () => {
    expect(legacyStaffTarget("/app/admin/users")).toBe("/app/staff");
    expect(legacyStaffTarget("/app/admin/users/u_1/access")).toBe("/app/staff");
    expect(legacyStaffTarget("/app/admin/roles")).toBe("/app/staff");
    expect(legacyStaffTarget("/app/admin/permissions")).toBe("/app/staff");
    expect(legacyStaffTarget("/app/branch/teachers")).toBe("/app/staff");
    expect(legacyStaffTarget("/app/hod/teachers")).toBe("/app/staff");
    expect(legacyStaffTarget("/app/admin/departments")).toBe("/app/departments");
    expect(legacyStaffTarget("/app/hod/departments")).toBe("/app/departments");
    expect(legacyStaffTarget("/app/admin/schedule/rooms")).toBe("/app/rooms");
    expect(legacyStaffTarget("/app/admin/schedule/rooms/r_1")).toBe("/app/rooms");
    expect(legacyStaffTarget("/app/branch/rooms")).toBe("/app/rooms");
    expect(legacyStaffTarget("/app/branch/rooms/new")).toBe("/app/rooms");
    expect(legacyStaffTarget("/app/admin/audit-logs")).toBe("/app/audit");
    expect(legacyStaffTarget("/app/admin/system-health")).toBe("/app/system");
    expect(legacyStaffTarget("/app/admin/integrations")).toBe("/app/moodle");
    expect(legacyStaffTarget("/app/admin/integrations/moodle-commands")).toBe(
      "/app/moodle"
    );
  });

  it("maps moodle-source per portal", () => {
    expect(legacyStaffTarget("/app/teacher/moodle-source/c_1")).toBe(
      "/app/classes"
    );
    expect(legacyStaffTarget("/app/admin/moodle-source")).toBe("/app/moodle");
    expect(legacyStaffTarget("/app/hod/moodle-source/c_1")).toBe("/app/moodle");
  });

  it("maps course-catalog families to /app/courses", () => {
    expect(legacyStaffTarget("/app/admin/courses")).toBe("/app/courses");
    expect(legacyStaffTarget("/app/admin/courses/programs")).toBe("/app/courses");
    expect(legacyStaffTarget("/app/admin/courses/c_1")).toBe("/app/courses");
    expect(legacyStaffTarget("/app/admin/programs")).toBe("/app/courses");
    expect(legacyStaffTarget("/app/hod/programs")).toBe("/app/courses");
    expect(legacyStaffTarget("/app/hod/levels")).toBe("/app/courses");
    expect(legacyStaffTarget("/app/hod/courses")).toBe("/app/courses");
    expect(legacyStaffTarget("/app/hod/curriculum/new")).toBe("/app/courses");
  });

  it("maps registrar and branch admissions/finance routes", () => {
    expect(legacyStaffTarget("/app/registrar/students")).toBe("/app/students");
    expect(legacyStaffTarget("/app/registrar/students/new")).toBe(
      "/app/students"
    );
    expect(legacyStaffTarget("/app/registrar/students/s_1")).toBe(
      "/app/students"
    );
    expect(legacyStaffTarget("/app/branch/students")).toBe("/app/students");
    expect(legacyStaffTarget("/app/registrar/leads/l_1")).toBe("/app/leads");
    expect(legacyStaffTarget("/app/registrar/applications")).toBe("/app/leads");
    expect(
      legacyStaffTarget("/app/registrar/applications/a_1/placement")
    ).toBe("/app/leads");
    expect(legacyStaffTarget("/app/registrar/placement-tests/b_1")).toBe(
      "/app/placement-tests"
    );
    expect(legacyStaffTarget("/app/registrar/enrollments")).toBe(
      "/app/enrolments"
    );
    expect(
      legacyStaffTarget("/app/registrar/enrollments/records/e_1")
    ).toBe("/app/enrolments");
    expect(legacyStaffTarget("/app/registrar/payments/i_1")).toBe(
      "/app/enrolments"
    );
    expect(legacyStaffTarget("/app/branch/payments")).toBe("/app/enrolments");
  });

  it("maps teacher calendar and availability to sessions", () => {
    expect(legacyStaffTarget("/app/teacher/calendar")).toBe("/app/sessions");
    expect(legacyStaffTarget("/app/teacher/calendar/new")).toBe("/app/sessions");
    expect(legacyStaffTarget("/app/teacher/availability")).toBe("/app/sessions");
  });

  it("maps the classes bucket", () => {
    expect(legacyStaffTarget("/app/teacher/classes/c_1/attendance")).toBe(
      "/app/classes"
    );
    expect(legacyStaffTarget("/app/hod/classes/runs/new")).toBe("/app/classes");
    expect(legacyStaffTarget("/app/registrar/classes")).toBe("/app/classes");
    expect(legacyStaffTarget("/app/admin/schedule")).toBe("/app/classes");
    expect(legacyStaffTarget("/app/branch/schedule/conflicts")).toBe(
      "/app/classes"
    );
    expect(legacyStaffTarget("/app/hod/schedule/sessions")).toBe("/app/classes");
    expect(legacyStaffTarget("/app/branch/attendance")).toBe("/app/classes");
    expect(legacyStaffTarget("/app/hod/assessments/review/s_1")).toBe(
      "/app/classes"
    );
    expect(legacyStaffTarget("/app/teacher/quizzes")).toBe("/app/classes");
    expect(legacyStaffTarget("/app/teacher/question-bank/new")).toBe(
      "/app/classes"
    );
    expect(legacyStaffTarget("/app/teacher/assignments/a_1")).toBe(
      "/app/classes"
    );
    expect(legacyStaffTarget("/app/teacher/grading/s_1")).toBe("/app/classes");
    expect(legacyStaffTarget("/app/teacher/quran-review")).toBe("/app/classes");
  });

  it("falls back to /app/dashboard for everything else", () => {
    expect(legacyStaffTarget("/app/admin")).toBe("/app/dashboard");
    expect(legacyStaffTarget("/app/admin/")).toBe("/app/dashboard");
    expect(legacyStaffTarget("/app/teacher")).toBe("/app/dashboard");
    expect(legacyStaffTarget("/app/registrar/reports")).toBe("/app/dashboard");
    expect(legacyStaffTarget("/app/admin/certificates")).toBe("/app/dashboard");
    expect(legacyStaffTarget("/app/admin/platform-blueprint")).toBe(
      "/app/dashboard"
    );
    expect(legacyStaffTarget("/app/branch/reports")).toBe("/app/dashboard");
    expect(legacyStaffTarget("/app/admin/requests")).toBe("/app/dashboard");
    expect(legacyStaffTarget("/app/hod/reports")).toBe("/app/dashboard");
  });

  it("ignores query strings and trailing slashes", () => {
    expect(legacyStaffTarget("/app/admin/users?tab=x")).toBe("/app/staff");
    expect(legacyStaffTarget("/app/registrar/students/?a=b&c=d")).toBe(
      "/app/students"
    );
    expect(legacyStaffTarget("/app/teacher/classes/#frag")).toBe(
      "/app/classes"
    );
  });
});
