import {
  normalizeEmsBranches,
  normalizeEmsDepartments,
  normalizeEmsStaffUser,
  normalizeEmsStaffUsers,
  type EmsStagingBranch,
  type EmsStagingDepartment,
  type EmsStagingStaffUser,
} from "./emsStagingClient.js";
import {
  hasNccAuthCookie,
  nccStaffAuthEnabled,
  runNccRead,
  sendNccAuthError,
  type NccAuthDependencies,
  type RemoteResult,
} from "./nccAuthSession.js";

type DirectoryRequest = {
  headers: { cookie?: string };
  params?: Record<string, string>;
};

type DirectoryResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): DirectoryResponse;
  json(body: unknown): void;
};

type DirectoryApp = {
  get(
    path: string,
    handler: (
      request: DirectoryRequest,
      response: DirectoryResponse
    ) => void | Promise<void>
  ): void;
};

export function nccDirectoryReadsEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_DIRECTORY_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

async function handleDirectoryRead<T>(
  request: DirectoryRequest,
  response: DirectoryResponse,
  dependencies: NccAuthDependencies,
  operation: Parameters<typeof runNccRead>[2],
  normalize: (payload: unknown) => T | null,
  body: (value: T) => unknown
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Cookie");
  const env = dependencies.env ?? process.env;
  if (!nccDirectoryReadsEnabled(env)) {
    response
      .status(503)
      .json({ error: "NCC directory reads are not active." });
    return;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS directory is unavailable for this session." });
    return;
  }
  try {
    const result = normalize(
      await runNccRead(request, response, operation, dependencies)
    );
    if (!result) {
      response
        .status(502)
        .json({ error: "NCC EMS returned invalid directory data." });
      return;
    }
    response.json(body(result));
  } catch (error) {
    if (!sendNccAuthError(error, response)) throw error;
  }
}

export function registerNccDirectoryRoutes(
  app: DirectoryApp,
  dependencies: NccAuthDependencies = {}
) {
  app.get("/api/ncc/directory/users", (request, response) =>
    handleDirectoryRead<EmsStagingStaffUser[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> => api.users(token),
      normalizeEmsStaffUsers,
      items => ({ items })
    )
  );

  app.get("/api/ncc/directory/users/:userId", (request, response) =>
    handleDirectoryRead<EmsStagingStaffUser>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.user(token, request.params?.userId ?? ""),
      normalizeEmsStaffUser,
      user => ({ user })
    )
  );

  app.get("/api/ncc/directory/branches", (request, response) =>
    handleDirectoryRead<EmsStagingBranch[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> => api.branches(token),
      normalizeEmsBranches,
      items => ({ items })
    )
  );

  app.get("/api/ncc/directory/departments", (request, response) =>
    handleDirectoryRead<EmsStagingDepartment[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> => api.departments(token),
      normalizeEmsDepartments,
      items => ({ items })
    )
  );
}
