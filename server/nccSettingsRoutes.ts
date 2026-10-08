import {
  EMS_ACTION_REASON_KINDS,
  normalizeEmsActionReason,
  normalizeEmsActionReasonImportResult,
  normalizeEmsActionReasons,
  normalizeEmsAreaOfStudy,
  normalizeEmsAreasOfStudy,
  normalizeEmsCustomFieldRow,
  normalizeEmsCustomFieldRows,
  normalizeEmsLostReason,
  normalizeEmsLostReasons,
  type EmsStagingActionReason,
  type EmsStagingActionReasonImportResult,
  type EmsStagingActionReasonKind,
  type EmsStagingAreaOfStudy,
  type EmsStagingCustomFieldDefinition,
  type EmsStagingLostReason,
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

type SettingsRequest = {
  headers: { cookie?: string };
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

type SettingsResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): SettingsResponse;
  json(body: unknown): void;
};

type SettingsHandler = (
  request: SettingsRequest,
  response: SettingsResponse
) => void | Promise<void>;

type SettingsApp = {
  get(path: string, handler: SettingsHandler): void;
  post(path: string, handler: SettingsHandler): void;
  patch?(path: string, handler: SettingsHandler): void;
};

export function nccSettingsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return ["1", "true"].includes(
    (env.NILE_NCC_SETTINGS_ENABLED ?? "").trim().toLowerCase()
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

function emptyBody(body: unknown) {
  return (
    body === undefined ||
    body === null ||
    (isPlainObject(body) && Object.keys(body).length === 0)
  );
}

function optionalNonBlank(value: unknown) {
  return value === undefined || (typeof value === "string" && !!value.trim());
}

function optionalInt(value: unknown) {
  return value === undefined || Number.isSafeInteger(value);
}

function optionalBool(value: unknown) {
  return value === undefined || typeof value === "boolean";
}

function optionalStringArray(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(item => typeof item === "string" && item.length > 0))
  );
}

function optionalIntArray(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(item => Number.isSafeInteger(item) && (item as number) > 0))
  );
}

function reasonIdBody(body: unknown): string | null {
  if (
    !isPlainObject(body) ||
    !hasOnlyKeys(body, ["reasonId"]) ||
    typeof body.reasonId !== "string" ||
    !body.reasonId
  ) {
    return null;
  }
  return body.reasonId;
}

function prepareSettingsWrite(
  request: SettingsRequest,
  response: SettingsResponse,
  dependencies: NccAuthDependencies
) {
  response.setHeader("Cache-Control", "private, no-store");
  const env = dependencies.env ?? process.env;
  if (!nccSettingsEnabled(env)) {
    response.status(503).json({ error: "NCC settings are not active." });
    return false;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS settings are unavailable for this session." });
    return false;
  }
  return true;
}

async function handleSettingsRead<T>(
  request: SettingsRequest,
  response: SettingsResponse,
  dependencies: NccAuthDependencies,
  operation: Parameters<typeof runNccRead>[2],
  normalize: (payload: unknown) => T | null,
  body: (value: T) => unknown
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Cookie");
  const env = dependencies.env ?? process.env;
  if (!nccSettingsEnabled(env)) {
    response.status(503).json({ error: "NCC settings are not active." });
    return;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS settings are unavailable for this session." });
    return;
  }
  try {
    const result = normalize(
      await runNccRead(request, response, operation, dependencies)
    );
    if (!result) {
      response
        .status(502)
        .json({ error: "NCC EMS returned invalid settings data." });
      return;
    }
    response.json(body(result));
  } catch (error) {
    if (!sendNccAuthError(error, response)) throw error;
  }
}

async function handleSettingsWrite<T>(
  request: SettingsRequest,
  response: SettingsResponse,
  dependencies: NccAuthDependencies,
  operation: Parameters<typeof runNccWrite>[2],
  normalize: (payload: unknown) => T | null,
  body: (value: T) => unknown
) {
  if (!prepareSettingsWrite(request, response, dependencies)) return;
  try {
    const result = normalize(
      await runNccWrite(request, response, operation, dependencies)
    );
    if (!result) {
      response
        .status(502)
        .json({ error: "NCC EMS returned invalid settings data." });
      return;
    }
    response.json(body(result));
  } catch (error) {
    if (!sendNccAuthError(error, response)) throw error;
  }
}

function activeOnlyQuery(request: SettingsRequest): boolean | null {
  const raw = request.query?.activeOnly;
  if (raw === undefined) return false;
  if (raw === "true" || raw === true) return true;
  if (raw === "false" || raw === false) return false;
  return null;
}

