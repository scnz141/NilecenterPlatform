import { getRequestSession, type ServerSession } from "./auth.js";
import { SessionRepositoryUnavailableError } from "./sessionRepository.js";
import {
  createNileFormsService,
  NileFormsError,
  type NileFormsService,
} from "./nileFormsService.js";
import type { FormAssignmentTarget } from "../shared/nileForms.js";
import {
  createNileFormsMigrationService,
  type NileFormsMigrationService,
} from "./nileFormsMigrationService.js";
import {
  nileFormsPublicClientEvidence,
  NileFormsRequestSecurityError,
  requireNileFormsMutationRequest,
} from "./nileFormsRequestSecurity.js";
import {
  NileFormsRepositoryAuthorityError,
  NileFormsRepositoryConflictError,
  NileFormsRepositoryInputError,
  NileFormsRepositoryRateLimitError,
  NileFormsRepositoryUnavailableError,
} from "./nileFormsRepository.js";

type FormApiRequest = {
  method: string;
  body?: Record<string, unknown>;
  query: Record<string, unknown>;
  params?: Record<string, string | undefined>;
  headers: { cookie?: string };
  ip?: string;
  socket?: { remoteAddress?: string };
  get(name: string): string | undefined;
};

type FormApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): FormApiResponse;
  json(body: unknown): void;
};

type FormApiHandler = (
  req: FormApiRequest,
  res: FormApiResponse
) => void | Promise<void>;

type FormApiApp = {
  get(path: string, handler: FormApiHandler): void;
  post(path: string, handler: FormApiHandler): void;
};

type NileFormsRouteDependencies = {
  service?: NileFormsService;
  migrationService?: NileFormsMigrationService;
  getSession?: (req: FormApiRequest) => Promise<ServerSession | null>;
};

const publicSubmissionBuckets = new Map<
  string,
  { count: number; resetAt: number }
>();
const publicSubmissionWindowMs = 10 * 60 * 1000;
const publicSubmissionLimit = 12;
const publicSubmissionBucketLimit = 5_000;

function publicClientKeys(req: FormApiRequest) {
  const evidence = nileFormsPublicClientEvidence(req);
  return [evidence.active.ipHmac, evidence.previous?.ipHmac].filter(
    (value): value is string => Boolean(value)
  );
}

function prunePublicSubmissionBuckets(now: number) {
  for (const [key, bucket] of Array.from(publicSubmissionBuckets.entries())) {
    if (bucket.resetAt <= now) publicSubmissionBuckets.delete(key);
  }
  while (publicSubmissionBuckets.size >= publicSubmissionBucketLimit) {
    const oldestKey = publicSubmissionBuckets.keys().next().value as
      | string
      | undefined;
    if (!oldestKey) break;
    publicSubmissionBuckets.delete(oldestKey);
  }
}

function consumePublicSubmissionAttempt(req: FormApiRequest) {
  const now = Date.now();
  if (publicSubmissionBuckets.size >= publicSubmissionBucketLimit) {
    prunePublicSubmissionBuckets(now);
  }
  const keys = publicClientKeys(req);
  const buckets = keys
    .map(key => publicSubmissionBuckets.get(key))
    .filter((bucket): bucket is { count: number; resetAt: number } =>
      Boolean(bucket && bucket.resetAt > now)
    );
  const count = buckets.reduce(
    (maximum, bucket) => Math.max(maximum, bucket.count),
    0
  );
  if (count >= publicSubmissionLimit) return false;
  const resetAt = buckets.reduce(
    (maximum, bucket) => Math.max(maximum, bucket.resetAt),
    now + publicSubmissionWindowMs
  );
  for (const key of keys) {
    publicSubmissionBuckets.set(key, { count: count + 1, resetAt });
  }
  return true;
}

function routeParam(req: FormApiRequest, name: string) {
  const value = req.params?.[name]?.trim();
  if (!value) {
    throw new NileFormsError(
      `Missing ${name}.`,
      400,
      "route_parameter_missing"
    );
  }
  return value;
}

