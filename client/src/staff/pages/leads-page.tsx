import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus } from "lucide-react";
import type { NccLeadDto, NccPageDto } from "@/lib/backend/api";
import { useNcc, type StaffQuery } from "../api";
import { copy } from "../copy";
import { canSetAssignee, isAdmissionsRole } from "../roles";
import { useStaffSession } from "../session";
import { ListPage, type ListColumn, type ListFilter } from "../ui/list-page";
import {
  Avatar,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatusBadge,
} from "../ui/primitives";
import { ServerSegments } from "../ui/server-segments";
import { useListQuery } from "../ui/use-list-query";
import { formatDate } from "./catalog-shared";
import {
  ModeTags,
  useActiveAreas,
  useAssignees,
  useBranches,
} from "./admissions-ui";
import { LEAD_TYPES, LeadForm, leadTypeLabel } from "./lead-form";

const L = copy.admissions.leads;
const M = copy.admissions.mode;

export const LEAD_STAGES: NccLeadDto["status"][] = [
  "in_process",
  "follow_up",
  "placement_test",
  "trial_lesson",
  "future_registration",
  "registered",
  "lost",
];

const FILTER_KEYS = [
  "status",
  "mode",
  "owner",
  "area",
  "type",
  "branch",
] as const;

/** URL filters (short, readable) to the BFF lead list query. */
export function leadListQuery(url: StaffQuery): StaffQuery {
  const query: StaffQuery = {
    pageSize: url.pageSize,
    ...(url.page ? { page: url.page } : {}),
    ...(url.q ? { q: url.q } : {}),
    ...(url.status ? { status: url.status } : {}),
    ...(url.area ? { areaOfStudyId: url.area } : {}),
    ...(url.type ? { type: url.type } : {}),
    ...(url.branch ? { branchId: url.branch } : {}),
  };
  if (url.mode === "online") query.wantsOnline = true;
  if (url.mode === "onsite") query.wantsOnsite = true;
  if (url.owner === "none") query.unassigned = true;
  else if (url.owner) query.assignedSsaId = url.owner;
  return query;
}

