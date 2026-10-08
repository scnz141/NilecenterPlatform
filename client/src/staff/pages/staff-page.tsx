import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Plus } from "lucide-react";
import {
  disableNccStaffUserRequest,
  enableNccStaffUserRequest,
  type NccBranchDto,
  type NccRole,
  type NccStaffUserDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { isStaffManager, roleLabel } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { ListPage, type ListColumn, type ListFilter } from "../ui/list-page";
import {
  ActiveMark,
  Avatar,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatusBadge,
} from "../ui/primitives";
import { formatDate } from "./catalog-shared";
import { StaffActionsMenu } from "./staff-actions";
import { StaffForm } from "./staff-form";
import { SecretDialog, type StaffSecret } from "../ui/secret-dialog";

const C = copy.staffUsers;

const STATUS_ORDER = ["active", "invited", "disabled", "canceled"] as const;

type StaffStatus = (typeof STATUS_ORDER)[number];

export function staffStatusCounts(
  items: NccStaffUserDto[]
): Record<StaffStatus, number> {
  const counts: Record<StaffStatus, number> = {
    active: 0,
    invited: 0,
    disabled: 0,
    canceled: 0,
  };
  for (const item of items) {
    counts[item.status] += 1;
  }
  return counts;
}

function userName(user: NccStaffUserDto): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

/** Status segmented control backed by the `status` URL param. */
function StatusSegments({ items }: { items: NccStaffUserDto[] }) {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const active = params.get("status") ?? "";
  const counts = useMemo(() => staffStatusCounts(items), [items]);

  const segments: { value: string; label: string; count: number }[] = [
    { value: "", label: C.all, count: items.length },
    ...STATUS_ORDER.map(value => ({
      value,
      label: copy.status[value],
      count: counts[value],
    })),
  ].filter(
    segment =>
      segment.value === "" || segment.value === "active" || segment.count > 0
  );

  function setStatus(value: string) {
    const next = new URLSearchParams(search);
    if (value) next.set("status", value);
    else next.delete("status");
    next.delete("page");
    navigate(`?${next.toString()}`, { replace: true });
  }

  return (
    <div className="staff-segments" role="group" aria-label={C.status}>
      {segments.map(segment => (
        <button
          key={segment.value || "all"}
          type="button"
          className="staff-segment"
          data-active={active === segment.value}
          onClick={() => setStatus(segment.value)}
        >
          {active === segment.value ? <ActiveMark group="staff-status" /> : null}
          {segment.label}
          <span className="staff-segment-count">{segment.count}</span>
        </button>
      ))}
    </div>
  );
}

export default function StaffPage() {
  const { session } = useStaffSession();
  const canManage = isStaffManager(session?.ncc?.activeRole);
  const selfEmail = session?.email?.toLowerCase() ?? null;
  const search = useSearch();
  const [, navigate] = useLocation();

  const list = useNcc<{ items: NccStaffUserDto[] }>("/api/ncc/directory/users");
  const branches = useNcc<{ items: NccBranchDto[] }>(
    "/api/ncc/directory/branches"
  );
  const invalidate = useInvalidate();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NccStaffUserDto | null>(null);
  const [secrets, setSecrets] = useState<StaffSecret[] | null>(null);
  const [bulkAction, setBulkAction] = useState<{
    mode: "disable" | "enable";
    rows: NccStaffUserDto[];
    clear: () => void;
  } | null>(null);

  const items = list.data?.items;

  // The command menu "Add staff member" action lands here via ?new=1.
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("new") !== "1") return;
    setEditing(null);
    setFormOpen(true);
    params.delete("new");
    const raw = params.toString();
    navigate(raw ? `?${raw}` : "?", { replace: true });
  }, [search, navigate]);

  const branchName = useMemo(() => {
    const map = new Map(
      (branches.data?.items ?? []).map(branch => [branch.id, branch.name])
    );
    return (id: string) => map.get(id) ?? id;
  }, [branches.data]);

  function worksAtText(row: NccStaffUserDto): string {
    if (row.scopeType === "global") return C.globalScope;
    return row.branchIds.map(branchName).join(", ") || copy.state.notSet;
  }

  const filters: ListFilter[] = useMemo(
    () => [
      {
        key: "role",
        label: C.role,
        allLabel: C.allRoles,
        options: (
          [
            "super_admin",
            "branch_admin",
            "vice_manager",
            "hod",
            "registrar",
            "ssa",
            "teacher",
          ] as NccRole[]
        ).map(role => ({ value: role, label: roleLabel(role) })),
      },
      {
        key: "branch",
        label: C.branches,
        allLabel: C.allBranches,
        options: (branches.data?.items ?? []).map(branch => ({
          value: branch.id,
          label: branch.name,
        })),
      },
      {
        key: "placement",
        label: C.placementCapability,
        allLabel: C.placementCapability,
        options: [
          { value: "yes", label: C.placementYes },
          { value: "no", label: C.placementNo },
        ],
      },
      {
        key: "status",
        label: C.status,
        allLabel: C.all,
        options: STATUS_ORDER.map(value => ({
          value,
          label: copy.status[value],
        })),
        hidden: true,
      },
      {
        key: "moodle",
        label: C.moodle,
        allLabel: C.moodle,
        options: [
          { value: "missing-teacher", label: C.teachersNoMoodle },
        ],
        hidden: true,
      },
    ],
    [branches.data]
  );

  async function refreshUsers() {
    await invalidate("/api/ncc/directory/users");
  }

  const moodleMissing = useMemo(
    () =>
      (items ?? []).filter(
        row => row.emsRole === "teacher" && !row.moodleLinked
      ).length,
    [items]
  );
  const moodleFilterOn =
    new URLSearchParams(search).get("moodle") === "missing-teacher";

  function toggleMoodleFilter() {
    const next = new URLSearchParams(search);
    if (moodleFilterOn) next.delete("moodle");
    else next.set("moodle", "missing-teacher");
    next.delete("page");
    navigate(`?${next.toString()}`, { replace: true });
  }

  function openEdit(row: NccStaffUserDto) {
    setEditing(row);
    setFormOpen(true);
  }

  const columns: ListColumn<NccStaffUserDto>[] = [
    {
      id: "person",
      label: C.person,
      always: true,
      sortValue: row => userName(row),
      render: row => {
        const name = userName(row);
        return (
          <div className="staff-person">
            <Avatar name={name} seed={row.id} />
            <div className="staff-person-meta">
              <span className="staff-person-name">
                <Link
                  href={`/app/staff/${row.id}`}
                  className="staff-stretch"
                  title={name}
                >
                  {name}
                </Link>
                {row.email.toLowerCase() === selfEmail ? (
                  <span className="staff-tag">{C.you}</span>
                ) : null}
              </span>
              <span className="staff-person-email" title={row.email}>
                {row.email}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "role",
      label: C.role,
      sortValue: row => roleLabel(row.emsRole),
      render: row => roleLabel(row.emsRole),
    },
    {
      id: "worksAt",
      label: C.worksAt,
      render: row => {
        if (row.scopeType === "global") return C.globalScope;
        const names = row.branchIds.map(branchName);
        if (names.length === 0) return copy.state.notSet;
        return (
          <span className="staff-nowrap" title={names.join(", ")}>
            {names[0]}
            {names.length > 1 ? (
              <span className="staff-tag">+{names.length - 1}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "moodle",
      label: C.moodle,
      render: row => (
        <StatusBadge
          status={row.moodleLinked ? "ok" : "plain"}
          label={row.moodleLinked ? C.moodleLinked : C.moodleMissing}
        />
      ),
    },
    {
      id: "status",
      label: C.status,
      sortValue: row => row.status,
      render: row => <StatusBadge status={row.status} />,
    },
    {
      id: "lastSignIn",
      label: C.lastSignIn,
      sortValue: row => row.lastLoginAt,
      render: row =>
        row.lastLoginAt ? (
          formatDate(row.lastLoginAt)
        ) : (
          <span className="staff-muted">{C.neverSignedIn}</span>
        ),
    },
    {
      id: "added",
      label: C.added,
      sortValue: row => row.createdAt,
      render: row => formatDate(row.createdAt),
      defaultHidden: true,
    },
    ...(canManage
      ? [
          {
            id: "actions",
            label: "",
            always: true,
            render: (row: NccStaffUserDto) => (
              <span className="staff-cell-top">
                <StaffActionsMenu user={row} onEdit={() => openEdit(row)} />
              </span>
            ),
          } satisfies ListColumn<NccStaffUserDto>,
        ]
      : []),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={C.title}
        description={C.description}
        actions={
          canManage ? (
            <button
              type="button"
              className="staff-btn"
              data-variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus strokeWidth={1.75} aria-hidden />
              {C.add}
            </button>
          ) : undefined
        }
      />
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.mutate()} />
      ) : list.isLoading || !items ? (
        <LoadingRows />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <StatusSegments items={items} />
            {moodleMissing > 0 ? (
              <button
                type="button"
                className="staff-chip"
                data-active={moodleFilterOn}
                onClick={toggleMoodleFilter}
              >
                {C.teachersNoMoodle} ({moodleMissing})
              </button>
            ) : null}
          </div>
          <ListPage
            title={C.title}
            listId="staff"
            items={items}
            columns={columns}
            rowKey={row => row.id}
            searchText={row => `${userName(row)} ${row.email}`}
            filters={filters}
            filterValue={(row, key) => {
              if (key === "role") return row.emsRole;
              if (key === "status") return row.status;
              if (key === "branch")
                return row.scopeType === "global"
                  ? null
                  : (row.branchIds[0] ?? "");
              if (key === "placement")
                return row.canTakePlacementTest ? "yes" : "no";
              if (key === "moodle")
                return row.emsRole === "teacher" && !row.moodleLinked
                  ? "missing-teacher"
                  : null;
              return null;
            }}
            renderCard={row => {
              const name = userName(row);
              return (
                <>
                  <Avatar name={name} seed={row.id} />
                  <div className="staff-rowcard-main">
                    <span className="staff-person-name">
                      <Link
                        href={`/app/staff/${row.id}`}
                        className="staff-stretch"
                      >
                        {name}
                      </Link>
                      {row.email.toLowerCase() === selfEmail ? (
                        <span className="staff-tag">{C.you}</span>
                      ) : null}
                    </span>
                    <span className="staff-person-email">{row.email}</span>
                    <span className="staff-muted text-[13px]">
                      {roleLabel(row.emsRole)} · {worksAtText(row)}
                    </span>
                    <div className="staff-rowcard-badges">
                      <StatusBadge status={row.status} />
                      <StatusBadge
                        status={row.moodleLinked ? "ok" : "plain"}
                        label={
                          row.moodleLinked ? C.moodleLinked : C.moodleMissing
                        }
                      />
                    </div>
                  </div>
                  {canManage ? (
                    <span className="staff-cell-top">
                      <StaffActionsMenu
                        user={row}
                        onEdit={() => openEdit(row)}
                      />
                    </span>
                  ) : null}
                </>
              );
            }}
            bulkActions={
              canManage
                ? (rows, clear) => {
                    const targets = rows.filter(
                      row => row.email.toLowerCase() !== selfEmail
                    );
                    if (targets.length === 0) return null;
                    return (
                      <>
                        <button
                          type="button"
                          className="staff-btn"
                          data-size="sm"
                          onClick={() =>
                            setBulkAction({ mode: "enable", rows: targets, clear })
                          }
                        >
                          {C.bulkEnable}
                        </button>
                        <button
                          type="button"
                          className="staff-btn"
                          data-variant="destructive-outline"
                          data-size="sm"
                          onClick={() =>
                            setBulkAction({
                              mode: "disable",
                              rows: targets,
                              clear,
                            })
                          }
                        >
                          {C.bulkDisable}
                        </button>
                      </>
                    );
                  }
                : undefined
            }
            empty={
              <EmptyState
                title={C.empty}
                description={C.emptyHint}
                action={
                  canManage ? (
                    <button
                      type="button"
                      className="staff-btn"
                      data-variant="primary"
                      onClick={() => {
                        setEditing(null);
                        setFormOpen(true);
                      }}
                    >
                      <Plus strokeWidth={1.75} aria-hidden />
                      {C.add}
                    </button>
                  ) : undefined
                }
              />
            }
          />
        </>
      )}

      <StaffForm
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        onSecrets={setSecrets}
      />

      <SecretDialog secrets={secrets} onClose={() => setSecrets(null)} />

      <ConfirmDialog
        open={bulkAction?.mode === "disable"}
        onOpenChange={open => {
          if (!open) setBulkAction(null);
        }}
        title={C.disableTitle}
        description={C.disableBody}
        confirmLabel={copy.actions.disable}
        destructive
        reasonKind="disable_staff"
        reasonRequired
        onConfirm={reasonId =>
          runAction(async () => {
            for (const row of bulkAction?.rows ?? []) {
              await staffWrite(disableNccStaffUserRequest(row.id, reasonId));
            }
            await refreshUsers();
            bulkAction?.clear();
            setBulkAction(null);
          }, { success: C.bulkDone })
        }
      />

      <ConfirmDialog
        open={bulkAction?.mode === "enable"}
        onOpenChange={open => {
          if (!open) setBulkAction(null);
        }}
        title={C.enableTitle}
        description={C.enableBody}
        confirmLabel={copy.actions.enable}
        onConfirm={() =>
          runAction(async () => {
            for (const row of bulkAction?.rows ?? []) {
              await staffWrite(enableNccStaffUserRequest(row.id));
            }
            await refreshUsers();
            bulkAction?.clear();
            setBulkAction(null);
          }, { success: C.bulkDone })
        }
      />
    </div>
  );
}