function parseAssignmentTarget(value: unknown): FormAssignmentTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NileFormsError(
      "A valid assignment target is required.",
      400,
      "assignment_invalid"
    );
  }
  const input = value as Record<string, unknown>;
  const type = typeof input.type === "string" ? input.type : "";
  const stringValue = (key: string) =>
    typeof input[key] === "string" ? input[key].trim() : "";
  switch (type) {
    case "user": {
      const userId = stringValue("userId");
      if (userId) return { type, userId };
      break;
    }
    case "role": {
      const role = stringValue("role");
      if (
        [
          "student",
          "teacher",
          "registrar",
          "headofdepartment",
          "branchadmin",
          "superadmin",
        ].includes(role)
      ) {
        return {
          type,
          role: role as Extract<FormAssignmentTarget, { type: "role" }>["role"],
        };
      }
      break;
    }
    case "branch": {
      const branchId = stringValue("branchId");
      if (branchId) return { type, branchId };
      break;
    }
    case "department": {
      const departmentId = stringValue("departmentId");
      if (departmentId) return { type, departmentId };
      break;
    }
    case "course": {
      const courseId = stringValue("courseId");
      if (courseId) return { type, courseId };
      break;
    }
    case "class": {
      const classId = stringValue("classId");
      if (classId) return { type, classId };
      break;
    }
  }
  throw new NileFormsError(
    "A valid assignment target is required.",
    400,
    "assignment_invalid"
  );
}

function respondWithError(res: FormApiResponse, error: unknown) {
  if (error instanceof NileFormsError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }
  if (error instanceof SessionRepositoryUnavailableError) {
    res.status(503).json({
      error: "Session service is temporarily unavailable.",
      code: "session_unavailable",
    });
    return;
  }
  if (
    error instanceof NileFormsRequestSecurityError ||
    error instanceof NileFormsRepositoryAuthorityError ||
    error instanceof NileFormsRepositoryConflictError ||
    error instanceof NileFormsRepositoryInputError ||
    error instanceof NileFormsRepositoryRateLimitError ||
    error instanceof NileFormsRepositoryUnavailableError
  ) {
    const statusCode =
      error instanceof NileFormsRequestSecurityError
        ? error.statusCode
        : error instanceof NileFormsRepositoryAuthorityError
          ? 403
          : error instanceof NileFormsRepositoryConflictError
            ? 409
            : error instanceof NileFormsRepositoryInputError
              ? 400
              : error instanceof NileFormsRepositoryRateLimitError
                ? 429
                : 503;
    res.status(statusCode).json({
      error: error.message,
      code: error.code,
    });
    return;
  }
  res.status(500).json({
    error: "Nile Forms could not complete the request.",
    code: "forms_internal_error",
  });
}

function handler(
  operation: (req: FormApiRequest, res: FormApiResponse) => Promise<void>
): FormApiHandler {
  return async (req, res) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        requireNileFormsMutationRequest(req);
      }
      await operation(req, res);
    } catch (error) {
      respondWithError(res, error);
    }
  };
}

