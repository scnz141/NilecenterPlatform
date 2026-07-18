import { getRequestSession, type ServerSession } from "./auth.js";
import { SessionRepositoryUnavailableError } from "./sessionRepository.js";
import {
  createNileRequestsService,
  type NileRequestsService,
} from "./nileRequestsService.js";
import { NileFormsError } from "./nileFormsService.js";
import {
  NileFormsRequestSecurityError,
  requireNileFormsMutationRequest,
} from "./nileFormsRequestSecurity.js";

type RequestApiRequest = {
  method: string;
  body?: Record<string, unknown>;
  query: Record<string, unknown>;
  params?: Record<string, string | undefined>;
  headers: { cookie?: string };
  get(name: string): string | undefined;
};

type RequestApiResponse = {
  status(code: number): RequestApiResponse;
  json(body: unknown): void;
};

type RequestApiHandler = (
  req: RequestApiRequest,
  res: RequestApiResponse
) => void | Promise<void>;

type RequestApiApp = {
  get(path: string, handler: RequestApiHandler): void;
  post(path: string, handler: RequestApiHandler): void;
};

type NileRequestsRouteDependencies = {
  service?: NileRequestsService;
  getSession?: (req: RequestApiRequest) => Promise<ServerSession | null>;
};

function routeParam(req: RequestApiRequest, name: string) {
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

function respondWithError(res: RequestApiResponse, error: unknown) {
  if (error instanceof NileFormsError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }
  if (error instanceof NileFormsRequestSecurityError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
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
  res.status(500).json({
    error: "Nile Requests could not complete the request.",
    code: "requests_internal_error",
  });
}

function handler(
  operation: (req: RequestApiRequest, res: RequestApiResponse) => Promise<void>
): RequestApiHandler {
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

export function registerNileRequestsRoutes(
  app: RequestApiApp,
  dependencies: NileRequestsRouteDependencies = {}
) {
  const service = dependencies.service ?? createNileRequestsService();
  const readSession = dependencies.getSession ?? getRequestSession;

  app.get(
    "/api/requests",
    handler(async (req, res) => {
      res.json(await service.listRequests(await readSession(req)));
    })
  );

  app.get(
    "/api/requests/from-submission/:submissionId",
    handler(async (req, res) => {
      res.json(
        await service.getCreationCandidate(
          await readSession(req),
          routeParam(req, "submissionId")
        )
      );
    })
  );

  app.post(
    "/api/requests/from-submission/:submissionId",
    handler(async (req, res) => {
      res
        .status(201)
        .json(
          await service.createFromReviewedSubmission(
            await readSession(req),
            routeParam(req, "submissionId"),
            req.body ?? {}
          )
        );
    })
  );

  app.get(
    "/api/requests/:requestId",
    handler(async (req, res) => {
      res.json(
        await service.getRequest(
          await readSession(req),
          routeParam(req, "requestId")
        )
      );
    })
  );

  const command = (
    operation: Exclude<
      keyof NileRequestsService,
      | "listRequests"
      | "getRequest"
      | "getCreationCandidate"
      | "createFromReviewedSubmission"
    >
  ) =>
    handler(async (req, res) => {
      res.json(
        await service[operation](
          await readSession(req),
          routeParam(req, "requestId"),
          req.body ?? {}
        )
      );
    });

  app.post("/api/requests/:requestId/assign", command("assign"));
  app.post("/api/requests/:requestId/reprioritize", command("reprioritize"));
  app.post("/api/requests/:requestId/start", command("start"));
  app.post("/api/requests/:requestId/comment", command("comment"));
  app.post("/api/requests/:requestId/resolve", command("resolve"));
  app.post("/api/requests/:requestId/cancel", command("cancel"));
}
