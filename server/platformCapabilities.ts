import type { PlatformWorkflowAction } from "../client/src/lib/domain/actions.js";
import {
  rolePermissions,
  type Permission,
  type Role,
} from "../client/src/lib/platformData.js";

export const SELF_SCOPED_ACTION = "self_scoped" as const;

type ActionPermissionRule =
  | Permission
  | typeof SELF_SCOPED_ACTION;

export const platformActionTypesByRole = {
  student: [
    "lesson.start",
    "lesson.complete",
    "assignment.submit",
    "quiz.submit",
    "recitation.submit",
    "message.send",
    "message.read",
    "notification.read",
    "report.preset.save",
    "profile.update",
    "support.ticket.create",
    "attendance.exception.submit",
  ],
  teacher: [
    "assignment.create",
    "assignment.update",
    "assignment.status.update",
    "quiz.create",
    "quiz.update",
    "quiz.status.update",
    "question.create",
    "quiz.questions.set",
    "assignment.grade",
    "quiz.review",
    "attendance.save",
    "calendar.create",
    "class.session.reschedule",
    "class.session.cancel",
    "material.publish.update",
    "message.send",
    "message.read",
    "quran.progress.update",
    "recitation.review",
    "notification.read",
    "report.preset.save",
    "profile.update",
  ],
  registrar: [
    "lead.create",
    "application.create",
    "placement.create",
    "placement.result.record",
    "lead.convert",
    "application.convert",
    "student.create",
    "student.status.update",
    "student.document.add",
    "enrollment.activate",
    "enrollment.transfer",
    "enrollment.status.update",
    "payment.record",
    "calendar.create",
    "message.send",
    "message.read",
    "notification.read",
    "report.preset.save",
    "portal.settings.save",
    "profile.update",
  ],
  headofdepartment: [
    "assignment.create",
    "assignment.update",
    "assignment.status.update",
    "assignment.grade",
    "quiz.create",
    "quiz.update",
    "quiz.status.update",
    "question.create",
    "quiz.questions.set",
    "quiz.review",
    "certificate.approve",
    "certificate.issue",
    "certificate.reject",
    "curriculum.module.create",
    "course.status.update",
    "message.send",
    "message.read",
    "quran.progress.update",
    "recitation.review",
    "course-run.create",
    "notification.read",
    "report.preset.save",
    "portal.settings.save",
    "profile.update",
  ],
  branchadmin: [
    "attendance.save",
    "calendar.create",
    "class.session.reschedule",
    "class.session.cancel",
    "message.send",
    "message.read",
    "payment.record",
    "room.create",
    "class.create",
    "class.update",
    "class.status.update",
    "room.status.update",
    "attendance.exception.review",
    "notification.read",
    "report.preset.save",
    "portal.settings.save",
    "profile.update",
  ],
  superadmin: [
    "staff.user.create",
    "lead.create",
    "application.create",
    "placement.create",
    "placement.result.record",
    "lead.convert",
    "student.create",
    "student.status.update",
    "student.document.add",
    "application.convert",
    "enrollment.activate",
    "enrollment.transfer",
    "enrollment.status.update",
    "payment.record",
    "user.create",
    "user.update",
    "permission.update",
    "branch.update",
    "integration.status.update",
    "integration.local_check",
    "system.health_check",
    "settings.save",
    "teacher.assign",
    "course.status.update",
    "room.create",
    "class.create",
    "course-run.create",
    "class.update",
    "class.status.update",
    "room.status.update",
    "attendance.exception.review",
    "class.session.reschedule",
    "class.session.cancel",
    "assignment.update",
    "assignment.status.update",
    "quiz.create",
    "quiz.update",
    "quiz.status.update",
    "question.create",
    "quiz.questions.set",
    "assignment.grade",
    "quiz.review",
    "message.send",
    "message.read",
    "notification.read",
    "report.preset.save",
    "profile.update",
    "audit.export",
  ],
} satisfies Record<Role, readonly PlatformWorkflowAction["type"][]>;

