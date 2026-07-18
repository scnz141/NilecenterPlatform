export const nileRequestCategories = [
  "maintenance",
  "safety",
  "equipment",
  "other",
] as const;

export const nileRequestPriorities = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export const nileRequestStatuses = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "cancelled",
] as const;

export const nileRequestCommandOperations = [
  "create_from_submission",
  "assign",
  "reprioritize",
  "start",
  "comment",
  "resolve",
  "cancel",
] as const;

export type NileRequestCategory = (typeof nileRequestCategories)[number];
export type NileRequestPriority = (typeof nileRequestPriorities)[number];
export type NileRequestStatus = (typeof nileRequestStatuses)[number];
export type NileRequestCommandOperation =
  (typeof nileRequestCommandOperations)[number];

export type NileRequest = {
  id: string;
  requestNumber: string;
  requesterUserId: string;
  sourceSubmissionId: string;
  sourceDefinitionId: string;
  sourcePublicationId: string;
  sourceVersionId: string;
  branchId: string;
  departmentId?: string;
  category: NileRequestCategory;
  priority: NileRequestPriority;
  status: NileRequestStatus;
  assigneeUserId?: string;
  dueAt: string;
  location: string;
  summary: string;
  details: string;
  resolution?: string;
  cancellationReason?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  resolvedAt?: string;
  cancelledAt?: string;
};

export type NileRequestComment = {
  id: string;
  requestId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
};

export type NileRequestActivityType =
  | "created"
  | "assigned"
  | "reprioritized"
  | "started"
  | "commented"
  | "resolved"
  | "cancelled";

export type NileRequestActivity = {
  id: string;
  requestId: string;
  actorUserId: string;
  type: NileRequestActivityType;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type NileRequestReassignment = {
  id: string;
  requestId: string;
  previousAssigneeUserId?: string;
  nextAssigneeUserId: string;
  actorUserId: string;
  reason: string;
  createdAt: string;
};

export type NileRequestCommandResult = {
  request: NileRequest;
  comment?: NileRequestComment;
  activity: NileRequestActivity;
  reassignment?: NileRequestReassignment;
};

export type NileRequestCommandReceipt = {
  id: string;
  idempotencyKey: string;
  fingerprint: string;
  operation: NileRequestCommandOperation;
  requestId: string;
  actorUserId: string;
  result: NileRequestCommandResult;
  createdAt: string;
};

export type NileRequestProcessingProfile = {
  id: string;
  sourceDefinitionId: string;
  sourceDefinitionKey: string;
  sourceVersionId: string;
  category: "branch_incident";
  fieldMap: {
    location: string;
    category: string;
    severity: string;
    details: string;
  };
};

export const branchIncidentRequestProfile = {
  id: "request_profile_branch_incident_v1",
  sourceDefinitionId: "form_incident",
  sourceDefinitionKey: "branch_incident",
  sourceVersionId: "version_form_incident_1",
  category: "branch_incident",
  fieldMap: {
    location: "location",
    category: "issue_type",
    severity: "severity",
    details: "details",
  },
} as const satisfies NileRequestProcessingProfile;

export type NileRequestsState = {
  requests: NileRequest[];
  comments: NileRequestComment[];
  activities: NileRequestActivity[];
  reassignments: NileRequestReassignment[];
  commandReceipts: NileRequestCommandReceipt[];
};

export function createNileRequestsSeedState(): NileRequestsState {
  return {
    requests: [],
    comments: [],
    activities: [],
    reassignments: [],
    commandReceipts: [],
  };
}
