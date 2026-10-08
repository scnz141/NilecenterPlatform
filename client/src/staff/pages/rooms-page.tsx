import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus } from "lucide-react";
import type { NccRoomDto } from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { isClassCatalogWriter } from "../roles";
import { useStaffSession } from "../session";
import { ListPage, type ListColumn, type ListFilter } from "../ui/list-page";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge } from "../ui/primitives";
import { useBranches } from "./admissions-ui";
import { RoomForm } from "./room-form";

const R = copy.teaching.rooms;

export default function RoomsPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const canWrite = isClassCatalogWriter(role);
  const branches = useBranches();
  const [, navigate] = useLocation();
  const [formOpen, setFormOpen] = useState(false);
  const rooms = useNcc<{ items: NccRoomDto[] }>("/api/ncc/delivery/rooms");

  const filters: ListFilter[] = [
    {
      key: "status",
      label: copy.catalog.shared.status,
      allLabel: copy.staffUsers.all,
      options: (["active", "disabled"] as const).map(value => ({ value, label: copy.status[value] })),
    },
    ...(role === "super_admin" && branches.active.length > 1
      ? [
          {
            key: "branch",
            label: copy.teaching.branch,
            allLabel: copy.teaching.allBranches,
            options: branches.active.map(branch => ({ value: branch.id, label: branch.name })),
          },
        ]
      : []),
  ];

  const columns: ListColumn<NccRoomDto>[] = [
    {
      id: "name",
      label: R.name,
      always: true,
      sortValue: row => row.name,
      render: row => (
        <Link href={`/app/rooms/${row.id}`} className="staff-stretch staff-link-quiet">
          {row.name}
        </Link>
      ),
    },
    { id: "branch", label: copy.teaching.branch, sortValue: row => row.branchName, render: row => row.branchName },
    {
      id: "capacity",
      label: R.capacity,
      sortValue: row => row.capacity ?? 0,
      render: row => (row.capacity ? <span className="staff-figures">{row.capacity}</span> : <span className="staff-muted">{R.unlimited}</span>),
    },
    { id: "status", label: copy.catalog.shared.status, render: row => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={R.title}
        description={R.description}
        actions={
          canWrite ? (
            <button type="button" className="staff-btn" data-variant="primary" onClick={() => setFormOpen(true)}>
              <Plus strokeWidth={1.75} aria-hidden />
              {R.add}
            </button>
          ) : undefined
        }
      />
      {rooms.error ? (
        <ErrorState error={rooms.error} onRetry={() => void rooms.mutate()} />
      ) : !rooms.data ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={R.title}
          listId="rooms"
          items={rooms.data.items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => `${row.name} ${row.branchName}`}
          filters={filters}
          filterValue={(row, key) => (key === "status" ? row.status : key === "branch" ? row.branchId : null)}
          renderCard={row => (
            <div className="staff-rowcard-main">
              <span className="staff-person-name">
                <Link href={`/app/rooms/${row.id}`} className="staff-stretch">
                  {row.name}
                </Link>
              </span>
              <span className="staff-muted">
                {row.branchName}
                {row.capacity ? ` · ${row.capacity} ${copy.teaching.seats}` : ""}
              </span>
              <div className="staff-rowcard-badges">
                <StatusBadge status={row.status} />
              </div>
            </div>
          )}
          empty={<EmptyState title={R.empty} description={canWrite ? R.emptyHint : undefined} />}
        />
      )}
      <RoomForm open={formOpen} onOpenChange={setFormOpen} room={null} onSaved={room => navigate(`/app/rooms/${room.id}`)} />
    </div>
  );
}
