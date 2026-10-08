import {
  isEmsStagingRole,
  mapLocalRoleToEms,
  normalizeEmsBranch,
  normalizeEmsBranches,
  normalizeEmsBranchStatistics,
  normalizeEmsCustomFieldDefinitions,
  normalizeEmsDepartment,
  normalizeEmsDepartments,
  normalizeEmsHourCellPatch,
  normalizeEmsHourCellRange,
  normalizeEmsStaffUser,
  normalizeEmsStaffUsers,
  normalizeEmsUserCourseIds,
  normalizeEmsUserStatistics,
  type EmsStagingBranch,
  type EmsStagingBranchStatistics,
  type EmsStagingCustomFieldDefinition,
  type EmsStagingDepartment,
  type EmsStagingHourCellOp,
  type EmsStagingHourCellRange,
  type EmsStagingRole,
  type EmsStagingStaffUser,
  type EmsStagingUserStatistics,
} from "./emsStagingClient.js";
import {
  hasNccAuthCookie,
  nccMoodleAccountWritesEnabled,
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
  query?: Record<string, unknown>;
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
  put?(path: string, handler: DirectoryHandler): void;
};

export function nccDirectoryReadsEnabled(env: NodeJS.ProcessEnv = process.env) {
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

/** Accepts the EMS role strings used by the unified staff app and the
 *  legacy local role names used by the compatibility admin pages. */
function resolveAssignedRole(value: unknown): EmsStagingRole | null {
  if (typeof value !== "string") return null;
  if (isEmsStagingRole(value)) return value;
  return mapLocalRoleToEms(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(item => typeof item === "string" && item.length > 0)
  );
}

function isRangeDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  );
}