export function registerNccSettingsRoutes(
  app: SettingsApp,
  dependencies: NccAuthDependencies = {}
) {
  /* ---- lost reasons ---- */

  app.get("/api/ncc/settings/lost-reasons", (request, response) => {
    const activeOnly = activeOnlyQuery(request);
    if (activeOnly === null) {
      response.setHeader("Cache-Control", "private, no-store");
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    return handleSettingsRead<EmsStagingLostReason[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.lostReasons(token, activeOnly),
      normalizeEmsLostReasons,
      items => ({ items })
    );
  });

  app.post("/api/ncc/settings/lost-reasons", async (request, response) => {
    if (!prepareSettingsWrite(request, response, dependencies)) return;
    const body = request.body;
    if (
      !isPlainObject(body) ||
      !hasOnlyKeys(body, ["name", "sortOrder"]) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      !optionalInt(body.sortOrder)
    ) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    await handleSettingsWrite<EmsStagingLostReason>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.createLostReason(token, {
          name: (body.name as string).trim(),
          ...(body.sortOrder !== undefined
            ? { sort_order: body.sortOrder }
            : {}),
        }),
      normalizeEmsLostReason,
      reason => ({ reason })
    );
  });

  app.patch?.(
    "/api/ncc/settings/lost-reasons/:reasonId",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["name", "sortOrder"]) ||
        !optionalNonBlank(body.name) ||
        !optionalInt(body.sortOrder)
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
      if (body.name !== undefined)
        upstream.name = (body.name as string).trim();
      if (body.sortOrder !== undefined) upstream.sort_order = body.sortOrder;
      await handleSettingsWrite<EmsStagingLostReason>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.patchLostReason(token, request.params?.reasonId ?? "", upstream),
        normalizeEmsLostReason,
        reason => ({ reason })
      );
    }
  );

  app.post(
    "/api/ncc/settings/lost-reasons/:reasonId/disable",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      if (!emptyBody(request.body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      await handleSettingsWrite<EmsStagingLostReason>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.disableLostReason(token, request.params?.reasonId ?? ""),
        normalizeEmsLostReason,
        reason => ({ reason })
      );
    }
  );

  app.post(
    "/api/ncc/settings/lost-reasons/:reasonId/enable",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      if (!emptyBody(request.body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      await handleSettingsWrite<EmsStagingLostReason>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.enableLostReason(token, request.params?.reasonId ?? ""),
        normalizeEmsLostReason,
        reason => ({ reason })
      );
    }
  );

  /* ---- action reasons ---- */

  app.get("/api/ncc/settings/action-reasons", (request, response) => {
    const kind = request.query?.kind;
    if (
      kind !== undefined &&
      !EMS_ACTION_REASON_KINDS.includes(kind as EmsStagingActionReasonKind)
    ) {
      response.setHeader("Cache-Control", "private, no-store");
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    const activeOnly = activeOnlyQuery(request);
    if (activeOnly === null) {
      response.setHeader("Cache-Control", "private, no-store");
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    return handleSettingsRead<EmsStagingActionReason[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.actionReasons(
          token,
          kind as EmsStagingActionReasonKind | undefined,
          activeOnly
        ),
      normalizeEmsActionReasons,
      items => ({ items })
    );
  });

  app.post("/api/ncc/settings/action-reasons", async (request, response) => {
    if (!prepareSettingsWrite(request, response, dependencies)) return;
    const body = request.body;
    if (
      !isPlainObject(body) ||
      !hasOnlyKeys(body, ["kind", "name", "sortOrder"]) ||
      !EMS_ACTION_REASON_KINDS.includes(
        body.kind as EmsStagingActionReasonKind
      ) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      !optionalInt(body.sortOrder)
    ) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    await handleSettingsWrite<EmsStagingActionReason>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.createActionReason(token, {
          kind: body.kind,
          name: (body.name as string).trim(),
          ...(body.sortOrder !== undefined
            ? { sort_order: body.sortOrder }
            : {}),
        }),
      normalizeEmsActionReason,
      reason => ({ reason })
    );
  });

  app.post(
    "/api/ncc/settings/action-reasons/import",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["csv", "overwrite"]) ||
        typeof body.csv !== "string" ||
        !body.csv.trim() ||
        !optionalBool(body.overwrite)
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      await handleSettingsWrite<EmsStagingActionReasonImportResult>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.importActionReasons(token, {
            csv: body.csv,
            overwrite: body.overwrite === true,
          }),
        normalizeEmsActionReasonImportResult,
        result => ({ result })
      );
    }
  );

  app.patch?.(
    "/api/ncc/settings/action-reasons/:reasonId",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["name", "sortOrder"]) ||
        !optionalNonBlank(body.name) ||
        !optionalInt(body.sortOrder)
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
      if (body.name !== undefined)
        upstream.name = (body.name as string).trim();
      if (body.sortOrder !== undefined) upstream.sort_order = body.sortOrder;
      await handleSettingsWrite<EmsStagingActionReason>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.patchActionReason(
            token,
            request.params?.reasonId ?? "",
            upstream
          ),
        normalizeEmsActionReason,
        reason => ({ reason })
      );
    }
  );

  app.post(
    "/api/ncc/settings/action-reasons/:reasonId/disable",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      if (!emptyBody(request.body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      await handleSettingsWrite<EmsStagingActionReason>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.disableActionReason(token, request.params?.reasonId ?? ""),
        normalizeEmsActionReason,
        reason => ({ reason })
      );
    }
  );

  app.post(
    "/api/ncc/settings/action-reasons/:reasonId/enable",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      if (!emptyBody(request.body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      await handleSettingsWrite<EmsStagingActionReason>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.enableActionReason(token, request.params?.reasonId ?? ""),
        normalizeEmsActionReason,
        reason => ({ reason })
      );
    }
  );

  /* ---- areas of study ---- */

  app.get("/api/ncc/settings/areas-of-study", (request, response) => {
    const activeOnly = activeOnlyQuery(request);
    if (activeOnly === null) {
      response.setHeader("Cache-Control", "private, no-store");
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    return handleSettingsRead<EmsStagingAreaOfStudy[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.areasOfStudy(token, activeOnly),
      normalizeEmsAreasOfStudy,
      items => ({ items })
    );
  });

  const areaBody = (body: unknown, requireName: boolean) => {
    if (
      !isPlainObject(body) ||
      !hasOnlyKeys(body, ["name", "sortOrder", "placementCourseIds"]) ||
      (requireName
        ? typeof body.name !== "string" || !body.name.trim()
        : !optionalNonBlank(body.name)) ||
      !optionalInt(body.sortOrder) ||
      !optionalIntArray(body.placementCourseIds)
    ) {
      return null;
    }
    const upstream: Record<string, unknown> = {};
    if (body.name !== undefined) upstream.name = (body.name as string).trim();
    if (body.sortOrder !== undefined) upstream.sort_order = body.sortOrder;
    if (body.placementCourseIds !== undefined) {
      upstream.placement_test_courses = (
        body.placementCourseIds as number[]
      ).map(id => ({ moodle_course_id: id }));
    }
    return upstream;
  };

  app.post("/api/ncc/settings/areas-of-study", async (request, response) => {
    if (!prepareSettingsWrite(request, response, dependencies)) return;
    const upstream = areaBody(request.body, true);
    if (!upstream) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    await handleSettingsWrite<EmsStagingAreaOfStudy>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.createAreaOfStudy(token, upstream),
      normalizeEmsAreaOfStudy,
      area => ({ area })
    );
  });

  app.patch?.(
    "/api/ncc/settings/areas-of-study/:areaId",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const upstream = areaBody(request.body, false);
      if (!upstream) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      await handleSettingsWrite<EmsStagingAreaOfStudy>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.patchAreaOfStudy(token, request.params?.areaId ?? "", upstream),
        normalizeEmsAreaOfStudy,
        area => ({ area })
      );
    }
  );

  app.post(
    "/api/ncc/settings/areas-of-study/:areaId/disable",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const reasonId = reasonIdBody(request.body);
      if (!reasonId) {
        response.status(400).json({ error: "Reason is required." });
        return;
      }
      await handleSettingsWrite<EmsStagingAreaOfStudy>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.disableAreaOfStudy(
            token,
            request.params?.areaId ?? "",
            reasonId
          ),
        normalizeEmsAreaOfStudy,
        area => ({ area })
      );
    }
  );

  app.post(
    "/api/ncc/settings/areas-of-study/:areaId/enable",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      if (!emptyBody(request.body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      await handleSettingsWrite<EmsStagingAreaOfStudy>(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.enableAreaOfStudy(token, request.params?.areaId ?? ""),
        normalizeEmsAreaOfStudy,
        area => ({ area })
      );
    }
  );

  /* ---- custom fields ---- */

  app.get("/api/ncc/settings/custom-fields", (request, response) => {
    const entityType = request.query?.entityType;
    const isActive = request.query?.isActive;
    if (
      (entityType !== undefined && typeof entityType !== "string") ||
      (isActive !== undefined &&
        isActive !== "true" &&
        isActive !== "false")
    ) {
      response.setHeader("Cache-Control", "private, no-store");
      response.status(400).json({ error: "Request query is invalid." });
      return;
    }
    return handleSettingsRead<EmsStagingCustomFieldDefinition[]>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.customFieldDefinitions(
          token,
          typeof entityType === "string" && entityType ? entityType : undefined,
          isActive === undefined ? undefined : isActive === "true"
        ),
      normalizeEmsCustomFieldRows,
      items => ({ items })
    );
  });

  const FIELD_TYPES = [
    "text",
    "textarea",
    "number",
    "date",
    "boolean",
    "select",
  ];

  app.post("/api/ncc/settings/custom-fields", async (request, response) => {
    if (!prepareSettingsWrite(request, response, dependencies)) return;
    const body = request.body;
    if (
      !isPlainObject(body) ||
      !hasOnlyKeys(body, [
        "entityType",
        "fieldKey",
        "label",
        "fieldType",
        "isRequired",
        "options",
        "helpText",
      ]) ||
      typeof body.entityType !== "string" ||
      !body.entityType.trim() ||
      typeof body.fieldKey !== "string" ||
      !body.fieldKey.trim() ||
      typeof body.label !== "string" ||
      !body.label.trim() ||
      !FIELD_TYPES.includes(body.fieldType as string) ||
      !optionalBool(body.isRequired) ||
      !optionalStringArray(body.options) ||
      (body.helpText !== undefined &&
        body.helpText !== null &&
        typeof body.helpText !== "string")
    ) {
      response.status(400).json({ error: "Request body is invalid." });
      return;
    }
    await handleSettingsWrite<EmsStagingCustomFieldDefinition>(
      request,
      response,
      dependencies,
      (api, token): Promise<RemoteResult> =>
        api.createCustomField(token, {
          entity_type: (body.entityType as string).trim(),
          field_key: (body.fieldKey as string).trim(),
          label: (body.label as string).trim(),
          field_type: body.fieldType,
          ...(body.isRequired !== undefined
            ? { is_required: body.isRequired }
            : {}),
          ...(body.options !== undefined
            ? { options_json: body.options }
            : {}),
          ...(body.helpText !== undefined
            ? { help_text: body.helpText }
            : {}),
        }),
      normalizeEmsCustomFieldRow,
      field => ({ field })
    );
  });

  app.patch?.(
    "/api/ncc/settings/custom-fields/:fieldId",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const body = request.body;
      if (
        !isPlainObject(body) ||
        !hasOnlyKeys(body, ["label", "isRequired", "options", "helpText"]) ||
        (body.label !== undefined &&
          (typeof body.label !== "string" || !body.label.trim())) ||
        !optionalBool(body.isRequired) ||
        (body.options !== undefined &&
          body.options !== null &&
          !optionalStringArray(body.options)) ||
        (body.helpText !== undefined &&
          body.helpText !== null &&
          typeof body.helpText !== "string")
      ) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      const upstream: Record<string, unknown> = {};
      if (body.label !== undefined)
        upstream.label = (body.label as string).trim();
      if (body.isRequired !== undefined)
        upstream.is_required = body.isRequired;
      if (body.options !== undefined) upstream.options_json = body.options;
      if (body.helpText !== undefined) upstream.help_text = body.helpText;
      await handleSettingsWrite(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.patchCustomField(
            token,
            request.params?.fieldId ?? "",
            upstream
          ),
        normalizeEmsCustomFieldRow,
        field => ({ field })
      );
    }
  );

  app.post(
    "/api/ncc/settings/custom-fields/:fieldId/disable",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      const reasonId = reasonIdBody(request.body);
      if (!reasonId) {
        response.status(400).json({ error: "Reason is required." });
        return;
      }
      await handleSettingsWrite(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.disableCustomField(
            token,
            request.params?.fieldId ?? "",
            reasonId
          ),
        normalizeEmsCustomFieldRow,
        field => ({ field })
      );
    }
  );

  app.post(
    "/api/ncc/settings/custom-fields/:fieldId/enable",
    async (request, response) => {
      if (!prepareSettingsWrite(request, response, dependencies)) return;
      if (!emptyBody(request.body)) {
        response.status(400).json({ error: "Request body is invalid." });
        return;
      }
      await handleSettingsWrite(
        request,
        response,
        dependencies,
        (api, token): Promise<RemoteResult> =>
          api.enableCustomField(token, request.params?.fieldId ?? ""),
        normalizeEmsCustomFieldRow,
        field => ({ field })
      );
    }
  );
}
