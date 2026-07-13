import type { FormPermission } from "../shared/nileForms.js";
import type {
  NileFormsCommandOperation,
  NileFormsQueryOperation,
} from "./nileFormsRepository.js";

export const formPermissionDatabaseMap = {
  "forms:read": "forms.read",
  "forms:write": "forms.write",
  "forms:publish": "forms.publish",
  "forms:assign": "forms.assign",
  "forms:respond": "forms.respond",
  "form_submissions:read": "form_submissions.read",
  "form_submissions:review": "form_submissions.review",
  "form_submissions:export": "form_submissions.export",
  "form_submissions:sensitive_read": "form_submissions.sensitive_read",
} as const satisfies Record<FormPermission, string>;

export const formQueryPermissionMap: Record<
  NileFormsQueryOperation,
  FormPermission
> = {
  "forms.definitions.list": "forms:read",
  "forms.definitions.get": "forms:read",
  "forms.management.options": "forms:write",
  "forms.assigned.list": "forms:read",
  "forms.assigned.get": "forms:read",
  "forms.submissions.own.get": "forms:read",
  "forms.drafts.load": "forms:respond",
  "forms.submissions.list": "form_submissions:read",
  "forms.submissions.get": "form_submissions:read",
  "forms.submissions.export": "form_submissions:export",
  "forms.offline.bundle.get": "forms:respond",
  "forms.migration.status": "forms:write",
  "forms.migration.runs.list": "forms:write",
};

export const formCommandPermissionMap: Record<
  NileFormsCommandOperation,
  FormPermission
> = {
  "forms.definitions.create": "forms:write",
  "forms.versions.draft.create": "forms:write",
  "forms.versions.draft.update": "forms:write",
  "forms.versions.publish": "forms:publish",
  "forms.publications.retire": "forms:publish",
  "forms.assignments.create": "forms:assign",
  "forms.assignments.revoke": "forms:assign",
  "forms.drafts.save": "forms:respond",
  "forms.submissions.submit": "forms:respond",
  "forms.submissions.withdraw": "forms:respond",
  "forms.submissions.review": "form_submissions:review",
  "forms.offline.devices.enroll": "forms:respond",
  "forms.offline.devices.revoke": "forms:respond",
  "forms.offline.bundle.issue": "forms:respond",
  "forms.offline.sync.item": "forms:respond",
  "forms.permissions.sensitive.grant": "forms:write",
  "forms.permissions.sensitive.revoke": "forms:write",
  "forms.migration.preview.record": "forms:write",
  "forms.migration.import.record": "forms:write",
  "forms.migration.reconcile": "forms:write",
};

export function databaseFormPermission(permission: FormPermission) {
  return formPermissionDatabaseMap[permission];
}

export function assertFormPermissionMappingIsOneToOne() {
  const entries = Object.entries(formPermissionDatabaseMap);
  const databaseCodes = new Set(entries.map(([, code]) => code));
  if (databaseCodes.size !== entries.length) {
    throw new Error("Nile Forms permission mapping must be one-to-one.");
  }
  for (const [applicationCode, databaseCode] of entries) {
    if (applicationCode.replace(":", ".") !== databaseCode) {
      throw new Error(
        `Nile Forms permission mapping is not canonical: ${applicationCode}.`
      );
    }
  }
}