export default function LeadsPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const allowed = isAdmissionsRole(role);
  const superAdmin = role === "super_admin";
  const branches = useBranches();
  const areas = useActiveAreas(allowed);
  const assignees = useAssignees(
    session?.ncc?.workspaceBranchId,
    allowed && canSetAssignee(role)
  );
  const [formOpen, setFormOpen] = useState(false);
  const [, navigate] = useLocation();

  const urlQuery = useListQuery(FILTER_KEYS);
  const query = useMemo(() => leadListQuery(urlQuery), [urlQuery]);
  const { status: _status, page: _page, pageSize: _size, ...countBase } = query;
  const leads = useNcc<NccPageDto<NccLeadDto>>(
    allowed ? "/api/ncc/admissions/leads" : null,
    query,
    { keepPreviousData: true }
  );

  const filters: ListFilter[] = [
    {
      key: "mode",
      label: M.label,
      allLabel: L.anyMode,
      options: [
        { value: "onsite", label: M.onsite },
        { value: "online", label: M.online },
      ],
    },
    ...(assignees.length
      ? [
          {
            key: "owner",
            label: L.owner,
            allLabel: L.anyOwner,
            options: [
              { value: "none", label: L.unassigned },
              ...assignees.map(person => ({
                value: person.id,
                label: person.name,
              })),
            ],
          },
        ]
      : []),
    ...(areas.length
      ? [
          {
            key: "area",
            label: L.areaOfStudy,
            allLabel: L.anyArea,
            options: areas.map(area => ({ value: area.id, label: area.name })),
          },
        ]
      : []),
    {
      key: "type",
      label: L.leadType,
      allLabel: L.anyType,
      options: LEAD_TYPES.map(type => ({
        value: type,
        label: leadTypeLabel(type),
      })),
    },
    ...(superAdmin && branches.active.length > 1
      ? [
          {
            key: "branch",
            label: L.branch,
            allLabel: L.allBranches,
            options: branches.active.map(branch => ({
              value: branch.id,
              label: branch.name,
            })),
          },
        ]
      : []),
  ];

  const columns: ListColumn<NccLeadDto>[] = [
    {
      id: "person",
      label: L.person,
      always: true,
      render: row => (
        <div className="staff-person">
          <Avatar name={row.name} seed={row.id} />
          <div className="staff-person-meta">
            <span className="staff-person-name">
              <Link
                href={`/app/leads/${row.id}`}
                className="staff-stretch"
                title={row.name}
              >
                {row.name}
              </Link>
            </span>
            <span className="staff-person-email staff-ltr" title={row.email}>
              {row.phone ?? row.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "stage",
      label: L.stage,
      render: row => <StatusBadge status={row.status} />,
    },
    {
      id: "interest",
      label: L.interest,
      render: row => {
        const names = row.preferredCourses.map(course => course.name);
        const primary = names[0] ?? row.areaOfStudyName ?? null;
        if (!primary)
          return <span className="staff-muted">{copy.state.notSet}</span>;
        return (
          <span className="staff-nowrap" title={names.join(", ") || primary}>
            {primary}
            {names.length > 1 ? (
              <span className="staff-tag">+{names.length - 1}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "mode",
      label: M.label,
      render: row => (
        <ModeTags online={row.wantsOnline} onsite={row.wantsOnsite} />
      ),
    },
    {
      id: "owner",
      label: L.owner,
      render: row =>
        row.assignedSsaName ?? (
          <span className="staff-muted">{L.unassigned}</span>
        ),
    },
    {
      id: "branch",
      label: L.branch,
      defaultHidden: !superAdmin,
      render: row => row.branchName,
    },
    {
      id: "group",
      label: L.group,
      defaultHidden: true,
      render: row =>
        row.groupLabel ?? (
          <span className="staff-muted">{copy.state.notSet}</span>
        ),
    },
    {
      id: "added",
      label: L.added,
      render: row => formatDate(row.createdAt),
    },
  ];

  if (!allowed) {
    return <EmptyState title={copy.shell.noAccess} description={L.noAccess} />;
  }

  const page = leads.data;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={L.title}
        description={L.description}
        actions={
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            onClick={() => setFormOpen(true)}
          >
            <Plus strokeWidth={1.75} aria-hidden />
            {L.add}
          </button>
        }
      />
      <ServerSegments
        path="/api/ncc/admissions/leads"
        base={countBase}
        param="status"
        label={L.stage}
        segments={[
          { value: "", label: copy.staffUsers.all, query: {} },
          ...LEAD_STAGES.map(stage => ({
            value: stage,
            label: copy.status[stage as keyof typeof copy.status],
            query: { status: stage },
          })),
        ]}
      />
      {leads.error && !page ? (
        <ErrorState error={leads.error} onRetry={() => void leads.mutate()} />
      ) : !page ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={L.title}
          listId="leads"
          items={page.items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => row.name}
          filters={filters}
          server={{
            total: page.total,
            pageSize: page.pageSize,
            refreshing: leads.isValidating,
          }}
          renderCard={row => (
            <>
              <Avatar name={row.name} seed={row.id} />
              <div className="staff-rowcard-main">
                <span className="staff-person-name">
                  <Link href={`/app/leads/${row.id}`} className="staff-stretch">
                    {row.name}
                  </Link>
                </span>
                <span className="staff-person-email staff-ltr">
                  {row.phone ?? row.email}
                </span>
                <div className="staff-rowcard-badges">
                  <StatusBadge status={row.status} />
                  <ModeTags online={row.wantsOnline} onsite={row.wantsOnsite} />
                </div>
              </div>
            </>
          )}
          empty={
            <EmptyState
              title={L.empty}
              description={L.emptyHint}
              action={
                <button
                  type="button"
                  className="staff-btn"
                  data-variant="primary"
                  onClick={() => setFormOpen(true)}
                >
                  {L.add}
                </button>
              }
            />
          }
        />
      )}
      <LeadForm
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={null}
        onSaved={lead => navigate(`/app/leads/${lead.id}`)}
      />
    </div>
  );
}