export function registerNileFormsRoutes(
  app: FormApiApp,
  dependencies: NileFormsRouteDependencies = {}
) {
  const service = dependencies.service ?? createNileFormsService();
  const migrationService =
    dependencies.migrationService ?? createNileFormsMigrationService();
  const readSession = dependencies.getSession ?? getRequestSession;

  app.get(
    "/api/forms/definitions",
    handler(async (req, res) => {
      res.json(await service.listDefinitions(await readSession(req)));
    })
  );

  app.get(
    "/api/forms/management-options",
    handler(async (req, res) => {
      res.json(await service.getManagementOptions(await readSession(req)));
    })
  );

  app.post(
    "/api/forms/definitions",
    handler(async (req, res) => {
      const result = await service.createDefinition(
        await readSession(req),
        req.body ?? {}
      );
      res.status(201).json(result);
    })
  );

  app.get(
    "/api/forms/definitions/:formId",
    handler(async (req, res) => {
      res.json(
        await service.getDefinition(
          await readSession(req),
          routeParam(req, "formId")
        )
      );
    })
  );

  app.post(
    "/api/forms/definitions/:formId/draft",
    handler(async (req, res) => {
      res
        .status(201)
        .json(
          await service.createDraftVersion(
            await readSession(req),
            routeParam(req, "formId")
          )
        );
    })
  );

  app.post(
    "/api/forms/definitions/:formId/versions/:versionId",
    handler(async (req, res) => {
      const body = req.body ?? {};
      res.json(
        await service.updateDraftVersion(
          await readSession(req),
          routeParam(req, "formId"),
          routeParam(req, "versionId"),
          { expectedRevision: body.expectedRevision, content: body.content }
        )
      );
    })
  );

  app.post(
    "/api/forms/definitions/:formId/versions/:versionId/publish",
    handler(async (req, res) => {
      res
        .status(201)
        .json(
          await service.publishVersion(
            await readSession(req),
            routeParam(req, "formId"),
            routeParam(req, "versionId"),
            req.body ?? {}
          )
        );
    })
  );

  app.post(
    "/api/forms/publications/:publicationId/retire",
    handler(async (req, res) => {
      res.json(
        await service.retirePublication(
          await readSession(req),
          routeParam(req, "publicationId")
        )
      );
    })
  );

  app.post(
    "/api/forms/publications/:publicationId/assignments",
    handler(async (req, res) => {
      const body = req.body ?? {};
      res
        .status(201)
        .json(
          await service.assignPublication(
            await readSession(req),
            routeParam(req, "publicationId"),
            parseAssignmentTarget(body.target),
            typeof body.expiresAt === "string" ? body.expiresAt : undefined
          )
        );
    })
  );

  app.post(
    "/api/forms/assignments/:assignmentId/revoke",
    handler(async (req, res) => {
      res.json(
        await service.revokeAssignment(
          await readSession(req),
          routeParam(req, "assignmentId")
        )
      );
    })
  );

  app.get(
    "/api/forms/assigned",
    handler(async (req, res) => {
      res.json(await service.listAssigned(await readSession(req)));
    })
  );

  app.get(
    "/api/forms/assigned/:publicationId",
    handler(async (req, res) => {
      res.json(
        await service.getAssignedForm(
          await readSession(req),
          routeParam(req, "publicationId")
        )
      );
    })
  );

  app.get(
    "/api/forms/assigned/:publicationId/submissions/:submissionId",
    handler(async (req, res) => {
      res.json(
        await service.getOwnSubmission(
          await readSession(req),
          routeParam(req, "publicationId"),
          routeParam(req, "submissionId")
        )
      );
    })
  );

  app.get(
    "/api/forms/assigned/:publicationId/draft",
    handler(async (req, res) => {
      res.json(
        await service.loadDraft({
          publicationId: routeParam(req, "publicationId"),
          session: await readSession(req),
        })
      );
    })
  );

  app.post(
    "/api/forms/offline/devices",
    handler(async (req, res) => {
      const result = await service.enrollOfflineDevice(
        await readSession(req),
        req.body?.label
      );
      res.status(201).json(result);
    })
  );

  app.post(
    "/api/forms/offline/devices/:deviceId/revoke",
    handler(async (req, res) => {
      res.json(
        await service.revokeOfflineDevice(
          await readSession(req),
          routeParam(req, "deviceId")
        )
      );
    })
  );

  app.post(
    "/api/forms/offline/bundle",
    handler(async (req, res) => {
      const body = req.body ?? {};
      res.json(
        await service.getOfflineBundle(
          await readSession(req),
          body.deviceId,
          body.deviceToken
        )
      );
    })
  );

  app.post(
    "/api/forms/offline/sync",
    handler(async (req, res) => {
      const body = req.body ?? {};
      res.json(
        await service.syncOfflineBatch(
          await readSession(req),
          body.deviceId,
          body.deviceToken,
          body.items
        )
      );
    })
  );

  app.get(
    "/api/forms/migration/jotform/status",
    handler(async (req, res) => {
      res.json(await migrationService.getStatus(await readSession(req)));
    })
  );

  app.get(
    "/api/forms/migration/jotform/forms",
    handler(async (req, res) => {
      res.json(await migrationService.listRemoteForms(await readSession(req)));
    })
  );

  app.get(
    "/api/forms/migration/jotform/runs",
    handler(async (req, res) => {
      res.json(await migrationService.listRuns(await readSession(req)));
    })
  );

  app.post(
    "/api/forms/migration/jotform/inspect",
    handler(async (req, res) => {
      res.json(
        await migrationService.inspect(await readSession(req), req.body ?? {})
      );
    })
  );

  app.post(
    "/api/forms/migration/jotform/preview",
    handler(async (req, res) => {
      res
        .status(201)
        .json(
          await migrationService.preview(await readSession(req), req.body ?? {})
        );
    })
  );

  app.post(
    "/api/forms/migration/jotform/import",
    handler(async (req, res) => {
      res.json(
        await migrationService.commit(await readSession(req), req.body ?? {})
      );
    })
  );

  app.post(
    "/api/forms/migration/jotform/records/:recordId/reconcile",
    handler(async (req, res) => {
      res.json(
        await migrationService.reconcile(
          await readSession(req),
          routeParam(req, "recordId"),
          req.body ?? {}
        )
      );
    })
  );

  app.post(
    "/api/forms/assigned/:publicationId/draft",
    handler(async (req, res) => {
      const body = req.body ?? {};
      res.json(
        await service.saveDraft({
          publicationId: routeParam(req, "publicationId"),
          answers: body.answers,
          expectedRevision: body.expectedRevision,
          session: await readSession(req),
        })
      );
    })
  );

  app.post(
    "/api/forms/assigned/:publicationId/submit",
    handler(async (req, res) => {
      const body = req.body ?? {};
      const result = await service.submit({
        publicationId: routeParam(req, "publicationId"),
        answers: body.answers,
        clientSubmissionId: body.clientSubmissionId,
        clientSubmittedAt: body.clientSubmittedAt,
        session: await readSession(req),
      });
      res.status(result.replayed ? 200 : 201).json(result);
    })
  );

  app.post(
    "/api/forms/submissions/:submissionId/withdraw",
    handler(async (req, res) => {
      res.json(
        await service.withdrawSubmission(
          await readSession(req),
          routeParam(req, "submissionId"),
          req.body?.expectedRevision
        )
      );
    })
  );

  app.get(
    "/api/forms/submissions/export",
    handler(async (req, res) => {
      res.json(await service.exportSubmissions(await readSession(req)));
    })
  );

  app.get(
    "/api/forms/submissions",
    handler(async (req, res) => {
      res.json(await service.listSubmissions(await readSession(req)));
    })
  );

  app.get(
    "/api/forms/submissions/:submissionId",
    handler(async (req, res) => {
      res.json(
        await service.getSubmission(
          await readSession(req),
          routeParam(req, "submissionId")
        )
      );
    })
  );

  app.post(
    "/api/forms/submissions/:submissionId/review",
    handler(async (req, res) => {
      res.json(
        await service.reviewSubmission(
          await readSession(req),
          routeParam(req, "submissionId"),
          req.body ?? {}
        )
      );
    })
  );

  app.post(
    "/api/forms/submissions/:submissionId/promote",
    handler(async (req, res) => {
      res.json(
        await service.promoteSubmission(
          await readSession(req),
          routeParam(req, "submissionId"),
          req.body ?? {}
        )
      );
    })
  );

  app.get(
    "/api/forms/public/:slug",
    handler(async (req, res) => {
      res.json(await service.getPublicForm(routeParam(req, "slug")));
    })
  );

  app.post(
    "/api/forms/public/:slug/draft/load",
    handler(async (req, res) => {
      const form = await service.getPublicForm(routeParam(req, "slug"));
      res.json(
        await service.loadDraft({
          publicationId: form.publication.id,
          draftToken: req.get("X-Nile-Forms-Draft-Token"),
        })
      );
    })
  );

  app.post(
    "/api/forms/public/:slug/draft",
    handler(async (req, res) => {
      if (!consumePublicSubmissionAttempt(req)) {
        res.status(429).json({
          error: "Too many public form requests. Try again later.",
          code: "rate_limited",
        });
        return;
      }
      const body = req.body ?? {};
      const form = await service.getPublicForm(routeParam(req, "slug"));
      res.json(
        await service.saveDraft({
          publicationId: form.publication.id,
          answers: body.answers,
          expectedRevision: body.expectedRevision,
          draftToken: req.get("X-Nile-Forms-Draft-Token"),
        })
      );
    })
  );

  app.post(
    "/api/forms/public/:slug/submit",
    handler(async (req, res) => {
      if (!consumePublicSubmissionAttempt(req)) {
        res.status(429).json({
          error: "Too many public form requests. Try again later.",
          code: "rate_limited",
        });
        return;
      }
      const body = req.body ?? {};
      const form = await service.getPublicForm(routeParam(req, "slug"));
      const result = await service.submit({
        publicationId: form.publication.id,
        answers: body.answers,
        clientSubmissionId: body.clientSubmissionId,
        clientSubmittedAt: body.clientSubmittedAt,
        draftToken: req.get("X-Nile-Forms-Draft-Token"),
      });
      res.status(result.replayed ? 200 : 201).json(result);
    })
  );
}

export function resetNileFormsRateLimitsForTests() {
  publicSubmissionBuckets.clear();
}
