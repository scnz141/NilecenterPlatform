import { describe, expect, it, vi } from "vitest";

import {
  createEmsStagingClient,
  extractTokens,
  mapEmsRoleToLocal,
  mapLocalRoleToEms,
  normalizeEmsAttendanceDetail,
  normalizeEmsClass,
  normalizeEmsClassEnrolments,
  normalizeEmsClassGrades,
  normalizeEmsCourses,
  normalizeEmsCustomFieldDefinitions,
  normalizeEmsLead,
  normalizeEmsMe,
  normalizeEmsMoodleCoursePicker,
  normalizeEmsMoodleGroups,
  normalizeEmsMoodleUsers,
  normalizeEmsNotification,
  normalizeEmsNotifications,
  normalizeEmsNotificationUnreadCount,
  normalizeEmsNotificationsMarkedRead,
  normalizeEmsPlacementTest,
  normalizeEmsRooms,
  normalizeEmsSelfProfile,
  normalizeEmsSession,
  normalizeEmsSessionBatch,
  normalizeEmsSessionSlots,
  normalizeEmsSessions,
  normalizeEmsStaffUsers,
  normalizeEmsStudent,
  normalizeEmsStudentEnrolments,
  normalizeEmsAuditEvents,
  normalizeEmsDashboardSummary,
  normalizeEmsSystemHealth,
  normalizeEmsTeacherWorkspace,
  resolveEmsStagingConfig,
  translateEmsError,
} from "../../../../server/emsStagingClient";
import {
  EMS_SESSION_COOKIE_NAME,
  EmsSessionConfigurationError,
  EmsSessionInvalidError,
  openEmsSession,
  sealEmsSession,
} from "../../../../server/emsSessionEnvelope";
import { registerEmsStagingRoutes } from "../../../../server/emsStagingRoutes";

const sealKey = "test-only-ems-session-seal-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";

function authPayload(accessToken = "access-1", refreshToken = "refresh-1") {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    session_id: "ems-session-1",
  };
}

