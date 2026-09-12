import {
  normalizeEmsBranches,
  mapLocalRoleToEms,
  normalizeEmsCustomFieldDefinitions,
  normalizeEmsDepartments,
  normalizeEmsStaffUser,
  normalizeEmsStaffUsers,
  type EmsStagingBranch,
  type EmsStagingCustomFieldDefinition,
  type EmsStagingDepartment,
  type EmsStagingLocalRole,
  type EmsStagingStaffUser,
} from "./emsStagingClient.js";
import {
  hasNccAuthCookie,
  nccStaffAuthEnabled,
  runNccRead,
  runNccWrite,
  sendNccAuthError,
  type NccAuthDependencies,
  type RemoteResult,
} from "./nccAuthSession.js";

type DirectoryRequest = {
  headers: { cookie?: string };
  params?: Record<string, string>;
  body?: Record<string, unknown>;
};

type DirectoryResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): DirectoryResponse;
  json(body: unknown): void;
};

type DirectoryHandler = (
  request: DirectoryRequest,
  response: DirectoryResponse
) => void | Promise<void>;

type DirectoryApp = {
  get(path: string, handler: DirectoryHandler): void;
  post(path: string, handler: DirectoryHandler): void;
  patch?(path: string, handler: DirectoryHandler): void;
};

export function nccDirectoryReadsEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_DIRECTORY_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccDirectoryWritesEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_DIRECTORY_WRITES_ENABLED ?? "").trim().toLowerCase()
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]) {
  return Object.keys(record).every(key => keys.includes(key));
}

function isLocalRole(value: unknown): value is EmsStagingLocalRole {
  return [
    "superadmin",
    "branchadmin",
    "headofdepartment",
    "registrar",
    "teacher",
  ].includes(String(value));
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(item => typeof item === "string" && item.length > 0)
  );
}

function validCustomFields(value: unknown) {
  return (
    isPlainObject(value) &&
    Object.values(value).every(
      item =>
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
    )
  );
}

function profileBody(value: unknown) {
  if (
    !isPlainObject(value) ||
    !hasOnlyKeys(value, ["firstName", "lastName", "phone"]) ||
    typeof value.firstName !== "string" ||
    !value.firstName.trim() ||
    typeof value.lastName !== "string" ||
    !value.lastName.trim() ||
    (value.phone !== undefined &&
      value.phone !== null &&
      typeof value.phone !== "string")
  ) {
    return null;
  }
  return {
    first_name: value.firstName.trim(),
    last_name: value.lastName.trim(),
    ...(value.phone !== undefined ? { phone: value.phone } : {}),
  };
}

function invitationOneTime(payload: Record<string, unknown>) {
  const rawUrl = payload.invitation_url;
  if (typeof rawUrl !== "string") {
    return { invitationPath: null, invitationUrlUnparseable: true };
  }
  try {
    const token = new URL(rawUrl).searchParams.get("token");
    if (!token) throw new Error("Invitation token missing.");
    return {
      invitationPath: `/auth/accept-invitation?token=${encodeURIComponent(token)}`,
      invitationUrlUnparseable: false,
    };
  } catch {
    return { invitationPath: null, invitationUrlUnparseable: true };
  }
}

