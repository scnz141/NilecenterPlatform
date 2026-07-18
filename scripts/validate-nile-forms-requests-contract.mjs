import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} is missing: ${expected}`);
  }
}

const domain = read("shared/nileRequests.ts");
const formsContract = read("shared/nileForms.ts");
const repository = read("server/nileFormsCompatibilityRepository.ts");
const service = read("server/nileRequestsService.ts");
const routes = read("server/nileRequestsRoutes.ts");
const app = read("client/src/App.tsx");
const rbac = read("client/src/lib/rbac.ts");
const review = read("client/src/pages/platform/NileFormsReviewDetailPage.tsx");
const listPage = read("client/src/pages/platform/NileRequestsListPage.tsx");
const detailPage = read("client/src/pages/platform/NileRequestDetailPage.tsx");
const createPage = read("client/src/pages/platform/NileRequestCreatePage.tsx");
const serviceTests = read(
  "client/src/lib/forms/server-nile-requests-service.test.ts"
);
const routeTests = read(
  "client/src/lib/forms/server-nile-requests-routes.test.ts"
);

for (const value of [
  '"open"',
  '"assigned"',
  '"in_progress"',
  '"resolved"',
  '"cancelled"',
]) {
  requireText(domain, value, `closed request status ${value}`);
}
for (const operation of [
  '"create_from_submission"',
  '"assign"',
  '"reprioritize"',
  '"start"',
  '"comment"',
  '"resolve"',
  '"cancel"',
]) {
  requireText(domain, operation, `typed request operation ${operation}`);
}
for (const lineage of [
  'sourceDefinitionId: "form_incident"',
  'sourceDefinitionKey: "branch_incident"',
  'sourceVersionId: "version_form_incident_1"',
]) {
  requireText(domain, lineage, `reviewed source lineage ${lineage}`);
}

requireText(
  formsContract,
  "requests: NileRequestsState",
  "Forms request state"
);
requireText(repository, 'readonly kind: "memory"', "memory runtime boundary");
requireText(
  repository,
  "createMemoryNileFormsCompatibilityRepository",
  "atomic compatibility repository"
);
requireText(
  service,
  "requireSession(sessionInput)",
  "server session authority"
);
requireText(service, "actorHasBranch", "branch scope authority");
requireText(service, "actorHasDepartment", "department scope authority");
requireText(service, "request_idempotency_conflict", "replay conflict denial");
requireText(service, "request_version_conflict", "optimistic conflict denial");
requireText(service, "request_terminal", "terminal request denial");
requireText(
  service,
  "state.requests.reassignments.push",
  "immutable reassignment history"
);
requireText(service, "state.requests.comments.push", "immutable comments");
requireText(service, "state.requests.activities.push", "immutable activity");
requireText(service, "request.created", "creation audit evidence");

for (const endpoint of [
  '"/api/requests"',
  '"/api/requests/from-submission/:submissionId"',
  '"/api/requests/:requestId"',
  '"/api/requests/:requestId/assign"',
  '"/api/requests/:requestId/reprioritize"',
  '"/api/requests/:requestId/start"',
  '"/api/requests/:requestId/comment"',
  '"/api/requests/:requestId/resolve"',
  '"/api/requests/:requestId/cancel"',
]) {
  requireText(routes, endpoint, `request API route ${endpoint}`);
}
requireText(
  routes,
  "requireNileFormsMutationRequest",
  "first-party mutation gate"
);

requireText(
  app,
  "/requests/from-submission/:submissionId",
  "request confirmation route"
);
requireText(app, "/requests/:requestId", "request detail route");
requireText(app, "/requests`", "request list route");
requireText(rbac, 'pageId === "requests"', "request page permission mapping");
requireText(review, "Continue to request", "review-to-request handoff");

for (const page of [listPage, detailPage, createPage]) {
  for (const locale of ['"en"', '"ar"', '"tr"']) {
    requireText(
      read("client/src/lib/requests/copy.ts"),
      locale,
      `request locale ${locale}`
    );
  }
  requireText(page, "PlatformShell", "dedicated request page owner");
}

for (const evidence of [
  "creates one request from exact immutable reviewed evidence",
  "complete scoped command loop with immutable history",
  "denies cross-scope, stale, conflicting, and malformed commands with no writes",
  "requester read, comment, and cancel",
]) {
  requireText(serviceTests, evidence, `request service evidence ${evidence}`);
}
for (const evidence of [
  "requires an authenticated server session",
  "without first-party origin evidence and writes nothing",
  "only scoped actors read",
  "typed optimistic conflicts",
]) {
  requireText(routeTests, evidence, `request route evidence ${evidence}`);
}

for (const excluded of [
  "MoodleClient",
  "payment provider",
  "WhatsApp",
  "webhook delivery",
]) {
  if (
    domain.includes(excluded) ||
    service.includes(excluded) ||
    routes.includes(excluded)
  ) {
    throw new Error(
      `Phase 14B request runtime includes excluded boundary: ${excluded}`
    );
  }
}

console.log(
  JSON.stringify(
    {
      result: "Nile Forms Phase 14B typed Requests contract passed",
      sourceProfile: "branch_incident@version_form_incident_1",
      operations: 7,
      locales: ["en", "ar", "tr"],
      runtimeDefault: "memory",
      normalizedActivation: false,
      externalProviders: false,
    },
    null,
    2
  )
);