function mePayload() {
  return {
    session_id: "ems-session-1",
    user: {
      id: "ems-user-1",
      email: "admin@example.test",
      profile: { first_name: "NCC", last_name: "Admin" },
      departments: null,
    },
    assigned_role: "super_admin",
    active_role: "super_admin",
    workspace_branch_id: null,
    scopes: [{ scope_type: "global", scope_id: null, is_live: true }],
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("EMS staging config", () => {
  it("returns null when no base URL is configured", () => {
    expect(resolveEmsStagingConfig({})).toBeNull();
    expect(resolveEmsStagingConfig({ EMS_STAGING_BASE_URL: "   " })).toBeNull();
  });

  it("trims trailing slashes and clamps the timeout", () => {
    expect(
      resolveEmsStagingConfig({
        EMS_STAGING_BASE_URL: "https://staging.example/api///",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      })
    ).toEqual({
      baseUrl: "https://staging.example/api",
      timeoutMs: 15000,
    });
    expect(
      resolveEmsStagingConfig({
        EMS_STAGING_BASE_URL: "https://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
        EMS_STAGING_TIMEOUT_MS: "999999",
      })?.timeoutMs
    ).toBe(60000);
  });

  it("rejects non-HTTPS and non-allowlisted upstreams", () => {
    expect(
      resolveEmsStagingConfig({
        EMS_STAGING_BASE_URL: "http://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      })
    ).toBeNull();
    expect(
      resolveEmsStagingConfig({
        EMS_STAGING_BASE_URL: "https://other.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      })
    ).toBeNull();
  });
});

describe("EMS staging role mapping", () => {
  it("maps EMS roles to local roles and back", () => {
    expect(mapEmsRoleToLocal("super_admin")).toBe("superadmin");
    expect(mapEmsRoleToLocal("branch_admin")).toBe("branchadmin");
    expect(mapEmsRoleToLocal("hod")).toBe("headofdepartment");
    expect(mapEmsRoleToLocal("registrar")).toBe("registrar");
    expect(mapEmsRoleToLocal("teacher")).toBe("teacher");
    expect(mapEmsRoleToLocal("student")).toBeNull();
    expect(mapLocalRoleToEms("superadmin")).toBe("super_admin");
    expect(mapLocalRoleToEms("headofdepartment")).toBe("hod");
    expect(mapLocalRoleToEms("student")).toBeNull();
  });
});

describe("EMS staging error translation", () => {
  it("passes string details through", () => {
    expect(translateEmsError(400, { detail: "Course not found" })).toEqual({
      error: "Course not found",
    });
  });

  it("summarizes 422 validation arrays with the field name", () => {
    expect(
      translateEmsError(422, {
        detail: [
          { loc: ["body", "capacity"], msg: "Input should be >= 1", type: "x" },
        ],
      })
    ).toEqual({
      error: "Validation failed: capacity Input should be >= 1",
      details: [
        { loc: ["body", "capacity"], msg: "Input should be >= 1", type: "x" },
      ],
    });
  });

  it("falls back for unknown shapes", () => {
    expect(translateEmsError(500, null)).toEqual({
      error: "Request failed with 500",
    });
    expect(translateEmsError(502, "<html>bad gateway</html>")).toEqual({
      error: "Request failed with 502",
    });
  });
});

describe("EMS staging payload guards", () => {
  it("extracts complete token pairs with their server expiries", () => {
    expect(extractTokens(authPayload())).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessTokenExpiresAt: accessExpiresAt,
      refreshTokenExpiresAt: refreshExpiresAt,
      sessionId: "ems-session-1",
    });
    expect(
      extractTokens({ access_token: "access-1", refresh_token: "refresh-1" })
    ).toBeNull();
    expect(extractTokens(null)).toBeNull();
  });

  it("normalizes me snapshots and rejects unknown roles", () => {
    expect(normalizeEmsMe(mePayload())).toEqual({
      sessionId: "ems-session-1",
      userId: "ems-user-1",
      email: "admin@example.test",
      name: "NCC Admin",
      assignedRole: "super_admin",
      activeRole: "super_admin",
      workspaceBranchId: null,
      departmentIds: [],
      scopes: [{ scopeType: "global", scopeId: null, isLive: true }],
    });
    expect(
      normalizeEmsMe({ assigned_role: "student", active_role: "student" })
    ).toBeNull();
    expect(
      normalizeEmsMe({
        ...mePayload(),
        scopes: [
          { scope_type: "branch", scope_id: "branch-1", is_live: "false" },
        ],
      })
    ).toBeNull();
  });

  it("normalizes closed staff user rows and rejects malformed live scope flags", () => {
    const base = {
      id: "user-1",
      email: "hod@example.test",
      assigned_role: "hod",
      status: "active",
      is_active: true,
      moodle_user_id: 42,
      last_login_at: "2026-09-12T10:00:00Z",
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-12T10:00:00Z",
      profile: {
        first_name: "NCC",
        last_name: "HOD",
        phone: null,
        custom_fields: { private: true },
      },
      scopes: [{ scope_type: "branch", scope_id: "branch-1", is_live: true }],
      departments: [
        {
          department_id: "department-1",
          name: "Academic",
          status: "active",
        },
      ],
      custom_fields: { ignored: true },
    };
    const users = normalizeEmsStaffUsers([
      base,
      {
        ...base,
        id: "user-2",
        email: "teacher@example.test",
        assigned_role: "teacher",
        moodle_user_id: null,
        last_login_at: null,
        profile: null,
        scopes: [{ scope_type: "branch", scope_id: "branch-2" }],
        departments: null,
      },
    ]);

    expect(users).toEqual([
      {
        id: "user-1",
        email: "hod@example.test",
        name: "NCC HOD",
        firstName: "NCC",
        lastName: "HOD",
        phone: null,
        role: "headofdepartment",
        status: "active",
        isActive: true,
        scopeType: "branch",
        branchIds: ["branch-1"],
        departments: [
          { id: "department-1", name: "Academic", status: "active" },
        ],
        moodleLinked: true,
        lastLoginAt: "2026-09-12T10:00:00Z",
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-12T10:00:00Z",
        customFields: { ignored: true },
      },
      {
        id: "user-2",
        email: "teacher@example.test",
        name: "teacher@example.test",
        firstName: "",
        lastName: "",
        phone: null,
        role: "teacher",
        status: "active",
        isActive: true,
        scopeType: "branch",
        branchIds: ["branch-2"],
        departments: [],
        moodleLinked: false,
        lastLoginAt: null,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-12T10:00:00Z",
        customFields: { ignored: true },
      },
    ]);
    expect(
      normalizeEmsStaffUsers([
        {
          ...base,
          scopes: [
            { scope_type: "branch", scope_id: "branch-1", is_live: "false" },
          ],
        },
      ])
    ).toBeNull();
  });

  it("accepts omitted optional staff fields and rejects invalid departments", () => {
    const row = {
      id: "user-optional",
      email: "teacher@example.test",
      assigned_role: "teacher",
      status: "active",
      is_active: true,
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-12T10:00:00Z",
      profile: null,
      scopes: [{ scope_type: "branch", scope_id: "branch-1" }],
    };

    expect(normalizeEmsStaffUsers([row])).toEqual([
      expect.objectContaining({
        id: "user-optional",
        departments: [],
        moodleLinked: false,
        lastLoginAt: null,
        customFields: {},
      }),
    ]);
    expect(normalizeEmsStaffUsers([{ ...row, departments: "x" }])).toBeNull();
    expect(
      normalizeEmsStaffUsers([
        { ...row, custom_fields: { nested: { value: true } } },
      ])
    ).toBeNull();
  });

  it("normalizes active user profile custom-field definitions", () => {
    expect(
      normalizeEmsCustomFieldDefinitions([
        {
          id: "field-1",
          entity_type: "user_profile",
          field_key: "employee_number",
          label: "Employee number",
          field_type: "text",
          is_required: true,
          is_active: true,
          sort_order: 1,
          options_json: null,
          help_text: "Use the EMS number.",
        },
      ])
    ).toEqual([
      {
        id: "field-1",
        fieldKey: "employee_number",
        label: "Employee number",
        fieldType: "text",
        isRequired: true,
        helpText: "Use the EMS number.",
        options: null,
        sortOrder: 1,
      },
    ]);
  });
});

describe("EMS operational payload guards", () => {
  const student = {
    id: "student-1",
    first_name: "Nile",
    last_name: "Student",
    email: "student@example.test",
    nationality: "EGY",
    address: "12 Nile St",
    gender: "male",
    passport_number: null,
    national_id: null,
    guardians: [
      {
        sort_order: 1,
        name: "Guardian",
        phone: "+20 200",
        email: "guardian@example.test",
        relationship: "Parent",
      },
    ],
    branch_id: "branch-1",
    branch_name: "Cairo",
    status: "active",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
  };

  const lead = {
    id: "lead-1",
    first_name: "Nile",
    last_name: "Lead",
    email: "lead@example.test",
    preferred_courses: [
      { course_id: "course-1", course_name: "Arabic" },
    ],
    wants_online: true,
    wants_onsite: false,
    entry_path: "placement",
    branch_id: "branch-1",
    branch_name: "Cairo",
    status: "new",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
  };

  const placement = {
    id: "placement-1",
    branch_id: "branch-1",
    branch_name: "Cairo",
    subject: {
      subject_type: "lead",
      subject_id: "lead-1",
      first_name: "Nile",
      last_name: "Lead",
      email: "lead@example.test",
    },
    scheduled_at: null,
    status: "scheduled",
    created_at: null,
    updated_at: null,
  };

  const classRow = {
    id: "class-1",
    name: "Arabic A",
    course_id: "course-1",
    course_name: "Arabic",
    department_id: "department-1",
    department_name: "Languages",
    branch_id: "branch-1",
    branch_name: "Cairo",
    capacity: 20,
    start_at: "2026-09-01T10:00:00Z",
    end_at: "2026-12-01T10:00:00Z",
    teachers: [
      {
        id: "teacher-1",
        first_name: "Nile",
        last_name: "Teacher",
        email: "teacher@example.test",
      },
      {
        id: "teacher-2",
        first_name: "Second",
        last_name: "Teacher",
        email: "teacher2@example.test",
      },
    ],
    teacher_ids: ["teacher-1", "teacher-2"],
    schedule_days_of_week: null,
    status: "active",
    sort_order: 0,
    active_enrolment_count: 8,
    created_by: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
  };

  it("normalizes students with absent optionals and rejects wrong field types", () => {
    const { guardians: _guardians, ...withoutGuardians } = student;
    expect(normalizeEmsStudent(withoutGuardians)).toMatchObject({
      name: "Nile Student",
      phone: null,
      dateOfBirth: null,
      nationality: "EGY",
      gender: "male",
      guardians: [],
      moodleLinked: false,
    });
    expect(normalizeEmsStudent(student)).toMatchObject({
      guardians: [
        {
          sortOrder: 1,
          name: "Guardian",
          phone: "+20 200",
          email: "guardian@example.test",
          relationship: "Parent",
        },
      ],
    });
    expect(normalizeEmsStudent({ ...student, email: 4 })).toBeNull();
    expect(normalizeEmsStudent({ ...student, guardians: "x" })).toBeNull();
    expect(
      normalizeEmsStudent({
        ...student,
        guardians: [{ sort_order: 3, name: "G" }],
      })
    ).toBeNull();
  });

  it("normalizes enrolment class summaries and rejects malformed summaries", () => {
    const enrolment = {
      student_id: "student-1",
      class_id: "class-1",
      status: "active",
      class_summary: {
        class_name: "Arabic A",
        branch_id: "branch-1",
        branch_name: "Cairo",
        course_id: "course-1",
        course_name: "Arabic",
        start_at: "2026-09-01T10:00:00Z",
        end_at: "2026-12-01T10:00:00Z",
        class_status: "active",
      },
    };
    expect(normalizeEmsStudentEnrolments([enrolment])).toEqual([
      {
        classId: "class-1",
        className: "Arabic A",
        courseName: "Arabic",
        status: "active",
        enrolledAt: null,
        withdrawnAt: null,
      },
    ]);
    expect(
      normalizeEmsStudentEnrolments([
        { ...enrolment, class_summary: "invalid" },
      ])
    ).toBeNull();
  });

  it("normalizes leads with absent optionals and rejects unknown status", () => {
    const {
      preferred_courses: _courses,
      wants_online: _online,
      wants_onsite: _onsite,
      entry_path: _path,
      ...minimal
    } = lead;
    expect(normalizeEmsLead(minimal)).toMatchObject({
      name: "Nile Lead",
      phone: null,
      preferredCourses: [],
      wantsOnline: false,
      wantsOnsite: false,
      entryPath: null,
      source: null,
      studentId: null,
    });
    expect(normalizeEmsLead(lead)).toMatchObject({
      preferredCourses: [{ id: "course-1", name: "Arabic" }],
      wantsOnline: true,
      wantsOnsite: false,
      entryPath: "placement",
    });
    expect(normalizeEmsLead({ ...lead, status: "bogus" })).toBeNull();
    expect(
      normalizeEmsLead({ ...lead, status: "contacted" })
    ).toBeNull();
    expect(
      normalizeEmsLead({ ...lead, entry_path: "unknown" })
    ).toBeNull();
  });

  it("normalizes placement subjects and nullable dates", () => {
    expect(normalizeEmsPlacementTest(placement)).toMatchObject({
      subject: {
        type: "lead",
        id: "lead-1",
        name: "Nile Lead",
        email: "lead@example.test",
      },
      createdAt: null,
      updatedAt: null,
    });
    expect(
      normalizeEmsPlacementTest({
        ...placement,
        subject: { ...placement.subject, subject_type: "guardian" },
      })
    ).toBeNull();
  });

  it("normalizes classes with teachers and nullable schedule", () => {
    expect(normalizeEmsClass(classRow)).toMatchObject({
      teachers: [
        { id: "teacher-1", name: "Nile Teacher" },
        { id: "teacher-2", name: "Second Teacher" },
      ],
      schedule: { daysOfWeek: null, startTime: null, endTime: null },
      moodleGroupId: null,
      defaultRoomId: null,
    });
    expect(normalizeEmsClass({ ...classRow, capacity: "20" })).toBeNull();
  });

  it("normalizes rooms with absent capacity and rejects invalid status", () => {
    const room = {
      id: "room-1",
      branch_id: "branch-1",
      branch_name: "Cairo",
      name: "Room 1",
      status: "active",
      sort_order: 2,
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-12T10:00:00Z",
    };
    expect(normalizeEmsRooms([room])).toEqual([
      {
        id: "room-1",
        branchId: "branch-1",
        branchName: "Cairo",
        name: "Room 1",
        capacity: null,
        status: "active",
        sortOrder: 2,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-12T10:00:00Z",
      },
    ]);
    expect(normalizeEmsRooms([{ ...room, status: "closed" }])).toBeNull();
    expect(
      normalizeEmsRooms([{ ...room, sort_order: "first" }])
    ).toBeNull();
  });

  it("normalizes teacher workspace URLs and rejects wrong item types", () => {
    const workspace = {
      moodle_site_url: "http://moodle.example.test",
      classes: [
        {
          id: "class-1",
          name: "Arabic A",
          course_name: "Arabic",
          status: "active",
          active_enrolment_count: 8,
          moodle_course_url: "http://moodle.example.test/course/1",
        },
      ],
      upcoming_sessions: [
        {
          id: "session-1",
          class_id: "class-1",
          class_name: "Arabic A",
          starts_at: "2026-09-13T10:00:00Z",
          ends_at: "2026-09-13T11:00:00Z",
          room_name: null,
          status: "scheduled",
        },
      ],
    };
    expect(normalizeEmsTeacherWorkspace(workspace)).toMatchObject({
      moodleSiteUrl: null,
      classes: [{ moodleCourseUrl: null }],
      upcomingSessions: [{ classId: "class-1", roomName: null }],
    });
    expect(
      normalizeEmsTeacherWorkspace({
        ...workspace,
        classes: [{ ...workspace.classes[0], active_enrolment_count: "eight" }],
      })
    ).toBeNull();
  });

  it("normalizes the closed EMS course selector DTO", () => {
    const course = {
      id: "course-1",
      fullname: "Arabic Language",
      shortname: "AR1",
      department_id: "department-1",
      department_name: "Languages",
      department_status: "active",
      moodle_course_id: 501,
      idnumber: null,
      displayname: null,
      category_id: null,
      category_name: null,
      moodle_visible: null,
      moodle_attendance_id: null,
      moodle_refreshed_at: "2026-09-12T09:00:00Z",
      moodle_refresh_error: null,
      warnings: ["catalog stale"],
      status: "active",
      sort_order: 1,
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-12T10:00:00Z",
    };
    expect(normalizeEmsCourses([course])).toEqual([
      {
        id: "course-1",
        fullname: "Arabic Language",
        shortname: "AR1",
        departmentId: "department-1",
        departmentName: "Languages",
        departmentStatus: "active",
        moodleCourseId: 501,
        idNumber: null,
        displayName: null,
        categoryId: null,
        categoryName: null,
        moodleVisible: null,
        moodleAttendanceId: null,
        moodleRefreshedAt: "2026-09-12T09:00:00Z",
        moodleRefreshError: null,
        warnings: ["catalog stale"],
        status: "active",
        sortOrder: 1,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-12T10:00:00Z",
      },
    ]);
    expect(
      normalizeEmsCourses([{ ...course, shortname: 4 }])
    ).toBeNull();
    expect(
      normalizeEmsCourses([{ ...course, moodle_course_id: 0 }])
    ).toBeNull();
    expect(
      normalizeEmsCourses([{ ...course, warnings: [4] }])
    ).toBeNull();
    expect(
      normalizeEmsCourses([{ ...course, department_status: "archived" }])
    ).toBeNull();
  });

  it("normalizes the Moodle course picker and group search payloads", () => {
    expect(
      normalizeEmsMoodleCoursePicker({
        catalog_refreshed_at: "2026-09-12T09:00:00Z",
        warnings: ["partial"],
        error: null,
        courses: [
          {
            id: 7,
            shortname: "AR1",
            fullname: "Arabic Language",
            visible: true,
          },
        ],
      })
    ).toEqual({
      refreshedAt: "2026-09-12T09:00:00Z",
      warnings: ["partial"],
      error: null,
      courses: [
        {
          id: 7,
          shortname: "AR1",
          idNumber: null,
          fullname: "Arabic Language",
          displayName: null,
          categoryId: null,
          categoryName: null,
          visible: true,
        },
      ],
    });
    expect(
      normalizeEmsMoodleCoursePicker({
        catalog_refreshed_at: null,
        warnings: [],
        error: "catalog unavailable",
        courses: [],
      })
    ).toEqual({
      refreshedAt: null,
      warnings: [],
      error: "catalog unavailable",
      courses: [],
    });
    expect(
      normalizeEmsMoodleCoursePicker([
        { id: 7, shortname: "AR1", fullname: "Arabic" },
      ])
    ).toBeNull();
    expect(
      normalizeEmsMoodleCoursePicker({
        warnings: [],
        courses: [{ id: "7", shortname: "AR1", fullname: "Arabic" }],
      })
    ).toBeNull();
    expect(
      normalizeEmsMoodleGroups([
        {
          moodle_group_id: 9,
          name: "Group A",
          idnumber: "ga",
          courseid: 501,
        },
        { moodle_group_id: 10, name: "Group B", courseid: 501 },
      ])
    ).toEqual([
      { id: 9, name: "Group A", idNumber: "ga", moodleCourseId: 501 },
      { id: 10, name: "Group B", idNumber: null, moodleCourseId: 501 },
    ]);
    expect(
      normalizeEmsMoodleGroups([
        { moodle_group_id: 0, name: "G", courseid: 501 },
      ])
    ).toBeNull();
    expect(
      normalizeEmsMoodleGroups([
        { moodle_group_id: 9, name: "G", courseid: "501" },
      ])
    ).toBeNull();
  });
});

describe("EMS Moodle user search payload guard", () => {
  it("maps search rows and omitted fields to the closed DTO", () => {
    expect(
      normalizeEmsMoodleUsers([
        {
          moodle_user_id: 42,
          username: "jdoe",
          firstname: "Jane",
          lastname: null,
          fullname: "Jane Doe",
          email: "jane@example.test",
        },
        { moodle_user_id: 7 },
      ])
    ).toEqual([
      {
        id: 42,
        username: "jdoe",
        firstName: "Jane",
        lastName: null,
        fullName: "Jane Doe",
        email: "jane@example.test",
      },
      {
        id: 7,
        username: null,
        firstName: null,
        lastName: null,
        fullName: null,
        email: null,
      },
    ]);
  });

  it("rejects malformed search rows", () => {
    expect(normalizeEmsMoodleUsers({})).toBeNull();
    expect(normalizeEmsMoodleUsers([{ moodle_user_id: 0 }])).toBeNull();
    expect(normalizeEmsMoodleUsers([{ moodle_user_id: "42" }])).toBeNull();
    expect(
      normalizeEmsMoodleUsers([{ moodle_user_id: 1, username: 5 }])
    ).toBeNull();
  });
});

describe("EMS self profile payload guard", () => {
  it("accepts omitted and null optionals and drops unrelated fields", () => {
    expect(
      normalizeEmsSelfProfile({
        user: { profile: { first_name: "NCC", last_name: "Staff" } },
      })
    ).toEqual({
      firstName: "NCC",
      lastName: "Staff",
      phone: null,
      address: null,
      nationality: null,
      dateOfBirth: null,
      notes: null,
    });
    expect(
      normalizeEmsSelfProfile({
        session_id: "s-1",
        scopes: [],
        user: {
          id: "u-1",
          profile: {
            first_name: "NCC",
            last_name: "Staff",
            phone: "+20",
            address: null,
            nationality: "EGY",
            date_of_birth: "1990-01-01",
            notes: "note",
          },
        },
      })
    ).toEqual({
      firstName: "NCC",
      lastName: "Staff",
      phone: "+20",
      address: null,
      nationality: "EGY",
      dateOfBirth: "1990-01-01",
      notes: "note",
    });
  });

  it("rejects a missing profile or malformed optionals", () => {
    expect(normalizeEmsSelfProfile({ user: {} })).toBeNull();
    expect(
      normalizeEmsSelfProfile({ user: { profile: { first_name: "NCC" } } })
    ).toBeNull();
    expect(
      normalizeEmsSelfProfile({
        user: {
          profile: { first_name: "NCC", last_name: "Staff", phone: 4 },
        },
      })
    ).toBeNull();
  });
});

describe("EMS session envelope", () => {
  const payload = {
    ownerSessionId: "nile-session-1",
    accessToken: "access-1",
    refreshToken: "refresh-1",
    accessTokenExpiresAt: accessExpiresAt,
    refreshTokenExpiresAt: refreshExpiresAt,
    sessionId: "ems-session-1",
  };

  it("round-trips tokens without exposing them in plaintext", () => {
    const envelope = sealEmsSession(payload, { EMS_SESSION_SEAL_KEY: sealKey });
    expect(envelope).not.toContain(payload.accessToken);
    expect(envelope).not.toContain(payload.refreshToken);
    expect(openEmsSession(envelope, { EMS_SESSION_SEAL_KEY: sealKey })).toEqual(
      payload
    );
  });

  it("rejects missing configuration and tampering", () => {
    expect(() => sealEmsSession(payload, {})).toThrow(
      EmsSessionConfigurationError
    );
    const envelope = sealEmsSession(payload, { EMS_SESSION_SEAL_KEY: sealKey });
    const tamperAt = Math.floor(envelope.length / 2);
    const replacement = envelope[tamperAt] === "A" ? "B" : "A";
    const tampered = `${envelope.slice(0, tamperAt)}${replacement}${envelope.slice(tamperAt + 1)}`;
    expect(() =>
      openEmsSession(tampered, {
        EMS_SESSION_SEAL_KEY: sealKey,
      })
    ).toThrow(EmsSessionInvalidError);
  });
});

describe("EMS staging client requests", () => {
  it("sends a browser-like UA and JSON bodies", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { pong: true }));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    const result = await client.ping();
    expect(result.ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain(
      "Mozilla"
    );
    expect(init.redirect).toBe("error");
  });

  it("encodes Moodle picker and group search queries", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { items: [] }));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    await client.moodleCourses("access-1", "arab & eng", true);
    await client.moodleGroups("access-1", "course-1", "group a");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://staging.example/api/moodle/courses?q=arab+%26+eng&refresh=true",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://staging.example/api/moodle/groups?course_id=course-1&q=group+a",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("sends empty POSTs for delivery lifecycle and Moodle sync", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    await client.refreshCourse("access-1", "course-1");
    await client.disableRoom("access-1", "room-1");
    await client.syncClassMoodle("access-1", "class-1");
    for (const [url, init] of fetchImpl.mock.calls as [
      string,
      RequestInit,
    ][]) {
      expect(init.method).toBe("POST");
      expect(init.body).toBeUndefined();
    }
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://staging.example/api/courses/course-1/refresh",
      expect.anything()
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://staging.example/api/rooms/room-1/disable",
      expect.anything()
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "https://staging.example/api/classes/class-1/moodle/sync",
      expect.anything()
    );
  });

  it("sends remote logout with the bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    const result = await client.logout("access-1");
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://staging.example/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-1" }),
      })
    );
  });
});

