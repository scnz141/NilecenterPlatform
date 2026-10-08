import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  NccPageDto,
  NccPlacementTestDto,
  NccTrialLessonDto,
} from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { useNcc, type StaffQuery } from "../api";
import { copy } from "../copy";
import { isAdmissionsRole } from "../roles";
import { useStaffSession } from "../session";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from "../ui/primitives";
import { ServerSegments } from "../ui/server-segments";
import { useBranches } from "./admissions-ui";
import { BookingList, type Booking } from "./booking-list";

const A = copy.admissions.agenda;
const PAGE_SIZE = 50;

type Kind = "placement" | "trial";
type Tab = "scheduled" | "completed" | "no_show" | "cancelled";
const TABS: Tab[] = ["scheduled", "completed", "no_show", "cancelled"];

function tabLabel(tab: Tab) {
  if (tab === "scheduled") return A.upcoming;
  if (tab === "completed") return A.completed;
  if (tab === "no_show") return A.missed;
  return A.cancelled;
}

/**
 * Agenda of placement tests or trial lessons. Upcoming runs oldest first so
 * past bookings without a result surface at the top; history runs newest
 * first. Bookings start from a lead or student, so there is no create here.
 */
export function BookingsAgenda({ kind }: { kind: Kind }) {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const allowed = isAdmissionsRole(role);
  const branches = useBranches();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const tab = (
    TABS.includes(params.get("status") as Tab)
      ? params.get("status")
      : "scheduled"
  ) as Tab;
  const branchId = params.get("branch") ?? "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const path =
    kind === "placement"
      ? "/api/ncc/admissions/placement-tests"
      : "/api/ncc/admissions/trial-lessons";

  const base: StaffQuery = branchId ? { branchId } : {};
  const query: StaffQuery = {
    ...base,
    status: tab,
    sort: "scheduled_at",
    order: tab === "scheduled" ? "asc" : "desc",
    pageSize: PAGE_SIZE,
    ...(page > 1 ? { page } : {}),
  };
  const list = useNcc<NccPageDto<NccPlacementTestDto | NccTrialLessonDto>>(
    allowed ? path : null,
    query,
    { keepPreviousData: true }
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    navigate(`?${next.toString()}`, { replace: true });
  }

  if (!allowed) {
    return (
      <EmptyState
        title={copy.shell.noAccess}
        description={copy.admissions.leads.noAccess}
      />
    );
  }

  const data = list.data;
  const bookings: Booking[] = (data?.items ?? []).map(item =>
    kind === "placement"
      ? { kind: "placement", item: item as NccPlacementTestDto }
      : { kind: "trial", item: item as NccTrialLessonDto }
  );
  const pageCount = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={kind === "placement" ? A.placementsTitle : A.trialsTitle}
        description={
          kind === "placement" ? A.placementsDescription : A.trialsDescription
        }
      />
      <div className="staff-toolbar">
        <ServerSegments
          path={path}
          base={base}
          param="status"
          defaultValue="scheduled"
          label={copy.admissions.leads.stage}
          segments={TABS.map(value => ({
            value,
            label: tabLabel(value),
            query: { status: value },
          }))}
        />
        {role === "super_admin" && branches.active.length > 1 ? (
          <Select
            value={branchId || "__all"}
            onValueChange={value =>
              setParam("branch", value === "__all" ? null : value)
            }
          >
            <SelectTrigger size="sm" aria-label={A.branch}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{A.allBranches}</SelectItem>
              {branches.active.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {list.error && !data ? (
        <ErrorState error={list.error} onRetry={() => void list.mutate()} />
      ) : !data ? (
        <LoadingRows />
      ) : bookings.length === 0 ? (
        <EmptyState
          title={tab === "scheduled" ? A.emptyUpcoming : A.emptyOther}
          description={tab === "scheduled" ? A.emptyHint : undefined}
        />
      ) : (
        <div data-refreshing={list.isValidating || undefined}>
          <BookingList
            bookings={bookings}
            branchFor={branches.get}
            showSubject
            groupByDay
          />
        </div>
      )}

      {data && data.total > data.pageSize ? (
        <nav className="staff-pagination" aria-label={copy.actions.pagination}>
          <button
            type="button"
            className="staff-icon-btn"
            aria-label={copy.actions.previous}
            disabled={page <= 1}
            onClick={() => setParam("page", String(page - 1))}
          >
            <ChevronLeft
              className="staff-rtl-flip"
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
          <span>
            {page} {copy.actions.pageOf} {pageCount}
          </span>
          <button
            type="button"
            className="staff-icon-btn"
            aria-label={copy.actions.next}
            disabled={page >= pageCount}
            onClick={() => setParam("page", String(page + 1))}
          >
            <ChevronRight
              className="staff-rtl-flip"
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

export function PlacementTestsPage() {
  return <BookingsAgenda kind="placement" />;
}

export function TrialLessonsPage() {
  return <BookingsAgenda kind="trial" />;
}
