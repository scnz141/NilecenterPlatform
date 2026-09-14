import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Link } from "wouter";
import NccReadStatus from "@/components/platform/NccReadStatus";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { getStoredAuthSession } from "@/lib/auth/session";
import {
  fetchNccDirectoryBranchesRequest,
  fetchNccDirectoryDepartmentsRequest,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import { platformStore } from "@/lib/domain/store";

type AdminDirectoryView =
  | "branches"
  | "departments"
  | "programs"
  | "certificates";

type DirectoryRow = {
  id: string;
  name: string;
  detail: string;
  scope: string;
  status: string;
  metric: string;
};

const viewCopy: Record<
  AdminDirectoryView,
  {
    title: string;
    description: string;
    empty: string;
    action: string;
    href: string;
  }
> = {
  branches: {
    title: "Branches",
    description: "Review the EMS branch catalog.",
    empty: "No branches found.",
    action: "",
    href: "/app/admin/branches",
  },
  departments: {
    title: "Departments",
    description: "Review academic departments and their programs.",
    empty: "No departments found.",
    action: "Open programs",
    href: "/app/admin/programs",
  },
  programs: {
    title: "Programs",
    description: "Review program ownership and available courses.",
    empty: "No programs found.",
    action: "Open courses",
    href: "/app/admin/courses",
  },
  certificates: {
    title: "Certificates",
    description: "Review certificate status across the platform.",
    empty: "No certificates found.",
    action: "Open report",
    href: "/app/admin/reports/certificates",
  },
};

function humanize(value?: string) {
  if (!value) return "Not set";
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (["active", "approved", "issued", "completed"].includes(status)) {
    return "green";
  }
  if (["pending", "pending_approval", "draft"].includes(status)) {
    return "amber";
  }
  if (["paused", "rejected", "revoked", "cancelled"].includes(status)) {
    return "red";
  }
  return "slate";
}

export default function AdminDirectoryPage({
  view,
}: {
  view: AdminDirectoryView;
}) {
  if (getStoredAuthSession()?.provider === "ncc") {
    return view === "departments" || view === "branches" ? (
      <NccAdminDirectoryPage view={view} />
    ) : (
      <NccAdminUnavailablePage view={view} />
    );
  }
  return <CompatibilityAdminDirectoryPage view={view} />;
}

function NccAdminUnavailablePage({ view }: { view: AdminDirectoryView }) {
  const copy = viewCopy[view];
  return (
    <PlatformShell role="superadmin" title={copy.title}>
      <WorkspaceLayout
        className="admin-directory-page"
        title={copy.title}
        description={copy.description}
        context="Admin"
        main={
          <div className="platform-empty-state" role="status">
            <strong>Not available in EMS yet.</strong>
          </div>
        }
      />
    </PlatformShell>
  );
}

function NccAdminDirectoryPage({ view }: { view: "branches" | "departments" }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [readState, setReadState] = useState<NccReadState<DirectoryRow[]>>({
    status: "loading",
  });
  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    if (view === "branches") {
      const result = await fetchNccDirectoryBranchesRequest();
      setReadState(
        result.ok && result.data
          ? {
              status: "ready",
              data: result.data.items.map(branch => ({
                id: branch.id,
                name: branch.name,
                detail: branch.code ?? "No code",
                scope: branch.timezone,
                status: branch.status,
                metric: "",
              })),
            }
          : classifyNccFailure(result)
      );
      return;
    }
    const result = await fetchNccDirectoryDepartmentsRequest();
    setReadState(
      result.ok && result.data
        ? {
            status: "ready",
            data: result.data.items.map(department => ({
              id: department.id,
              name: department.name,
              detail: department.code ?? "No code",
              scope: "Catalog",
              status: department.status,
              metric: "",
            })),
          }
        : classifyNccFailure(result)
    );
  }, [view]);
  useEffect(() => {
    void load();
  }, [load]);
  const rows = readState.status === "ready" ? readState.data : [];
  const statusOptions = Array.from(new Set(rows.map(row => row.status)));
  const filteredRows = rows.filter(row => {
    const text =
      `${row.name} ${row.detail} ${row.scope} ${row.status}`.toLowerCase();
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (status === "all" || row.status === status)
    );
  });
  const copy = viewCopy[view];

  return (
    <PlatformShell role="superadmin" title={copy.title}>
      <WorkspaceLayout
        className="admin-directory-page"
        title={copy.title}
        description={copy.description}
        context="Admin"
        toolbar={
          readState.status === "ready" ? (
            <div className="admin-compact-toolbar admin-directory-toolbar">
              <label>
                Search
                <span>
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={`Search ${copy.title.toLowerCase()}`}
                  />
                </span>
              </label>
              <label>
                Status
                <select
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map(value => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : undefined
        }
        main={
          readState.status !== "ready" ? (
            <NccReadStatus state={readState} onRetry={() => void load()} />
          ) : (
            <DataTableCard
              title={copy.title}
              subtitle={`${filteredRows.length} records`}
            >
              <div className="admin-record-list admin-directory-record-list">
                {filteredRows.length ? (
                  filteredRows.map(row => (
                    <article key={row.id}>
                      <div className="admin-record-list-copy">
                        <span>{row.detail}</span>
                        <strong>{row.name}</strong>
                        <p>{row.scope}</p>
                      </div>
                      <div className="admin-record-list-meta">
                        <StatusBadge tone={statusTone(row.status)}>
                          {humanize(row.status)}
                        </StatusBadge>
                        <small>{row.metric}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="platform-empty-state">
                    <strong>{copy.empty}</strong>
                  </div>
                )}
              </div>
            </DataTableCard>
          )
        }
      />
    </PlatformShell>
  );
}

function CompatibilityAdminDirectoryPage({
  view,
}: {
  view: AdminDirectoryView;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const state = useMemo(() => platformStore.getState(), []);
  const copy = viewCopy[view];

  const rows = useMemo<DirectoryRow[]>(() => {
    if (view === "departments") {
      return state.departments.map(department => {
        const owner = state.users.find(
          user => user.id === department.ownerUserId
        );
        const branches = department.branchIds
          .map(id => state.branches.find(branch => branch.id === id)?.name)
          .filter(Boolean)
          .join(", ");
        const programs = state.programs.filter(
          program => program.departmentId === department.id
        );
        return {
          id: department.id,
          name: department.name,
          detail: owner?.name ?? "No department lead",
          scope: branches || "No branch access",
          status: department.status,
          metric: `${programs.length} programs`,
        };
      });
    }

    if (view === "programs") {
      return state.programs.map(program => {
        const department = state.departments.find(
          item => item.id === program.departmentId
        );
        const courses = state.courses.filter(
          course => course.programId === program.id
        );
        return {
          id: program.id,
          name: program.title,
          detail: department?.name ?? "No department",
          scope: `${program.category} · ${program.language}`,
          status: program.status,
          metric: `${courses.length} courses`,
        };
      });
    }

    return state.certificates.map(certificate => {
      const student = state.students.find(
        item => item.id === certificate.studentId
      );
      const user = state.users.find(item => item.id === student?.userId);
      const course = state.courses.find(
        item => item.id === certificate.courseId
      );
      return {
        id: certificate.id,
        name: user?.name ?? "Learner",
        detail: course?.title ?? "Course",
        scope: `${certificate.grade}% grade · ${certificate.attendanceRate}% attendance`,
        status: certificate.status,
        metric: certificate.issuedAt ? "Issued" : "Awaiting decision",
      };
    });
  }, [state, view]);

  const statusOptions = Array.from(new Set(rows.map(row => row.status)));
  const filteredRows = rows.filter(row => {
    const text =
      `${row.name} ${row.detail} ${row.scope} ${row.status} ${row.metric}`.toLowerCase();
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (status === "all" || row.status === status)
    );
  });

  return (
    <PlatformShell role="superadmin" title={copy.title}>
      <WorkspaceLayout
        className="admin-directory-page"
        title={copy.title}
        description={copy.description}
        context="Admin"
        actions={
          <Link className="platform-primary-button" href={copy.href}>
            {copy.action}
            <ArrowRight size={15} />
          </Link>
        }
        toolbar={
          <div
            className="admin-compact-toolbar admin-directory-toolbar"
            data-testid={`admin-${view}-toolbar`}
          >
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={`Search ${copy.title.toLowerCase()}`}
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statusOptions.map(item => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          <DataTableCard
            title={copy.title}
            subtitle={`${filteredRows.length} records`}
          >
            <div
              className="admin-record-list admin-directory-record-list"
              data-testid={`admin-${view}-list`}
            >
              {filteredRows.length ? (
                filteredRows.map(row => (
                  <article key={row.id}>
                    <div className="admin-record-list-copy">
                      <span>{row.detail}</span>
                      <strong>{row.name}</strong>
                      <p>{row.scope}</p>
                    </div>
                    <div className="admin-record-list-meta">
                      <StatusBadge tone={statusTone(row.status)}>
                        {humanize(row.status)}
                      </StatusBadge>
                      <small>{row.metric}</small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="platform-empty-state">
                  <strong>{copy.empty}</strong>
                  <span>Try another search or status filter.</span>
                </div>
              )}
            </div>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
