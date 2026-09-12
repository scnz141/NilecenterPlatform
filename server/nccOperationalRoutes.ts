import {
  normalizeEmsClass,
  normalizeEmsClasses,
  normalizeEmsLead,
  normalizeEmsLeads,
  normalizeEmsPlacementTest,
  normalizeEmsPlacementTests,
  normalizeEmsRooms,
  normalizeEmsStudent,
  normalizeEmsStudentEnrolments,
  normalizeEmsStudents,
  normalizeEmsTeacherWorkspace,
  type EmsStagingClass,
  type EmsStagingLead,
  type EmsStagingPlacementTest,
  type EmsStagingRoom,
  type EmsStagingStudent,
  type EmsStagingStudentEnrolment,
  type EmsStagingTeacherWorkspace,
} from "./emsStagingClient.js";
import {
  hasNccAuthCookie,
  nccStaffAuthEnabled,
  runNccRead,
  sendNccAuthError,
  type NccAuthDependencies,
} from "./nccAuthSession.js";

type OperationalRequest = {
  headers: { cookie?: string };
  params?: Record<string, string>;
};

type OperationalResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): OperationalResponse;
  json(body: unknown): void;
};

type OperationalApp = {
  get(
    path: string,
    handler: (
      request: OperationalRequest,
      response: OperationalResponse
    ) => void | Promise<void>
  ): void;
};

type OperationalFamily = "admissions" | "delivery";

export function nccAdmissionsReadsEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_ADMISSIONS_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

export function nccDeliveryReadsEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return ["1", "true"].includes(
    (env.NILE_NCC_DELIVERY_READS_ENABLED ?? "").trim().toLowerCase()
  );
}

async function handleOperationalRead<T>(
  request: OperationalRequest,
  response: OperationalResponse,
  dependencies: NccAuthDependencies,
  family: OperationalFamily,
  operation: Parameters<typeof runNccRead>[2],
  normalize: (payload: unknown) => T | null,
  body: (value: T) => unknown
) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Cookie");
  const env = dependencies.env ?? process.env;
  const enabled =
    family === "admissions"
      ? nccAdmissionsReadsEnabled(env)
      : nccDeliveryReadsEnabled(env);
  if (!enabled) {
    response
      .status(503)
      .json({ error: `NCC ${family} reads are not active.` });
    return;
  }
  if (!nccStaffAuthEnabled(env) || !hasNccAuthCookie(request)) {
    response
      .status(404)
      .json({ error: "EMS data is unavailable for this session." });
    return;
  }
  try {
    const result = normalize(
      await runNccRead(request, response, operation, dependencies)
    );
    if (!result) {
      response
        .status(502)
        .json({ error: `NCC EMS returned invalid ${family} data.` });
      return;
    }
    response.json(body(result));
  } catch (error) {
    if (!sendNccAuthError(error, response)) throw error;
  }
}

export function registerNccOperationalRoutes(
  app: OperationalApp,
  dependencies: NccAuthDependencies = {}
) {
  app.get("/api/ncc/admissions/students", (request, response) =>
    handleOperationalRead<EmsStagingStudent[]>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.students(token),
      normalizeEmsStudents,
      items => ({ items })
    )
  );
  app.get("/api/ncc/admissions/students/:studentId", (request, response) =>
    handleOperationalRead<EmsStagingStudent>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.student(token, request.params?.studentId ?? ""),
      normalizeEmsStudent,
      student => ({ student })
    )
  );
  app.get(
    "/api/ncc/admissions/students/:studentId/enrolments",
    (request, response) =>
      handleOperationalRead<EmsStagingStudentEnrolment[]>(
        request,
        response,
        dependencies,
        "admissions",
        (api, token) =>
          api.studentEnrolments(token, request.params?.studentId ?? ""),
        normalizeEmsStudentEnrolments,
        items => ({ items })
      )
  );
  app.get("/api/ncc/admissions/leads", (request, response) =>
    handleOperationalRead<EmsStagingLead[]>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.leads(token),
      normalizeEmsLeads,
      items => ({ items })
    )
  );
  app.get("/api/ncc/admissions/leads/:leadId", (request, response) =>
    handleOperationalRead<EmsStagingLead>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.lead(token, request.params?.leadId ?? ""),
      normalizeEmsLead,
      lead => ({ lead })
    )
  );
  app.get("/api/ncc/admissions/placement-tests", (request, response) =>
    handleOperationalRead<EmsStagingPlacementTest[]>(
      request,
      response,
      dependencies,
      "admissions",
      (api, token) => api.placementTests(token),
      normalizeEmsPlacementTests,
      items => ({ items })
    )
  );
  app.get(
    "/api/ncc/admissions/placement-tests/:placementTestId",
    (request, response) =>
      handleOperationalRead<EmsStagingPlacementTest>(
        request,
        response,
        dependencies,
        "admissions",
        (api, token) =>
          api.placementTest(
            token,
            request.params?.placementTestId ?? ""
          ),
        normalizeEmsPlacementTest,
        placementTest => ({ placementTest })
      )
  );
  app.get("/api/ncc/delivery/classes", (request, response) =>
    handleOperationalRead<EmsStagingClass[]>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.classes(token),
      normalizeEmsClasses,
      items => ({ items })
    )
  );
  app.get("/api/ncc/delivery/classes/:classId", (request, response) =>
    handleOperationalRead<EmsStagingClass>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.class(token, request.params?.classId ?? ""),
      normalizeEmsClass,
      value => ({ class: value })
    )
  );
  app.get("/api/ncc/delivery/rooms", (request, response) =>
    handleOperationalRead<EmsStagingRoom[]>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.rooms(token),
      normalizeEmsRooms,
      items => ({ items })
    )
  );
  app.get("/api/ncc/delivery/teacher-workspace", (request, response) =>
    handleOperationalRead<EmsStagingTeacherWorkspace>(
      request,
      response,
      dependencies,
      "delivery",
      (api, token) => api.teacherWorkspace(token),
      normalizeEmsTeacherWorkspace,
      workspace => ({ workspace })
    )
  );
}
