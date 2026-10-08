/**
 * Maps old staff portal addresses onto the unified staff app.
 *
 * Old record IDs were demo-store IDs and are never carried across, except the
 * Nile Forms IDs (same Forms service, compatible IDs).
 *
 * Returns null for paths outside the five removed staff prefixes
 * (/app/admin, /app/registrar, /app/hod, /app/branch, /app/teacher).
 */

type LegacyPortal = "admin" | "registrar" | "hod" | "branch" | "teacher";

const PREFIX =
  /^\/app\/(admin|registrar|hod|branch|teacher)(?=\/|$)/;

function startsWith(rest: string, segment: string) {
  return rest === segment || rest.startsWith(`${segment}/`);
}

export function legacyStaffTarget(pathname: string): string | null {
  const path = pathname.split(/[?#]/, 1)[0];
  const match = PREFIX.exec(path);
  if (!match) return null;
  const portal = match[1] as LegacyPortal;
  const rest = path.slice(match[0].length); // "" or "/sub/path"

  // Nile Forms: same service, compatible IDs.
  const review = /^\/forms\/review\/([^/]+)/.exec(rest);
  if (review) return `/app/forms/responses/${review[1]}`;
  const manage = /^\/forms\/manage\/([^/]+)(?=\/|$)/.exec(rest);
  if (manage) return manage[1] === "new" ? "/app/forms" : `/app/forms/${manage[1]}`;
  if (startsWith(rest, "/forms/migration")) return "/app/forms/import";
  if (startsWith(rest, "/forms")) return "/app/forms";

  if (startsWith(rest, "/profile") || startsWith(rest, "/settings/profile"))
    return "/app/profile";
  if (startsWith(rest, "/messages")) return "/app/notifications";

  if (
    portal === "admin" &&
    (startsWith(rest, "/users") ||
      startsWith(rest, "/roles") ||
      startsWith(rest, "/permissions"))
  )
    return "/app/staff";
  if ((portal === "branch" || portal === "hod") && startsWith(rest, "/teachers"))
    return "/app/staff";
  if ((portal === "admin" || portal === "hod") && startsWith(rest, "/departments"))
    return "/app/departments";
  if (
    (portal === "admin" && startsWith(rest, "/schedule/rooms")) ||
    (portal === "branch" && startsWith(rest, "/rooms"))
  )
    return "/app/rooms";
  if (portal === "admin" && startsWith(rest, "/audit-logs")) return "/app/audit";
  if (portal === "admin" && startsWith(rest, "/system-health"))
    return "/app/system";
  if (portal === "admin" && startsWith(rest, "/integrations"))
    return "/app/moodle";
  if (startsWith(rest, "/moodle-source"))
    return portal === "teacher" ? "/app/classes" : "/app/moodle";
  if (
    portal === "admin" &&
    (startsWith(rest, "/courses") || startsWith(rest, "/programs"))
  )
    return "/app/courses";
  if (
    portal === "hod" &&
    (startsWith(rest, "/programs") ||
      startsWith(rest, "/levels") ||
      startsWith(rest, "/courses") ||
      startsWith(rest, "/curriculum"))
  )
    return "/app/courses";
  if (
    (portal === "registrar" || portal === "branch") &&
    startsWith(rest, "/students")
  )
    return "/app/students";
  if (
    portal === "registrar" &&
    (startsWith(rest, "/leads") || startsWith(rest, "/applications"))
  )
    return "/app/leads";
  if (portal === "registrar" && startsWith(rest, "/placement-tests"))
    return "/app/placement-tests";
  if (
    (portal === "registrar" &&
      (startsWith(rest, "/enrollments") || startsWith(rest, "/payments"))) ||
    (portal === "branch" && startsWith(rest, "/payments"))
  )
    return "/app/enrolments";
  if (
    portal === "teacher" &&
    (startsWith(rest, "/calendar") || startsWith(rest, "/availability"))
  )
    return "/app/sessions";
  if (
    startsWith(rest, "/classes") ||
    startsWith(rest, "/schedule") ||
    (portal === "branch" && startsWith(rest, "/attendance")) ||
    (portal === "hod" && startsWith(rest, "/assessments")) ||
    (portal === "teacher" &&
      (startsWith(rest, "/quizzes") ||
        startsWith(rest, "/question-bank") ||
        startsWith(rest, "/assignments") ||
        startsWith(rest, "/grading") ||
        startsWith(rest, "/quran-review")))
  )
    return "/app/classes";

  return "/app/dashboard";
}
