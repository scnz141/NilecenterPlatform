import { Link } from "wouter";

export type TeacherClassSection =
  | "overview"
  | "sessions"
  | "attendance"
  | "students"
  | "grades"
  | "materials";

const classSections: Array<{ key: TeacherClassSection; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "sessions", label: "Sessions" },
  { key: "attendance", label: "Attendance" },
  { key: "students", label: "Students" },
  { key: "grades", label: "Grades" },
  { key: "materials", label: "Materials" },
];

function hrefFor(classId: string, section: TeacherClassSection) {
  if (section === "overview") return `/app/teacher/classes/${classId}`;
  return `/app/teacher/classes/${classId}/${section}`;
}

export function TeacherClassNavigation({
  classId,
  active,
}: {
  classId: string;
  active: TeacherClassSection;
}) {
  return (
    <nav
      className="teacher-class-route-nav"
      aria-label="Class sections"
      data-testid="teacher-class-section-nav"
    >
      {classSections.map(section => {
        const isActive = active === section.key;
        return (
          <Link
            key={section.key}
            href={hrefFor(classId, section.key)}
            className={isActive ? "active" : ""}
            aria-current={isActive ? "page" : undefined}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