function hourCellOpsBody(
  value: unknown
): EmsStagingHourCellOp[] | null {
  if (!isPlainObject(value) || !hasOnlyKeys(value, ["ops"])) return null;
  if (!Array.isArray(value.ops) || value.ops.length > 24 * 62) return null;
  const ops: EmsStagingHourCellOp[] = [];
  for (const item of value.ops) {
    if (!isPlainObject(item) || !hasOnlyKeys(item, ["date", "hour", "status"])) {
      return null;
    }
    if (
      !isRangeDate(item.date) ||
      typeof item.hour !== "number" ||
      !Number.isSafeInteger(item.hour) ||
      item.hour < 0 ||
      item.hour > 23 ||
      (item.status !== null &&
        item.status !== "available" &&
        item.status !== "unavailable")
    ) {
      return null;
    }
    ops.push({ date: item.date, hour: item.hour, status: item.status });
  }
  return ops;
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
  const optionalKeys = [
    "phone",
    "address",
    "nationality",
    "dateOfBirth",
    "notes",
  ] as const;
  if (
    !isPlainObject(value) ||
    !hasOnlyKeys(value, ["firstName", "lastName", ...optionalKeys]) ||
    typeof value.firstName !== "string" ||
    !value.firstName.trim() ||
    typeof value.lastName !== "string" ||
    !value.lastName.trim() ||
    optionalKeys.some(
      key =>
        value[key] !== undefined &&
        value[key] !== null &&
        typeof value[key] !== "string"
    )
  ) {
    return null;
  }
  const upstream: Record<string, unknown> = {
    first_name: value.firstName.trim(),
    last_name: value.lastName.trim(),
  };
  const keyMap: Record<(typeof optionalKeys)[number], string> = {
    phone: "phone",
    address: "address",
    nationality: "nationality",
    dateOfBirth: "date_of_birth",
    notes: "notes",
  };
  for (const key of optionalKeys) {
    if (value[key] !== undefined) upstream[keyMap[key]] = value[key];
  }
  return upstream;
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

function prepareMoodleAccountWrite(
  request: DirectoryRequest,
  response: DirectoryResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  const env = dependencies.env ?? process.env;
  if (!nccMoodleAccountWritesEnabled(env)) {
    response
      .status(503)
      .json({ error: "NCC Moodle account operations are not active." });
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

function moodleBindBody(body: unknown) {
  if (
    !isPlainObject(body) ||
    !hasOnlyKeys(body, ["mode", "moodleUserId"]) ||
    (body.mode !== "create" && body.mode !== "link")
  ) {
    return null;
  }
  if (body.mode === "create") {
    return body.moodleUserId === undefined ? { mode: "create" as const } : null;
  }
  if (
    !Number.isSafeInteger(body.moodleUserId) ||
    (body.moodleUserId as number) < 1
  ) {
    return null;
  }
  return {
    mode: "link" as const,
    moodleUserId: body.moodleUserId as number,
  };
}

function moodleBindUpstream(
  bind: NonNullable<ReturnType<typeof moodleBindBody>>
) {
  return bind.mode === "link"
    ? { mode: "link", moodle_user_id: bind.moodleUserId }
    : { mode: "create" };
}

function generatedMoodlePassword(
  payload: Record<string, unknown>,
  required: boolean
) {
  const generated = payload.generated_moodle_password;
  if (generated === undefined || generated === null) {
    return required ? null : { password: null };
  }
  if (typeof generated !== "string" || !generated) {
    return null;
  }
  return { password: generated };
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
    response.status(503).json({ error: "NCC directory reads are not active." });
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

  app.get("/api/ncc/directory/users/:userId/statistics", (request, response) =>
    handleDirectoryRead<EmsStagingUserStatistics>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.userStatistics(token, request.params?.userId ?? ""),
      normalizeEmsUserStatistics,
      statistics => ({ statistics })
    )
  );

  app.get("/api/ncc/directory/users/:userId/courses", (request, response) =>
    handleDirectoryRead<string[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.userCourses(token, request.params?.userId ?? ""),
      normalizeEmsUserCourseIds,
      courseIds => ({ courseIds })
    )
  );

  app.get("/api/ncc/directory/users/:userId/hour-cells", (request, response) => {
    const query = request.query ?? {};
    if (Object.keys(query).some(key => !["from", "to"].includes(key))) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    const { from, to } = query;
    if (!isRangeDate(from) || !isRangeDate(to) || from > to) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    const spanDays =
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000;
    if (spanDays > 62) {
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    return handleDirectoryRead<EmsStagingHourCellRange>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.userHourCells(token, request.params?.userId ?? "", from, to),
      normalizeEmsHourCellRange,
      range => ({ range })
    );
  });

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

  app.get("/api/ncc/directory/branches/:branchId", (request, response) =>
    handleDirectoryRead<EmsStagingBranch>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.branch(token, request.params?.branchId ?? ""),
      normalizeEmsBranch,
      branch => ({ branch })
    )
  );

  app.get(
    "/api/ncc/directory/branches/:branchId/statistics",
    (request, response) =>
      handleDirectoryRead<EmsStagingBranchStatistics>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.branchStatistics(token, request.params?.branchId ?? ""),
        normalizeEmsBranchStatistics,
        statistics => ({ statistics })
      )
  );

  const catalogBody = (
    body: unknown,
    keys: string[],
    requireName: boolean
  ): Record<string, unknown> | null => {
    if (!isPlainObject(body) || !hasOnlyKeys(body, keys)) return null;
    const upstream: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) return null;
      upstream.name = body.name.trim();
    } else if (requireName) {
      return null;
    }
    if (body.code !== undefined) {
      if (body.code !== null && typeof body.code !== "string") return null;
      upstream.code = body.code === null ? null : body.code;
    }
    if (body.timezone !== undefined) {
      if (typeof body.timezone !== "string" || !body.timezone.trim())
        return null;
      upstream.timezone = body.timezone.trim();
    }
    if (body.isOnline !== undefined) {
      if (typeof body.isOnline !== "boolean") return null;
      upstream.is_online = body.isOnline;
    }
    if (body.sortOrder !== undefined) {
      if (
        !Number.isSafeInteger(body.sortOrder) ||
        (body.sortOrder as number) < -9999 ||
        (body.sortOrder as number) > 9999
      ) {
        return null;
      }
      upstream.sort_order = body.sortOrder;
    }
    if (body.customFields !== undefined) {
      if (!validCustomFields(body.customFields)) return null;
      upstream.custom_fields = body.customFields;
    }
    return upstream;
  };

  const BRANCH_BODY_KEYS = [
    "name",
    "code",
    "timezone",
    "isOnline",
    "sortOrder",
    "customFields",
  ];
  const DEPARTMENT_BODY_KEYS = ["name", "code", "customFields"];

  app.post("/api/ncc/directory/branches", async (request, response) => {
    if (!prepareDirectoryWrite(request, response, dependencies)) return;
    const upstream = catalogBody(request.body, BRANCH_BODY_KEYS, true);
    if (!upstream) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    try {
      const payload = await runNccWrite(
        request,
        response,
        (api, token) => api.createBranch(token, upstream),
        dependencies
      );
      const branch = normalizeEmsBranch(payload);
      if (!branch) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid directory data." });
        return;
      }
      response.json({ branch });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.patch?.(
    "/api/ncc/directory/branches/:branchId",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      const upstream = catalogBody(request.body, BRANCH_BODY_KEYS, false);
      if (!upstream) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.patchBranch(
              token,
              request.params?.branchId ?? "",
              upstream
            ),
          dependencies
        );
        const branch = normalizeEmsBranch(payload);
        if (!branch) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({ branch });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post(
    "/api/ncc/directory/branches/:branchId/disable",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["reasonId"]) ||
        typeof body.reasonId !== "string" ||
        !body.reasonId
      ) {
        response.status(400).json({ error: "Reason is required." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.disableBranch(
              token,
              request.params?.branchId ?? "",
              body.reasonId as string
            ),
          dependencies
        );
        const branch = normalizeEmsBranch(payload);
        if (!branch) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({ branch });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post(
    "/api/ncc/directory/branches/:branchId/enable",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      if (
        request.body !== undefined &&
        request.body !== null &&
        (!isPlainObject(request.body) ||
          Object.keys(request.body).length > 0)
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.enableBranch(token, request.params?.branchId ?? ""),
          dependencies
        );
        const branch = normalizeEmsBranch(payload);
        if (!branch) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({ branch });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post("/api/ncc/directory/departments", async (request, response) => {
    if (!prepareDirectoryWrite(request, response, dependencies)) return;
    const upstream = catalogBody(request.body, DEPARTMENT_BODY_KEYS, true);
    if (!upstream) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    try {
      const payload = await runNccWrite(
        request,
        response,
        (api, token) => api.createDepartment(token, upstream),
        dependencies
      );
      const department = normalizeEmsDepartment(payload);
      if (!department) {
        response
          .status(502)
          .json({ error: "NCC EMS returned invalid directory data." });
        return;
      }
      response.json({ department });
    } catch (error) {
      if (!sendNccAuthError(error, response)) throw error;
    }
  });

  app.patch?.(
    "/api/ncc/directory/departments/:departmentId",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      const upstream = catalogBody(request.body, DEPARTMENT_BODY_KEYS, false);
      if (!upstream) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.patchDepartment(
              token,
              request.params?.departmentId ?? "",
              upstream
            ),
          dependencies
        );
        const department = normalizeEmsDepartment(payload);
        if (!department) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({ department });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post(
    "/api/ncc/directory/departments/:departmentId/disable",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["reasonId"]) ||
        typeof body.reasonId !== "string" ||
        !body.reasonId
      ) {
        response.status(400).json({ error: "Reason is required." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.disableDepartment(
              token,
              request.params?.departmentId ?? "",
              body.reasonId as string
            ),
          dependencies
        );
        const department = normalizeEmsDepartment(payload);
        if (!department) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({ department });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post(
    "/api/ncc/directory/departments/:departmentId/enable",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      if (
        request.body !== undefined &&
        request.body !== null &&
        (!isPlainObject(request.body) ||
          Object.keys(request.body).length > 0)
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.enableDepartment(
              token,
              request.params?.departmentId ?? ""
            ),
          dependencies
        );
        const department = normalizeEmsDepartment(payload);
        if (!department) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({ department });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
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
        "courseIds",
        "canTakePlacementTest",
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
    const assignedRole = resolveAssignedRole(body.role);
    if (!assignedRole) {
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
    if (body.courseIds !== undefined && !isStringArray(body.courseIds)) {
      response.status(400).json({ error: "Course access is invalid." });
      return;
    }
    if (
      body.canTakePlacementTest !== undefined &&
      typeof body.canTakePlacementTest !== "boolean"
    ) {
      response
        .status(400)
        .json({ error: "Placement test capability is invalid." });
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
    const scopes =
      assignedRole === "super_admin"
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
      ...(assignedRole === "hod" && body.departmentIds
        ? { departments: body.departmentIds }
        : {}),
      ...(body.courseIds ? { course_ids: body.courseIds } : {}),
      ...(body.canTakePlacementTest !== undefined
        ? { can_take_placement_test: body.canTakePlacementTest }
        : {}),
      ...(body.customFields && Object.keys(body.customFields).length
        ? { custom_fields: body.customFields }
        : {}),
      ...(body.callerPassword ? { caller_password: body.callerPassword } : {}),
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

  app.patch?.("/api/ncc/directory/users/:userId", async (request, response) => {
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
        "courseIds",
        "canTakePlacementTest",
        "customFields",
        "callerPassword",
      ])
    ) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    const upstreamBody: Record<string, unknown> = {};
    let patchRole: EmsStagingRole | null = null;
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !body.email.trim()) {
        response.status(400).json({ error: "Email is required." });
        return;
      }
      upstreamBody.email = body.email.trim();
    }
    if (body.role !== undefined) {
      patchRole = resolveAssignedRole(body.role);
      if (!patchRole) {
        response.status(400).json({ error: "Role is required." });
        return;
      }
      upstreamBody.assigned_role = patchRole;
      if (patchRole === "super_admin") {
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
      if (patchRole !== "super_admin") {
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
    if (body.courseIds !== undefined) {
      if (!isStringArray(body.courseIds)) {
        response.status(400).json({ error: "Course access is invalid." });
        return;
      }
      upstreamBody.course_ids = body.courseIds;
    }
    if (body.canTakePlacementTest !== undefined) {
      if (typeof body.canTakePlacementTest !== "boolean") {
        response
          .status(400)
          .json({ error: "Placement test capability is invalid." });
        return;
      }
      upstreamBody.can_take_placement_test = body.canTakePlacementTest;
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
          api.patchUser(token, request.params?.userId ?? "", upstreamBody),
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
  });

  const lifecycle =
    (action: "disable" | "enable" | "cancel-invitation") =>
    async (request: DirectoryRequest, response: DirectoryResponse) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      let reasonId: string | undefined;
      if (action === "disable") {
        const body = request.body;
        if (body !== undefined && !isPlainObject(body)) {
          response.status(400).json({ error: "Request body is invalid." });
          return;
        }
        if (
          !body ||
          !hasOnlyKeys(body, ["reasonId"]) ||
          (body.reasonId !== undefined &&
            (typeof body.reasonId !== "string" || !body.reasonId))
        ) {
          response.status(400).json({ error: "Request body is invalid." });
          return;
        }
        reasonId =
          typeof body?.reasonId === "string" ? body.reasonId : undefined;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            action === "disable"
              ? api.disableUser(
                  token,
                  request.params?.userId ?? "",
                  reasonId
                )
              : action === "enable"
                ? api.enableUser(token, request.params?.userId ?? "")
                : api.cancelUserInvitation(token, request.params?.userId ?? ""),
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

  app.put?.(
    "/api/ncc/directory/users/:userId/courses",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["courseIds"]) ||
        !isStringArray(body.courseIds)
      ) {
        response.status(400).json({ error: "Course access is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.putUserCourses(
              token,
              request.params?.userId ?? "",
              body.courseIds as string[]
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

  app.patch?.(
    "/api/ncc/directory/users/:userId/hour-cells",
    async (request, response) => {
      if (!prepareDirectoryWrite(request, response, dependencies)) return;
      const ops = hourCellOpsBody(request.body);
      if (!ops) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.patchUserHourCells(
              token,
              request.params?.userId ?? "",
              ops
            ),
          dependencies
        );
        const result = normalizeEmsHourCellPatch(payload);
        if (!result) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json(result);
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post("/api/ncc/directory/users/:userId/disable", lifecycle("disable"));
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
    "/api/ncc/directory/users/:userId/moodle",
    async (request, response) => {
      if (!prepareMoodleAccountWrite(request, response, dependencies)) return;
      const bind = moodleBindBody(request.body);
      if (!bind) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.bindUserMoodle(
              token,
              request.params?.userId ?? "",
              moodleBindUpstream(bind)
            ),
          dependencies
        );
        if (!isPlainObject(payload)) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        const user = normalizeEmsStaffUser(payload);
        const generated = generatedMoodlePassword(
          payload,
          bind.mode === "create"
        );
        if (!user || !generated) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({
          user,
          oneTime: {
            generatedMoodlePassword:
              bind.mode === "create" ? generated.password : null,
          },
        });
      } catch (error) {
        if (!sendNccAuthError(error, response)) throw error;
      }
    }
  );

  app.post(
    "/api/ncc/directory/users/:userId/moodle/password",
    async (request, response) => {
      if (!prepareMoodleAccountWrite(request, response, dependencies)) return;
      try {
        const payload = await runNccWrite(
          request,
          response,
          (api, token) =>
            api.resetUserMoodlePassword(token, request.params?.userId ?? ""),
          dependencies
        );
        const generated =
          isPlainObject(payload) &&
          generatedMoodlePassword(payload, true);
        if (!generated || !generated.password) {
          response
            .status(502)
            .json({ error: "NCC EMS returned invalid directory data." });
          return;
        }
        response.json({
          oneTime: { generatedMoodlePassword: generated.password },
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