type Handler = (
  request: {
    headers: { cookie?: string };
    body?: Record<string, unknown>;
    get(name: string): string | undefined;
  },
  response: {
    status(code: number): unknown;
    json(body: unknown): void;
    setHeader(name: string, value: string): void;
  }
) => void | Promise<void>;

function testSession(id = "nile-session-1", activeRole = "superadmin") {
  return {
    id,
    activeRole,
    expiresAt: "2099-01-15T00:00:00Z",
  };
}

function request(
  options: {
    body?: Record<string, unknown>;
    cookie?: string;
  } = {}
) {
  return {
    headers: options.cookie ? { cookie: options.cookie } : {},
    body: options.body,
    get: () => undefined,
  };
}

function harness(options: {
  session?: ReturnType<typeof testSession> | null;
  env?: NodeJS.ProcessEnv;
  client?: Record<string, unknown>;
}) {
  const routes = new Map<string, Handler>();
  const app = {
    get(path: string, handler: Handler) {
      routes.set(`GET ${path}`, handler);
    },
    post(path: string, handler: Handler) {
      routes.set(`POST ${path}`, handler);
    },
  };
  const statuses: number[] = [];
  const bodies: unknown[] = [];
  const headers = new Map<string, string>();
  const response = () => {
    const target = {
      status(code: number) {
        statuses.push(code);
        return target;
      },
      json(body: unknown) {
        bodies.push(body);
      },
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    };
    return target;
  };
  registerEmsStagingRoutes(app, {
    env: options.env ?? {
      EMS_STAGING_BASE_URL: "https://staging.example/api",
      EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      EMS_SESSION_SEAL_KEY: sealKey,
      NODE_ENV: "test",
    },
    getSession: async () => options.session ?? null,
    createClient:
      options.client === undefined ? undefined : () => options.client as never,
  });
  return { routes, statuses, bodies, headers, response };
}