function prepareDirectoryWrite(
  request: DirectoryRequest,
  response: DirectoryResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  const env = dependencies.env ?? process.env;
  if (!nccDirectoryWritesEnabled(env)) {
    response
      .status(503)
      .json({ error: "NCC directory writes are not active." });
    return false;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS directory is unavailable for this session." });
    return false;
  }
  return true;
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

  app.get("/api/ncc/directory/custom-fields", (request, response) =>
    handleDirectoryRead<EmsStagingCustomFieldDefinition[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> => api.customFields(token),
      normalizeEmsCustomFieldDefinitions,
      items => ({ items })
    )
  );

  app.post("/api/ncc/directory/users", async (request, response) => {
    if (!prepareDirectoryWrite(request, response, dependencies)) return;
    const body = request.body;
    if (
      !isPlainObject(body) ||
      !hasOnlyKeys(body, [
        "email",
        "role",
        "provisioning",
        "profile",
        "branchIds",
        "departmentIds",
        "customFields",
        "callerPassword",
      ])
    ) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    if (typeof body.email !== "string" || !body.email.trim()) {
      response.status(400).json({ error: "Email is required." });
      return;
    }
    if (!isLocalRole(body.role)) {
      response.status(400).json({ error: "Role is required." });
      return;
    }
    if (body.provisioning !== "invitation" && body.provisioning !== "manual") {
      response.status(400).json({ error: "Provisioning is required." });
      return;
    }
    const profile = profileBody(body.profile);
    if (!profile) {
      response.status(400).json({ error: "First name is required." });
      return;
    }
    if (body.branchIds !== undefined && !isStringArray(body.branchIds)) {
      response.status(400).json({ error: "Branch access is required." });
      return;
    }
    if (
      body.departmentIds !== undefined &&
      !isStringArray(body.departmentIds)
    ) {
      response.status(400).json({ error: "Department access is required." });
      return;
    }
    if (
      body.customFields !== undefined &&
      !validCustomFields(body.customFields)
    ) {
      response.status(400).json({ error: "Custom fields are invalid." });
      return;
    }
    if (
      body.callerPassword !== undefined &&
      typeof body.callerPassword !== "string"
    ) {
      response.status(400).json({ error: "Current password is required." });
      return;
    }
    const assignedRole = mapLocalRoleToEms(body.role);
    if (!assignedRole) {
      response.status(400).json({ error: "Role is required." });
      return;
    }
    const scopes =
      body.role === "superadmin"
        ? [{ scope_type: "global" }]
        : (body.branchIds ?? []).map(branchId => ({
            scope_type: "branch",
            scope_id: branchId,
          }));
    const upstreamBody: Record<string, unknown> = {
      email: body.email.trim(),
      assigned_role: assignedRole,
      provisioning: body.provisioning,
      profile,
      scopes,
      ...(body.role === "headofdepartment" && body.departmentIds
        ? { departments: body.departmentIds }
        : {}),
      ...(body.customFields && Object.keys(body.customFields).length
        ? { custom_fields: body.customFields }
        : {}),
      ...(body.callerPassword
        ? { caller_password: body.callerPassword }
        : {}),
    };
    try {
      const payload = await runNccWrite(
        request,
        response,
        (api, token) => api.createUser(token, upstreamBody),
        dependencies
      );
      if (!isPlainObject(payload)) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid directory data." });
        return;
      }
      const user = normalizeEmsStaffUser(payload);
      const generatedPassword = payload.generated_password;
      if (
        !user ||
        (generatedPassword !== undefined &&
          generatedPassword !== null &&
          typeof generatedPassword !== "string")
      ) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid directory data." });
        return;
      }
      response.json({
        user,
        oneTime: {
          generatedPassword:
            typeof generatedPassword === "string" ? generatedPassword : null,
          ...invitationOneTime(payload),
        },
      });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.patch?.(
    "/api/ncc/directory/users/:userId",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, [
          "email",
          "role",
          "profile",
          "branchIds",
          "departmentIds",
          "customFields",
          "callerPassword",
        ])
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstreamBody: Record<string, unknown> = {};
      if (body.email !== undefined) {
        if (typeof body.email !== "string" || !body.email.trim()) {
          response.status(400).json({ error: "Email is required." });
          return;
        }
        upstreamBody.email = body.email.trim();
      }
      if (body.role !== undefined) {
        if (!isLocalRole(body.role)) {
          response.status(400).json({ error: "Role is required." });
          return;
        }
        upstreamBody.assigned_role = mapLocalRoleToEms(body.role);
        if (body.role === "superadmin") {
          upstreamBody.scopes = [{ scope_type: "global" }];
        }
      }
      if (body.profile !== undefined) {
        const profile = profileBody(body.profile);
        if (!profile) {
          response.status(400).json({ error: "First name is required." });
          return;
        }
        upstreamBody.profile = profile;
      }
      if (body.branchIds !== undefined) {
        if (!isStringArray(body.branchIds)) {
          response.status(400).json({ error: "Branch access is required." });
          return;
        }
        if (body.role !== "superadmin") {
          upstreamBody.scopes = body.branchIds.map(branchId => ({
            scope_type: "branch",
            scope_id: branchId,
          }));
        }
      }
      if (body.departmentIds !== undefined) {
        if (!isStringArray(body.departmentIds)) {
          response.status(400).json({ error: "Department access is required." });
          return;
        }
        upstreamBody.departments = body.departmentIds;
      }
      if (body.customFields !== undefined) {
        if (!validCustomFields(body.customFields)) {
          response.status(400).json({ error: "Custom fields are invalid." });
          return;
        }
        upstreamBody.custom_fields = body.customFields;
      }
      if (body.callerPassword !== undefined) {
        if (typeof body.callerPassword !== "string") {
          response.status(400).json({ error: "Current password is required." });
          return;
        }
        upstreamBody.caller_password = body.callerPassword;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.patchUser(
              token,
              request.params?.userId ?? "",
              upstreamBody
            ),
          dependencies
        );
        const user = normalizeEmsStaffUser(payload);
        if (!user) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({ user });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  const lifecycle = (
    action: "disable" | "enable" | "cancel-invitation"
  ) => async (request: DirectoryRequest, response: DirectoryResponse) => {
    if (!prepareDirectoryWrite(request, response, dependencies)) return;
    try {
      const payload = await runNccWrite(
        request,
        response,
        (api, token) =>
          action === "disable"
            ? api.disableUser(token, request.params?.userId ?? "")
            : action === "enable"
              ? api.enableUser(token, request.params?.userId ?? "")
              : api.cancelUserInvitation(
                  token,
                  request.params?.userId ?? ""
                ),
        dependencies
      );
      const user = normalizeEmsStaffUser(payload);
      if (!user) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid directory data." });
        return;
      }
      response.json({ user });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  };

  app.post(
    "/api/ncc/directory/users/:userId/disable",
    lifecycle("disable")
  );
  app.post("/api/ncc/directory/users/:userId/enable", lifecycle("enable"));
  app.post(
    "/api/ncc/directory/users/:userId/cancel-invitation",
    lifecycle("cancel-invitation")
  );

  app.post(
    "/api/ncc/directory/users/:userId/password",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      const body = request.body ?? {};
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["callerPassword"]) ||
        (body.callerPassword !== undefined &&
          typeof body.callerPassword !== "string")
      ) {
        response.status(400).json({ error: "Current password is required." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.resetUserPassword(
              token,
              request.params?.userId ?? "",
              body.callerPassword
                ? { caller_password: body.callerPassword }
                : {}
            ),
          dependencies
        );
        if (
          !isPlainObject(payload) ||
          typeof payload.generated_password !== "string" ||
          !payload.generated_password
        ) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({
          oneTime: { generatedPassword: payload.generated_password },
        });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post(
    "/api/ncc/directory/users/:userId/invite",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) => api.inviteUser(token, request.params?.userId ?? ""),
          dependencies
        );
        if (!isPlainObject(payload)) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({ oneTime: invitationOneTime(payload) });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );
}