const actionPermissionRuleByType = {
  "lesson.start": SELF_SCOPED_ACTION,
  "lesson.complete": SELF_SCOPED_ACTION,
  "assignment.submit": SELF_SCOPED_ACTION,
  "quiz.submit": SELF_SCOPED_ACTION,
  "assignment.create": "assessments:write",
  "assignment.update": "assessments:write",
  "assignment.status.update": "assessments:write",
  "quiz.create": "assessments:write",
  "quiz.update": "assessments:write",
  "quiz.status.update": "assessments:write",
  "question.create": "assessments:write",
  "quiz.questions.set": "assessments:write",
  "assignment.grade": "assessments:write",
  "quiz.review": "assessments:write",
  "curriculum.module.create": "courses:write",
  "course.status.update": "courses:write",
  "material.publish.update": "courses:write",
  "certificate.approve": "certificates:approve",
  "certificate.issue": "certificates:approve",
  "certificate.reject": "certificates:approve",
  "teacher.assign": "teachers:write",
  "lead.create": "students:write",
  "application.create": "students:write",
  "placement.create": "students:write",
  "placement.result.record": "students:write",
  "lead.convert": "students:write",
  "application.convert": "students:write",
  "student.create": "students:write",
  "student.status.update": "students:write",
  "student.document.add": "students:write",
  "enrollment.activate": "students:write",
  "enrollment.transfer": "students:write",
  "enrollment.status.update": "students:write",
  "calendar.create": "schedule:write",
  "class.session.reschedule": "schedule:write",
  "class.session.cancel": "schedule:write",
  "room.create": "rooms:write",
  "class.create": "classes:write",
  "course-run.create": "courses:write",
  "class.update": "classes:write",
  "class.status.update": "classes:write",
  "room.status.update": "rooms:write",
  "attendance.save": "attendance:write",
  "attendance.exception.submit": SELF_SCOPED_ACTION,
  "attendance.exception.review": "attendance:write",
  "payment.record": "payments:write",
  "message.send": "messages:write",
  "message.read": SELF_SCOPED_ACTION,
  "report.preset.save": "reports:read",
  "staff.user.create": "settings:write",
  "user.create": "settings:write",
  "user.update": "settings:write",
  "permission.update": "settings:write",
  "settings.save": "settings:write",
  "portal.settings.save": "settings:write",
  "branch.update": "settings:write",
  "integration.status.update": "settings:write",
  "integration.local_check": "settings:write",
  "system.health_check": "settings:write",
  "quran.progress.update": "assessments:write",
  "recitation.review": "assessments:write",
  "recitation.submit": SELF_SCOPED_ACTION,
  "notification.read": SELF_SCOPED_ACTION,
  "profile.update": SELF_SCOPED_ACTION,
  "support.ticket.create": SELF_SCOPED_ACTION,
  "audit.export": "reports:read",
} satisfies Record<PlatformWorkflowAction["type"], ActionPermissionRule>;

export function roleCanRunPlatformAction(
  role: Role,
  actionType: PlatformWorkflowAction["type"]
) {
  const actions = platformActionTypesByRole[
    role
  ] as readonly PlatformWorkflowAction["type"][];
  return actions.includes(actionType);
}

export function requiredPermissionForPlatformAction(
  role: Role,
  action: PlatformWorkflowAction
): Permission | typeof SELF_SCOPED_ACTION | null {
  const rule = actionPermissionRuleByType[action.type];
  if (rule === SELF_SCOPED_ACTION) return rule;
  return rule;
}

export function validateDefaultPlatformCapabilityContract(): string[] {
  const issues: string[] = [];
  const roles = Object.keys(platformActionTypesByRole) as Role[];

  for (const role of roles) {
    const actions = platformActionTypesByRole[
      role
    ] as readonly PlatformWorkflowAction["type"][];
    const permissions = new Set(rolePermissions[role]);
    for (const actionType of actions) {
      const rule = actionPermissionRuleByType[actionType];
      if (rule === SELF_SCOPED_ACTION) continue;
      if (!permissions.has(rule)) {
        issues.push(`${role} can run ${actionType} but lacks ${rule}.`);
      }
    }
  }

  return issues;
}