function cookieFrom(headers: Map<string, string>) {
  return headers.get("Set-Cookie")?.split(";")[0] ?? "";
}

describe("EMS staging routes", () => {
  it("requires sign-in for status", async () => {
    const { routes, statuses, response } = harness({ session: null });
    await routes.get("GET /api/ems-staging/status")!(
      request(),
      response() as never
    );
    expect(statuses).toEqual([401]);
  });

  it("requires Super Admin for the link route", async () => {
    const { routes, statuses, response } = harness({
      session: testSession("nile-session-1", "teacher"),
    });
    await routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "a@b.c", password: "x" } }),
      response() as never
    );
    expect(statuses).toEqual([403]);
  });

  it("reports transport and session configuration without network access", async () => {
    const { routes, bodies, response } = harness({
      session: testSession(),
      env: { EMS_SESSION_SEAL_KEY: sealKey },
    });
    await routes.get("GET /api/ems-staging/status")!(
      request(),
      response() as never
    );
    expect(bodies).toEqual([
      {
        configured: false,
        reachable: false,
        linked: false,
        sessionProtectionConfigured: true,
      },
    ]);
  });

  it("refuses login before session protection is configured", async () => {
    const login = vi.fn();
    const { routes, statuses, bodies, response } = harness({
      session: testSession(),
      env: {
        EMS_STAGING_BASE_URL: "https://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      },
      client: { login },
    });
    await routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "lead@example.com", password: "secret" } }),
      response() as never
    );
    expect(statuses).toEqual([503]);
    expect(bodies).toEqual([
      { error: "NCC EMS session protection is not configured." },
    ]);
    expect(login).not.toHaveBeenCalled();
  });

  it("seals the token pair in an HttpOnly cookie and returns only the me view", async () => {
    const login = vi.fn(async () => ({ ok: true, data: authPayload() }));
    const me = vi.fn(async () => ({ ok: true, data: mePayload() }));
    const logout = vi.fn(async () => ({ ok: true, data: null }));
    const { routes, statuses, bodies, headers, response } = harness({
      session: testSession(),
      client: { login, me, logout },
    });
    await routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "lead@example.com", password: "secret" } }),
      response() as never
    );
    const cookie = headers.get("Set-Cookie") ?? "";
    expect(statuses).toEqual([]);
    expect(bodies).toEqual([
      {
        assignedRole: "superadmin",
        activeRole: "superadmin",
        workspaceBranchId: null,
        scopes: [{ scopeType: "global", scopeId: null, isLive: true }],
      },
    ]);
    expect(cookie).toContain(`${EMS_SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("access-1");
    expect(cookie).not.toContain("refresh-1");
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Secure on the sealed production cookie", async () => {
    const { routes, headers, response } = harness({
      session: testSession(),
      env: {
        EMS_STAGING_BASE_URL: "https://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
        EMS_SESSION_SEAL_KEY: sealKey,
        NODE_ENV: "production",
      },
      client: {
        login: async () => ({ ok: true, data: authPayload() }),
        me: async () => ({ ok: true, data: mePayload() }),
      },
    });
    await routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "lead@example.com", password: "secret" } }),
      response() as never
    );
    expect(headers.get("Set-Cookie")).toContain("; Secure");
  });

  it("verifies a sealed session across route instances", async () => {
    const loginHarness = harness({
      session: testSession(),
      client: {
        login: async () => ({ ok: true, data: authPayload() }),
        me: async () => ({ ok: true, data: mePayload() }),
        logout: async () => ({ ok: true, data: null }),
      },
    });
    await loginHarness.routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "lead@example.com", password: "secret" } }),
      loginHarness.response() as never
    );

    const statusHarness = harness({
      session: testSession(),
      client: {
        ping: async () => ({ ok: true, data: { pong: true } }),
        me: async () => ({ ok: true, data: mePayload() }),
      },
    });
    await statusHarness.routes.get("GET /api/ems-staging/status")!(
      request({ cookie: cookieFrom(loginHarness.headers) }),
      statusHarness.response() as never
    );
    expect(statusHarness.bodies).toEqual([
      {
        configured: true,
        reachable: true,
        linked: true,
        sessionProtectionConfigured: true,
      },
    ]);
  });

  it("rejects a sealed EMS session owned by another Nile session", async () => {
    const envelope = sealEmsSession(
      {
        ownerSessionId: "other-session",
        accessToken: "access-1",
        refreshToken: "refresh-1",
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        sessionId: "ems-session-1",
      },
      { EMS_SESSION_SEAL_KEY: sealKey }
    );
    const { routes, bodies, headers, response } = harness({
      session: testSession(),
      client: { ping: async () => ({ ok: true, data: { pong: true } }) },
    });
    await routes.get("GET /api/ems-staging/status")!(
      request({ cookie: `${EMS_SESSION_COOKIE_NAME}=${envelope}` }),
      response() as never
    );
    expect(bodies).toEqual([
      {
        configured: true,
        reachable: true,
        linked: false,
        sessionProtectionConfigured: true,
      },
    ]);
    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("rotates the sealed token pair after a 401 and retries once", async () => {
    const oldEnvelope = sealEmsSession(
      {
        ownerSessionId: "nile-session-1",
        accessToken: "access-old",
        refreshToken: "refresh-old",
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        sessionId: "ems-session-1",
      },
      { EMS_SESSION_SEAL_KEY: sealKey }
    );
    const me = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { error: "Not authenticated", status: 401 },
      })
      .mockResolvedValueOnce({ ok: true, data: mePayload() });
    const refresh = vi.fn(async () => ({
      ok: true,
      data: authPayload("access-new", "refresh-new"),
    }));
    const { routes, bodies, headers, response } = harness({
      session: testSession(),
      client: {
        ping: async () => ({ ok: true, data: { pong: true } }),
        me,
        refresh,
      },
    });
    await routes.get("GET /api/ems-staging/status")!(
      request({ cookie: `${EMS_SESSION_COOKIE_NAME}=${oldEnvelope}` }),
      response() as never
    );
    expect(bodies).toEqual([
      {
        configured: true,
        reachable: true,
        linked: true,
        sessionProtectionConfigured: true,
      },
    ]);
    expect(refresh).toHaveBeenCalledWith("refresh-old");
    expect(me).toHaveBeenNthCalledWith(1, "access-old");
    expect(me).toHaveBeenNthCalledWith(2, "access-new");
    const sealed = decodeURIComponent(cookieFrom(headers).split("=")[1]);
    expect(
      openEmsSession(sealed, { EMS_SESSION_SEAL_KEY: sealKey })
    ).toMatchObject({ accessToken: "access-new", refreshToken: "refresh-new" });
  });

  it("revokes the remote session and clears the local cookie", async () => {
    const envelope = sealEmsSession(
      {
        ownerSessionId: "nile-session-1",
        accessToken: "access-1",
        refreshToken: "refresh-1",
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        sessionId: "ems-session-1",
      },
      { EMS_SESSION_SEAL_KEY: sealKey }
    );
    const logout = vi.fn(async () => ({ ok: true, data: null }));
    const { routes, bodies, headers, response } = harness({
      session: testSession(),
      client: { logout },
    });
    await routes.get("POST /api/ems-staging/logout")!(
      request({ cookie: `${EMS_SESSION_COOKIE_NAME}=${envelope}` }),
      response() as never
    );
    expect(logout).toHaveBeenCalledWith("access-1");
    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(bodies).toEqual([{ ok: true }]);
  });
});

describe("EMS delivery workflow payload guards", () => {
  const rosterRow = {
    student_id: "student-1",
    class_id: "class-1",
    class_name: "Arabic A",
    course_id: "course-1",
    course_name: "Arabic",
    status: "enrolled",
    enrolled_at: "2026-09-10T10:00:00Z",
    withdrawn_at: null,
    student: {
      first_name: "Nile",
      last_name: "Student",
      email: "student@example.test",
      branch_id: "branch-1",
      moodle_user_id: 42,
    },
  };
  const sessionRow = {
    id: "session-1",
    class_id: "class-1",
    class_name: "Arabic A",
    branch_id: "branch-1",
    room_id: "room-1",
    room_name: "Room 1",
    teacher_id: "teacher-1",
    teacher_name: "Nile Teacher",
    starts_at: "2026-09-17T10:00:00Z",
    ends_at: "2026-09-17T11:00:00Z",
    duration_hours: 1,
    status: "scheduled",
    created_at: "2026-09-12T09:00:00Z",
    updated_at: "2026-09-12T09:00:00Z",
  };
  const slotRow = {
    starts_at: "2026-09-17T10:00:00Z",
    duration_hours: 1,
    teacher_id: "teacher-1",
    room_id: null,
  };
  const attendanceRow = {
    moodle_session_id: 55,
    attendanceid: 13,
    ems_session_id: "session-1",
    sessdate: "2026-09-17",
    duration: 3600,
    groupid: 9,
    statuses: [{ id: 1, acronym: "P", description: "Present" }],
    students: [
      {
        student_id: "student-1",
        first_name: "Nile",
        last_name: "Student",
        email: "student@example.test",
        moodle_user_id: 42,
        status_id: "1",
        status_acronym: "P",
        status_description: "Present",
        remarks: null,
      },
    ],
  };
  const gradesRow = {
    class_id: "class-1",
    moodle_course_id: 501,
    course_name: "Arabic",
    students: [
      {
        student_id: "student-1",
        first_name: "Nile",
        last_name: "Student",
        email: "student@example.test",
        moodle_user_id: 42,
        course_grade: "85.00",
        grade_items: [
          {
            id: 7,
            itemname: "Quiz",
            itemtype: "mod",
            itemmodule: "quiz",
            gradeformatted: "9.00",
            percentageformatted: "90.00 %",
            grademin: 0,
            grademax: 10,
          },
        ],
      },
    ],
  };

  it("normalizes class roster rows and rejects malformed nested rows", () => {
    const items = normalizeEmsClassEnrolments([rosterRow]);
    expect(items).toEqual([
      {
        studentId: "student-1",
        classId: "class-1",
        className: "Arabic A",
        courseId: "course-1",
        courseName: "Arabic",
        status: "enrolled",
        enrolledAt: "2026-09-10T10:00:00Z",
        withdrawnAt: null,
        student: {
          branchId: "branch-1",
          email: "student@example.test",
          firstName: "Nile",
          lastName: "Student",
          moodleLinked: true,
        },
      },
    ]);
    expect(
      normalizeEmsClassEnrolments([{ ...rosterRow, status: "dropped" }])
    ).toBeNull();
    expect(
      normalizeEmsClassEnrolments([
        { ...rosterRow, student: { ...rosterRow.student, moodle_user_id: 0 } },
      ])
    ).toBeNull();
    expect(
      normalizeEmsClassEnrolments([
        { ...rosterRow, student: { ...rosterRow.student, branch_id: "" } },
      ])
    ).toBeNull();
    expect(
      normalizeEmsClassEnrolments([{ ...rosterRow, enrolled_at: "not-a-date" }])
    ).toBeNull();
    expect(
      normalizeEmsClassEnrolments([{ ...rosterRow, withdrawn_at: 5 }])
    ).toBeNull();
    expect(normalizeEmsClassEnrolments("x")).toBeNull();
  });

  it("normalizes sessions and rejects malformed timestamps/status", () => {
    expect(normalizeEmsSessions([sessionRow])).toEqual([
      {
        id: "session-1",
        classId: "class-1",
        className: "Arabic A",
        branchId: "branch-1",
        roomId: "room-1",
        roomName: "Room 1",
        teacherId: "teacher-1",
        teacherName: "Nile Teacher",
        startsAt: "2026-09-17T10:00:00Z",
        endsAt: "2026-09-17T11:00:00Z",
        durationHours: 1,
        status: "scheduled",
        createdAt: "2026-09-12T09:00:00Z",
        updatedAt: "2026-09-12T09:00:00Z",
      },
    ]);
    expect(normalizeEmsSession({ ...sessionRow, status: "done" })).toBeNull();
    expect(
      normalizeEmsSession({ ...sessionRow, starts_at: "not-a-date" })
    ).toBeNull();
    expect(
      normalizeEmsSession({ ...sessionRow, duration_hours: 0 })
    ).toBeNull();
    expect(
      normalizeEmsSession({ ...sessionRow, teacher_id: 5 })
    ).toBeNull();
    expect(
      normalizeEmsSession({ ...sessionRow, created_at: "not-a-date" })
    ).toBeNull();
    expect(
      normalizeEmsSession({ ...sessionRow, updated_at: "not-a-date" })
    ).toBeNull();
  });

  it("normalizes propose slots and batch responses", () => {
    expect(normalizeEmsSessionSlots({ slots: [slotRow] })).toEqual([
      {
        startsAt: "2026-09-17T10:00:00Z",
        durationHours: 1,
        teacherId: "teacher-1",
        roomId: null,
      },
    ]);
    expect(
      normalizeEmsSessionSlots({ slots: [{ ...slotRow, duration_hours: 0 }] })
    ).toBeNull();
    expect(normalizeEmsSessionSlots({ slots: [] })).toEqual([]);
    expect(normalizeEmsSessionSlots([])).toBeNull();
    expect(
      normalizeEmsSessionBatch({ sessions: [sessionRow], created_count: 1 })
    ).toEqual({
      createdCount: 1,
      items: [expect.objectContaining({ id: "session-1" })],
    });
    expect(
      normalizeEmsSessionBatch({ sessions: [sessionRow], created_count: "1" })
    ).toBeNull();
  });

  it("normalizes attendance detail with statuses and marks", () => {
    const detail = normalizeEmsAttendanceDetail(attendanceRow);
    expect(detail).toEqual({
      moodleSessionId: 55,
      attendanceId: 13,
      emsSessionId: "session-1",
      sessionDate: "2026-09-17",
      durationSeconds: 3600,
      moodleGroupId: 9,
      statuses: [{ id: 1, acronym: "P", description: "Present" }],
      students: [
        {
          studentId: "student-1",
          firstName: "Nile",
          lastName: "Student",
          email: "student@example.test",
          moodleUserId: 42,
          statusId: "1",
          statusAcronym: "P",
          statusDescription: "Present",
          remarks: null,
        },
      ],
    });
    expect(
      normalizeEmsAttendanceDetail({
        ...attendanceRow,
        students: [{ ...attendanceRow.students[0], status_id: 1 }],
      })
    ).toBeNull();
    expect(
      normalizeEmsAttendanceDetail({
        ...attendanceRow,
        statuses: [{ id: "x" }],
      })
    ).toBeNull();
    expect(
      normalizeEmsAttendanceDetail({ ...attendanceRow, groupid: 0 })
    ).toBeNull();
    expect(
      normalizeEmsAttendanceDetail({ ...attendanceRow, sessdate: "x" })
    ).toBeNull();
    expect(
      normalizeEmsAttendanceDetail({ ...attendanceRow, duration: 0 })
    ).toBeNull();
  });

  it("normalizes class grades and rejects malformed grade items", () => {
    const grades = normalizeEmsClassGrades(gradesRow);
    expect(grades?.students[0]?.gradeItems[0]).toEqual({
      id: 7,
      itemName: "Quiz",
      itemType: "mod",
      itemModule: "quiz",
      gradeFormatted: "9.00",
      percentageFormatted: "90.00 %",
      gradeMin: 0,
      gradeMax: 10,
    });
    expect(
      normalizeEmsClassGrades({
        ...gradesRow,
        students: [
          {
            ...gradesRow.students[0],
            grade_items: [{ id: 0 }],
          },
        ],
      })
    ).toBeNull();
    expect(
      normalizeEmsClassGrades({ ...gradesRow, moodle_course_id: -1 })
    ).toBeNull();
    for (const bound of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        normalizeEmsClassGrades({
          ...gradesRow,
          students: [
            {
              ...gradesRow.students[0],
              grade_items: [{ ...gradesRow.students[0].grade_items[0], grademin: bound }],
            },
          ],
        })
      ).toBeNull();
    }
    expect(normalizeEmsClassGrades([])).toBeNull();
  });
});

describe("EMS delivery workflow client requests", () => {
  it("sends exact methods, paths, and bodies for every workflow method", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    await client.classEnrolments("t", "class 1");
    await client.createClassEnrolment("t", "class-1", {
      student_id: "s-1",
      status: "enrolled",
    });
    await client.withdrawClassEnrolment("t", "class-1", "stu 1");
    await client.completeClassEnrolment("t", "class-1", "s-1");
    await client.classSessions("t", "class-1");
    await client.proposeClassSessions("t", "class-1", {
      weekdays: [1],
      hours_per_day: 1,
      from_date: "2026-09-17",
      to_date: "2026-09-24",
      start_hour: 13,
    });
    await client.confirmClassSessions("t", "class-1", { slots: [] });
    await client.batchClassSessions("t", "class-1", { slots: [] });
    await client.session("t", "sess 1");
    await client.patchSession("t", "sess-1", { duration_hours: 2 });
    await client.cancelSession("t", "sess-1");
    await client.sessionAttendance("t", "sess-1");
    await client.markSessionAttendance("t", "sess-1", {
      marks: [{ student_id: "s-1", status_id: 1 }],
    });
    await client.classGrades("t", "class-1");

    const calls = fetchImpl.mock.calls as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      "https://staging.example/api/classes/class%201/enrolments",
      "https://staging.example/api/classes/class-1/enrolments",
      "https://staging.example/api/classes/class-1/enrolments/stu%201/withdraw",
      "https://staging.example/api/classes/class-1/enrolments/s-1/complete",
      "https://staging.example/api/classes/class-1/sessions",
      "https://staging.example/api/classes/class-1/sessions/propose",
      "https://staging.example/api/classes/class-1/sessions/confirm",
      "https://staging.example/api/classes/class-1/sessions/batch",
      "https://staging.example/api/sessions/sess%201",
      "https://staging.example/api/sessions/sess-1",
      "https://staging.example/api/sessions/sess-1/cancel",
      "https://staging.example/api/sessions/sess-1/attendance",
      "https://staging.example/api/sessions/sess-1/attendance",
      "https://staging.example/api/classes/class-1/grades",
    ]);
    expect(calls.map(([, init]) => init.method)).toEqual([
      "GET",
      "POST",
      "POST",
      "POST",
      "GET",
      "POST",
      "POST",
      "POST",
      "GET",
      "PATCH",
      "POST",
      "GET",
      "POST",
      "GET",
    ]);
    expect(JSON.parse(calls[1][1].body as string)).toEqual({
      student_id: "s-1",
      status: "enrolled",
    });
    expect(JSON.parse(calls[5][1].body as string)).toEqual({
      weekdays: [1],
      hours_per_day: 1,
      from_date: "2026-09-17",
      to_date: "2026-09-24",
      start_hour: 13,
    });
    expect(calls[2][1].body).toBeUndefined();
    expect(calls[3][1].body).toBeUndefined();
    expect(calls[10][1].body).toBeUndefined();
    expect(JSON.parse(calls[12][1].body as string)).toEqual({
      marks: [{ student_id: "s-1", status_id: 1 }],
    });
  });
});

const systemHealthRow = {
  status: "healthy",
  checked_at: "2026-09-14T10:00:00Z",
  components: {
    api: { status: "ok", detail: null },
    database: { status: "ok", detail: null },
    schema_check: { status: "ok", detail: null, missing_tables: [] },
    migration: { status: "ok", detail: null, version: "2026.09.01" },
    moodle: {
      status: "ok",
      detail: null,
      configured: true,
      has_token: true,
      reachable: true,
      sitename: "Moodle No Data",
      release: "4.5.7+",
      version_expected: true,
      warnings: [],
    },
  },
};

describe("EMS system health payload guard", () => {
  it("accepts the live health payload and omits has_token", () => {
    const health = normalizeEmsSystemHealth(systemHealthRow);
    expect(health).toEqual({
      status: "healthy",
      checkedAt: "2026-09-14T10:00:00Z",
      components: {
        api: { status: "ok", detail: null },
        database: { status: "ok", detail: null },
        schemaCheck: { status: "ok", detail: null, missingTables: [] },
        migration: { status: "ok", detail: null, version: "2026.09.01" },
        moodle: {
          status: "ok",
          detail: null,
          configured: true,
          reachable: true,
          siteName: "Moodle No Data",
          release: "4.5.7+",
          versionExpected: true,
          warnings: [],
        },
      },
    });
    expect(health && "has_token" in health.components.moodle).toBe(false);
    expect(
      health && "hasToken" in (health.components.moodle as object)
    ).toBe(false);
  });

  it("rejects malformed statuses, components, timestamps, booleans, and arrays", () => {
    expect(
      normalizeEmsSystemHealth({ ...systemHealthRow, status: "great" })
    ).toBeNull();
    expect(
      normalizeEmsSystemHealth({ ...systemHealthRow, checked_at: "nope" })
    ).toBeNull();
    const missingComponent = {
      ...systemHealthRow,
      components: { ...systemHealthRow.components, moodle: undefined },
    };
    expect(normalizeEmsSystemHealth(missingComponent)).toBeNull();
    expect(
      normalizeEmsSystemHealth({
        ...systemHealthRow,
        components: {
          ...systemHealthRow.components,
          api: { status: "fine", detail: null },
        },
      })
    ).toBeNull();
    expect(
      normalizeEmsSystemHealth({
        ...systemHealthRow,
        components: {
          ...systemHealthRow.components,
          moodle: { ...systemHealthRow.components.moodle, configured: "yes" },
        },
      })
    ).toBeNull();
    expect(
      normalizeEmsSystemHealth({
        ...systemHealthRow,
        components: {
          ...systemHealthRow.components,
          moodle: { ...systemHealthRow.components.moodle, warnings: [1] },
        },
      })
    ).toBeNull();
    expect(
      normalizeEmsSystemHealth({
        ...systemHealthRow,
        components: {
          ...systemHealthRow.components,
          schema_check: {
            ...systemHealthRow.components.schema_check,
            missing_tables: [42],
          },
        },
      })
    ).toBeNull();
    expect(normalizeEmsSystemHealth([])).toBeNull();
    expect(normalizeEmsSystemHealth(null)).toBeNull();
  });
});

describe("EMS system health client request", () => {
  it("sends GET /system/health", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    await client.systemHealth("t");
    const calls = fetchImpl.mock.calls as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      "https://staging.example/api/system/health",
    ]);
    expect(calls.map(([, init]) => init.method)).toEqual(["GET"]);
  });
});

const dashboardSummaryRow = {
  cards: {
    active_students: 1,
    open_leads: 0,
    active_classes: 1,
    enrolment_fill: 1,
    enrolment_capacity: 20,
    scheduled_placements: 0,
    scheduled_trials: 0,
    staff_count: 4,
  },
  by_branch: [
    {
      branch_id: "branch-1",
      branch_name: "NILE-QA-20260914",
      active_students: 1,
      open_leads: 0,
      active_classes: 1,
      enrolment_fill: 1,
      enrolment_capacity: 20,
      scheduled_placements: 0,
      scheduled_trials: 0,
      staff_count: 4,
    },
  ],
  charts: {
    students_by_branch: [
      { key: "branch-1", label: "NILE-QA-20260914", count: 1 },
    ],
    leads_by_status: [{ key: "new", label: "New", count: 0 }],
    placement_trial_by_status: [
      { key: "scheduled", label: "Scheduled", count: 0 },
    ],
    class_fill_by_branch: [
      {
        branch_id: "branch-1",
        branch_name: "NILE-QA-20260914",
        enrolment_fill: 1,
        enrolment_capacity: 20,
        fill_pct: 5,
      },
    ],
  },
};

describe("EMS dashboard summary payload guard", () => {
  it("accepts the live summary and normalizes null staff", () => {
    const summary = normalizeEmsDashboardSummary(dashboardSummaryRow);
    expect(summary?.cards).toEqual({
      activeStudents: 1,
      openLeads: 0,
      activeClasses: 1,
      enrolmentFill: 1,
      enrolmentCapacity: 20,
      scheduledPlacements: 0,
      scheduledTrials: 0,
      staffCount: 4,
    });
    expect(summary?.byBranch[0]?.branchName).toBe("NILE-QA-20260914");
    expect(summary?.charts.classFillByBranch[0]?.fillPct).toBe(5);
    const registrarRow = {
      ...dashboardSummaryRow,
      cards: { ...dashboardSummaryRow.cards, staff_count: null },
      by_branch: [
        { ...dashboardSummaryRow.by_branch[0], staff_count: undefined },
      ],
    };
    const registrar = normalizeEmsDashboardSummary(registrarRow);
    expect(registrar?.cards.staffCount).toBeNull();
    expect(registrar?.byBranch[0]?.staffCount).toBeNull();
  });

  it("rejects malformed counts, names, fill pct, and missing charts", () => {
    const withCards = (cards: Record<string, unknown>) =>
      normalizeEmsDashboardSummary({ ...dashboardSummaryRow, cards });
    expect(
      withCards({ ...dashboardSummaryRow.cards, active_students: -1 })
    ).toBeNull();
    expect(
      withCards({ ...dashboardSummaryRow.cards, open_leads: 1.5 })
    ).toBeNull();
    expect(
      withCards({ ...dashboardSummaryRow.cards, staff_count: "4" })
    ).toBeNull();
    expect(
      normalizeEmsDashboardSummary({
        ...dashboardSummaryRow,
        by_branch: [
          { ...dashboardSummaryRow.by_branch[0], branch_name: "" },
        ],
      })
    ).toBeNull();
    expect(
      normalizeEmsDashboardSummary({
        ...dashboardSummaryRow,
        charts: {
          ...dashboardSummaryRow.charts,
          leads_by_status: [{ key: "", label: "New", count: 0 }],
        },
      })
    ).toBeNull();
    expect(
      normalizeEmsDashboardSummary({
        ...dashboardSummaryRow,
        charts: {
          ...dashboardSummaryRow.charts,
          class_fill_by_branch: [
            {
              ...dashboardSummaryRow.charts.class_fill_by_branch[0],
              fill_pct: Number.NaN,
            },
          ],
        },
      })
    ).toBeNull();
    const missingChart = {
      ...dashboardSummaryRow,
      charts: { ...dashboardSummaryRow.charts, leads_by_status: undefined },
    };
    expect(normalizeEmsDashboardSummary(missingChart)).toBeNull();
    expect(normalizeEmsDashboardSummary([])).toBeNull();
    expect(normalizeEmsDashboardSummary(null)).toBeNull();
  });
});

describe("EMS dashboard summary client request", () => {
  it("sends GET /dashboard/summary", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    await client.dashboardSummary("t");
    const calls = fetchImpl.mock.calls as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      "https://staging.example/api/dashboard/summary",
    ]);
    expect(calls.map(([, init]) => init.method)).toEqual(["GET"]);
  });
});

const auditEventRow = {
  id: "evt-1",
  stream: "auth",
  event_type: "auth.login.success",
  created_at: "2026-09-14T10:00:00Z",
  actor_display_name: "QA Admin",
  actor_user_id: "user-1",
  branch_id: "branch-1",
  entity_id: "entity-1",
  entity_label: "Admin account",
  secondary_entity_id: null,
  target_user_id: "user-2",
  payload: { secret: "never" },
  ip_address: "10.0.0.1",
  user_agent: "curl/1.0",
};

describe("EMS audit events payload guard", () => {
  it("accepts live rows and omits payload, ip_address, and user_agent", () => {
    const items = normalizeEmsAuditEvents([auditEventRow]);
    expect(items).toEqual([
      {
        id: "evt-1",
        stream: "auth",
        eventType: "auth.login.success",
        createdAt: "2026-09-14T10:00:00Z",
        actorDisplayName: "QA Admin",
        actorUserId: "user-1",
        branchId: "branch-1",
        entityId: "entity-1",
        entityLabel: "Admin account",
        secondaryEntityId: null,
        targetUserId: "user-2",
      },
    ]);
    expect(items && "payload" in items[0]).toBe(false);
    expect(items && !Object.keys(items[0]).some(k => /ip|agent/i.test(k))).toBe(
      true
    );
  });

  it("rejects malformed rows", () => {
    const bad = (patch: Record<string, unknown>) =>
      normalizeEmsAuditEvents([{ ...auditEventRow, ...patch }]);
    expect(bad({ stream: "payments" })).toBeNull();
    expect(bad({ created_at: "not-a-date" })).toBeNull();
    expect(bad({ id: "" })).toBeNull();
    expect(bad({ event_type: "" })).toBeNull();
    expect(bad({ actor_user_id: 42 })).toBeNull();
    expect(bad({ branch_id: "" })).toBeNull();
    expect(bad({ actor_display_name: "" })).toBeNull();
    expect(bad({ entity_label: 7 })).toBeNull();
    expect(normalizeEmsAuditEvents({ items: [] })).toBeNull();
  });
});

describe("EMS audit events client request", () => {
  it("sends GET /audit/events with fixed query order", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    await client.auditEvents("t", {
      stream: "auth",
      eventType: "auth.login.success",
      limit: 50,
    });
    await client.auditEvents("t", { limit: 100 });
    const calls = fetchImpl.mock.calls as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      "https://staging.example/api/audit/events?stream=auth&event_type=auth.login.success&limit=50",
      "https://staging.example/api/audit/events?limit=100",
    ]);
    expect(calls.map(([, init]) => init.method)).toEqual(["GET", "GET"]);
  });
});

const notificationRow = {
  id: "ntf-1",
  category: "operations",
  kind: "enrolment",
  title: "Learner enrolled",
  body: "A learner was enrolled.",
  created_at: "2026-09-14T10:00:00Z",
  read_at: null,
  payload: { secret: "never" },
};

describe("EMS notifications payload guard", () => {
  it("accepts live rows and omits payload", () => {
    expect(normalizeEmsNotifications([notificationRow])).toEqual([
      {
        id: "ntf-1",
        category: "operations",
        kind: "enrolment",
        title: "Learner enrolled",
        body: "A learner was enrolled.",
        createdAt: "2026-09-14T10:00:00Z",
        readAt: null,
      },
    ]);
    const single = normalizeEmsNotification({
      ...notificationRow,
      read_at: "2026-09-14T11:00:00Z",
    });
    expect(single?.readAt).toBe("2026-09-14T11:00:00Z");
    expect(single && "payload" in single).toBe(false);
  });

  it("rejects malformed rows and count payloads", () => {
    const bad = (patch: Record<string, unknown>) =>
      normalizeEmsNotifications([{ ...notificationRow, ...patch }]);
    expect(bad({ id: "" })).toBeNull();
    expect(bad({ category: "" })).toBeNull();
    expect(bad({ kind: "" })).toBeNull();
    expect(bad({ title: "" })).toBeNull();
    expect(bad({ created_at: "nope" })).toBeNull();
    expect(bad({ body: 4 })).toBeNull();
    expect(bad({ read_at: "nope" })).toBeNull();
    expect(normalizeEmsNotifications({ items: [] })).toBeNull();
    expect(
      normalizeEmsNotificationUnreadCount({ unread_count: -1 })
    ).toBeNull();
    expect(
      normalizeEmsNotificationUnreadCount({ unread_count: 2 })
    ).toEqual({ unreadCount: 2 });
    expect(
      normalizeEmsNotificationsMarkedRead({ marked_read: 1.5 })
    ).toBeNull();
    expect(
      normalizeEmsNotificationsMarkedRead({ marked_read: 3 })
    ).toEqual({ markedRead: 3 });
  });
});

describe("EMS notifications client requests", () => {
  it("sends exact methods and paths", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    await client.notifications("t", { unread: true, limit: 6 });
    await client.notifications("t", { limit: 10 });
    await client.notificationUnreadCount("t");
    await client.markNotificationRead("t", "ntf 1");
    await client.markAllNotificationsRead("t");
    const calls = fetchImpl.mock.calls as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      "https://staging.example/api/notifications?unread=true&limit=6",
      "https://staging.example/api/notifications?limit=10",
      "https://staging.example/api/notifications/unread-count",
      "https://staging.example/api/notifications/ntf%201/read",
      "https://staging.example/api/notifications/read-all",
    ]);
    expect(calls.map(([, init]) => init.method)).toEqual([
      "GET",
      "GET",
      "GET",
      "POST",
      "POST",
    ]);
    expect(calls[3][1].body).toBeUndefined();
    expect(calls[4][1].body).toBeUndefined();
  });
});
