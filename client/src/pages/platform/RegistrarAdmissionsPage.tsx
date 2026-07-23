import { requireActiveUser } from "@/lib/auth/session";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Megaphone,
  Search,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  DetailLayout,
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { Lead } from "@/lib/domain/types";

type RegistrarAdmissionsView =
  | "leads"
  | "lead-create"
  | "lead-detail"
  | "applications"
  | "application-create"
  | "application-detail"
  | "placement-tests"
  | "placement-create"
  | "placement-detail";

type RegistrarAdmissionsPageProps = {
  view: RegistrarAdmissionsView;
  leadId?: string;
  applicationId?: string;
  bookingId?: string;
};

type LeadDraft = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  subject: string;
  source: Lead["source"];
  notes: string;
};

type ApplicationDraft = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  courseInterest: string;
  schedulePreference: string;
  notes: string;
};

type PlacementDraft = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  subject: string;
  preferredDate: string;
  currentLevel: string;
};

function statusTone(status?: string): "green" | "amber" | "red" | "slate" {
  if (!status) return "slate";
  if (["active", "approved", "completed", "ready_to_enroll"].includes(status)) {
    return "green";
  }
  if (["lead", "pending", "placement_booked"].includes(status)) return "amber";
  if (["paused", "cancelled", "rejected"].includes(status)) return "red";
  return "slate";
}

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusLabel(value?: string) {
  return (value ?? "not set")
    .replace(/_/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function defaultPlacementDate() {
  return "2026-07-15";
}

export default function RegistrarAdmissionsPage({
  view,
  leadId,
  applicationId,
  bookingId,
}: RegistrarAdmissionsPageProps) {
  const initialState = platformStore.getState();
  const initialApplication = applicationId
    ? initialState.applications.find(item => item.id === applicationId)
    : undefined;
  const initialApplicationLead = initialApplication
    ? initialState.leads.find(item => item.id === initialApplication.leadId)
    : undefined;
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [creationResult, setCreationResult] = useState<{
    message: string;
    href: string;
    label: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [selectedPlacementId, setSelectedPlacementId] = useState(
    bookingId ?? ""
  );
  const [recommendedLevel, setRecommendedLevel] = useState("Arabic Level 2");
  const [score, setScore] = useState(78);
  const [leadDraft, setLeadDraft] = useState<LeadDraft>({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    subject: "Arabic Language",
    source: "manual",
    notes: "",
  });
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft>({
    fullName: "",
    email: "",
    phone: "",
    branchId: "br_online",
    courseInterest: "Arabic Language",
    schedulePreference: "To confirm",
    notes: "",
  });
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft>({
    fullName: initialApplicationLead?.fullName ?? "",
    email: initialApplicationLead?.email ?? "",
    phone: initialApplicationLead?.phone ?? "",
    branchId: initialApplication?.branchId ?? "br_online",
    subject: initialApplication?.courseInterest ?? "Arabic Language",
    preferredDate: defaultPlacementDate(),
    currentLevel: "Placement pending",
  });

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("registrar").id;
  const refresh = () => setVersion(current => current + 1);
  const isAnyActionPending = Boolean(pendingAction);

  const selectedLead = leadId
    ? state.leads.find(lead => lead.id === leadId)
    : state.leads[0];
  const selectedLeadApplication = state.applications.find(
    application => application.leadId === selectedLead?.id
  );
  const selectedApplication = applicationId
    ? state.applications.find(application => application.id === applicationId)
    : state.applications[0];
  const selectedApplicationLead = state.leads.find(
    lead => lead.id === selectedApplication?.leadId
  );
  const selectedApplicationBranch = state.branches.find(
    branch => branch.id === selectedApplication?.branchId
  );
  const selectedApplicationWorkflow = state.enrollmentWorkflows.find(
    workflow => workflow.applicationId === selectedApplication?.id
  );
  const selectedPlacement = bookingId
    ? state.placementTests.find(booking => booking.id === bookingId)
    : (state.placementTests.find(
        booking => booking.id === selectedPlacementId
      ) ??
      state.placementTests.find(booking => booking.status !== "completed") ??
      state.placementTests[0]);
  const selectedPlacementResult = state.placementResults.find(
    result => result.bookingId === selectedPlacement?.id
  );
  const selectedPlacementWorkflow = state.enrollmentWorkflows.find(
    workflow => workflow.placementTestId === selectedPlacement?.id
  );

  useEffect(() => {
    setCreationResult(null);
    if (view !== "placement-create" || !applicationId) return;
    const latestState = platformStore.getState();
    const application = latestState.applications.find(
      item => item.id === applicationId
    );
    const lead = application
      ? latestState.leads.find(item => item.id === application.leadId)
      : undefined;
    if (!application || !lead) return;
    setPlacementDraft(current => ({
      ...current,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      branchId: application.branchId,
      subject: application.courseInterest,
    }));
  }, [applicationId, view]);

  const query = search.trim().toLowerCase();
  const filteredLeads = state.leads.filter(lead =>
    [lead.fullName, lead.email, lead.phone, lead.subject, lead.status]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
  const filteredApplications = state.applications.filter(application => {
    const lead = state.leads.find(item => item.id === application.leadId);
    const branch = state.branches.find(
      item => item.id === application.branchId
    );
    return [
      lead?.fullName,
      lead?.email,
      application.courseInterest,
      application.schedulePreference,
      branch?.name,
      application.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const filteredPlacements = state.placementTests.filter(booking => {
    const branch = state.branches.find(item => item.id === booking.branchId);
    return [
      booking.fullName,
      booking.email,
      booking.phone,
      booking.subject,
      booking.currentLevel,
      booking.recommendedLevel,
      branch?.name,
      booking.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const runRegistrarAction = async (
    actionKey: string,
    action: Parameters<typeof runPlatformWorkflowActionRequest>[0],
    successMessage: string,
    successDescription?: string
  ) => {
    setPendingAction(actionKey);
    try {
      const response = await runPlatformWorkflowActionRequest(action);
      if (!response.data) {
        throw new Error(
          response.error ?? "Registrar action returned no state."
        );
      }
      platformStore.setState(response.data.state);
      refresh();
      toast.success(
        successMessage,
        successDescription ? { description: successDescription } : undefined
      );
      return response.data.result;
    } catch (error) {
      toast.error("Registrar action could not be saved", {
        description:
          error instanceof Error
            ? error.message
            : "Check your session and try again.",
      });
      return undefined;
    } finally {
      setPendingAction("");
    }
  };

  const isActionPending = (key: string) => pendingAction === key;

  const createLead = async (event: FormEvent) => {
    event.preventDefault();
    if (!leadDraft.fullName.trim() || !leadDraft.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const sourceKey = crypto.randomUUID();
    const result = await runRegistrarAction(
      "lead.create",
      {
        type: "lead.create",
        branchId: state.branches[0]?.id,
        fullName: leadDraft.fullName.trim(),
        email:
          leadDraft.email.trim() ||
          `${Date.now().toString(36)}@nilelearn.local`,
        phone: leadDraft.phone.trim(),
        country: leadDraft.country.trim() || "Egypt",
        subject: leadDraft.subject.trim() || "Arabic Language",
        source: leadDraft.source,
        notes: leadDraft.notes.trim(),
        sourceKey,
        idempotencyKey: `lead.create:${sourceKey}`,
        actorId,
      },
      "Lead added to admissions"
    );
    if (result) {
      setLeadDraft({
        fullName: "",
        email: "",
        phone: "",
        country: "",
        subject: "Arabic Language",
        source: "manual",
        notes: "",
      });
      setCreationResult({
        message: "The enquiry has been added to the admissions queue.",
        href: "/app/registrar/leads",
        label: "View leads",
      });
    }
  };

  const convertLead = async (id: string) => {
    const lead = state.leads.find(item => item.id === id);
    await runRegistrarAction(
      `lead.convert:${id}`,
      {
        type: "lead.convert",
        leadId: id,
        actorId,
        expectedVersion: lead?.version ?? 1,
        idempotencyKey: `lead.convert:${id}`,
      },
      "Lead converted to application"
    );
  };

  const createApplication = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !applicationDraft.fullName.trim() ||
      !applicationDraft.email.trim() ||
      !applicationDraft.phone.trim()
    ) {
      toast.error("Applicant name, email, and phone are required");
      return;
    }
    const sourceKey = crypto.randomUUID();
    const result = await runRegistrarAction(
      "application.create",
      {
        type: "application.create",
        fullName: applicationDraft.fullName.trim(),
        email: applicationDraft.email.trim(),
        phone: applicationDraft.phone.trim(),
        branchId: applicationDraft.branchId,
        courseInterest:
          applicationDraft.courseInterest.trim() || "Arabic Language",
        schedulePreference:
          applicationDraft.schedulePreference.trim() || "To confirm",
        notes: applicationDraft.notes.trim() || undefined,
        country: "Egypt",
        source: "manual",
        sourceKey,
        idempotencyKey: `application.create:${sourceKey}`,
        actorId,
      },
      "Application created",
      "The application is ready for admissions review."
    );
    if (result) {
      setApplicationDraft(current => ({
        ...current,
        fullName: "",
        email: "",
        phone: "",
        notes: "",
      }));
      setCreationResult({
        message: "The application is ready for admissions review.",
        href: "/app/registrar/applications",
        label: "View applications",
      });
    }
  };

  const convertApplication = async (id: string) => {
    await runRegistrarAction(
      `application.convert:${id}`,
      { type: "application.convert", applicationId: id, actorId },
      "Application prepared for enrollment"
    );
  };

  const createPlacementBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !placementDraft.fullName.trim() ||
      !placementDraft.phone.trim() ||
      !placementDraft.preferredDate.trim()
    ) {
      toast.error("Name, phone, and date are required");
      return;
    }
    const sourceKey = crypto.randomUUID();
    const result = await runRegistrarAction(
      "placement.create",
      {
        type: "placement.create",
        fullName: placementDraft.fullName.trim(),
        email:
          placementDraft.email.trim() ||
          `${Date.now().toString(36)}@nilelearn.local`,
        phone: placementDraft.phone.trim(),
        branchId: placementDraft.branchId,
        subject: placementDraft.subject.trim() || "Arabic Language",
        preferredDate: placementDraft.preferredDate,
        currentLevel: placementDraft.currentLevel.trim() || "Placement pending",
        leadId: applicationId ? selectedApplicationLead?.id : undefined,
        sourceKey,
        idempotencyKey: `placement.create:${sourceKey}`,
        actorId,
      },
      "Placement booking added"
    );
    if (result && typeof result === "object" && "result" in result) {
      const booking = result.result as { id?: string } | undefined;
      if (booking?.id) setSelectedPlacementId(booking.id);
    }
    if (result) {
      setPlacementDraft(current => ({
        ...current,
        fullName: "",
        email: "",
        phone: "",
        subject: "Arabic Language",
        preferredDate: defaultPlacementDate(),
        currentLevel: "Placement pending",
      }));
      const booking =
        result && typeof result === "object" && "result" in result
          ? (result.result as { id?: string } | undefined)
          : undefined;
      setCreationResult({
        message: "The placement booking is ready for review.",
        href: booking?.id
          ? `/app/registrar/placement-tests/${booking.id}`
          : "/app/registrar/placement-tests",
        label: booking?.id ? "Open booking" : "View placement bookings",
      });
    }
  };

  const recordPlacement = async () => {
    if (!selectedPlacement) {
      toast.error("No placement booking selected");
      return;
    }
    await runRegistrarAction(
      `placement.result.record:${selectedPlacement.id}`,
      {
        type: "placement.result.record",
        bookingId: selectedPlacement.id,
        recommendedLevel: recommendedLevel.trim() || "Arabic Level 2",
        score: Math.max(0, Math.min(100, Number(score) || 0)),
        notes: "Recorded from registrar admissions workspace.",
        expectedVersion: selectedPlacement.version ?? 1,
        idempotencyKey: `placement.result.record:${selectedPlacement.id}`,
        actorId,
      },
      "Placement result recorded"
    );
  };

  const admissionsNavigation = (
    <>
      <Link
        className={view === "leads" || view === "lead-detail" ? "active" : ""}
        href="/app/registrar/leads"
      >
        Leads
      </Link>
      <Link
        className={
          view === "applications" || view === "application-detail"
            ? "active"
            : ""
        }
        href="/app/registrar/applications"
      >
        Applications
      </Link>
      <Link
        className={
          view === "placement-tests" || view === "placement-detail"
            ? "active"
            : ""
        }
        href="/app/registrar/placement-tests"
      >
        Placement
      </Link>
    </>
  );

  const admissionsToolbar = (
    <div className="registrar-admissions-toolbar-v3">
      <nav className="portal-simple-tabs" aria-label="Admissions work areas">
        {admissionsNavigation}
      </nav>
      <label className="platform-search-field">
        <Search size={16} />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search admissions records"
          aria-label="Search admissions records"
        />
      </label>
    </div>
  );

  const leadList = (
    <DataTableCard
      title="Lead records"
      subtitle={`${filteredLeads.length} visible lead(s)`}
      className="registrar-panel registrar-admissions-card"
    >
      <div className="registrar-lead-list">
        {filteredLeads.map(lead => {
          const converted = state.applications.some(
            application => application.leadId === lead.id
          );
          return (
            <article key={lead.id}>
              <div>
                <strong>{lead.fullName}</strong>
                <small>
                  {lead.subject} · {lead.phone} · {lead.source}
                </small>
              </div>
              <span>{statusLabel(lead.status)}</span>
              <Link
                className="registrar-row-link"
                href={`/app/registrar/leads/${lead.id}`}
              >
                Open
              </Link>
              <button
                type="button"
                disabled={converted || isAnyActionPending}
                onClick={() => convertLead(lead.id)}
              >
                {isActionPending(`lead.convert:${lead.id}`)
                  ? "Converting..."
                  : converted
                    ? "Converted"
                    : "Convert"}
              </button>
            </article>
          );
        })}
        {!filteredLeads.length ? (
          <article className="registrar-empty-row">
            <div>
              <strong>No leads match this view</strong>
              <small>Add a lead or clear the search.</small>
            </div>
          </article>
        ) : null}
      </div>
    </DataTableCard>
  );

  const leadForm = (
    <section className="registrar-panel">
      <div className="registrar-panel-head">
        <div>
          <span>Lead intake</span>
          <strong>Add one enquiry</strong>
        </div>
        <Link className="registrar-inline-close" href="/app/registrar/leads">
          Cancel
        </Link>
      </div>
      <form className="registrar-lead-form" onSubmit={createLead}>
        <label>
          Full name
          <input
            value={leadDraft.fullName}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            placeholder="Student or guardian name"
          />
        </label>
        <label>
          Phone
          <input
            value={leadDraft.phone}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                phone: event.target.value,
              }))
            }
            placeholder="+20..."
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={leadDraft.email}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="email@example.com"
          />
        </label>
        <label>
          Subject
          <input
            value={leadDraft.subject}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                subject: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Source
          <select
            value={leadDraft.source}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                source: event.target.value as Lead["source"],
              }))
            }
          >
            <option value="manual">Manual</option>
            <option value="website">Website</option>
            <option value="trial_form">Trial form</option>
            <option value="placement_form">Placement form</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label>
          Notes
          <input
            value={leadDraft.notes}
            onChange={event =>
              setLeadDraft(current => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Schedule, branch, or language notes"
          />
        </label>
        <button type="submit" disabled={isAnyActionPending}>
          <UserPlus size={15} />
          {isActionPending("lead.create") ? "Adding..." : "Add lead"}
        </button>
      </form>
    </section>
  );

  const applicationsList = (
    <DataTableCard
      title="Application files"
      subtitle={`${filteredApplications.length} visible application(s)`}
      className="registrar-panel registrar-admissions-card"
    >
      <div className="registrar-application-list">
        {filteredApplications.map(application => {
          const lead = state.leads.find(item => item.id === application.leadId);
          const branch = state.branches.find(
            item => item.id === application.branchId
          );
          const workflow = state.enrollmentWorkflows.find(
            item => item.applicationId === application.id
          );
          return (
            <article key={application.id}>
              <div>
                <strong>{lead?.fullName ?? application.id}</strong>
                <small>
                  {application.courseInterest} · {branch?.name ?? "No branch"} ·{" "}
                  {application.schedulePreference}
                </small>
              </div>
              <span>{statusLabel(application.status)}</span>
              <Link
                className="registrar-row-link"
                href={`/app/registrar/applications/${application.id}`}
              >
                Open
              </Link>
              <button
                type="button"
                disabled={Boolean(workflow) || isAnyActionPending}
                onClick={() => convertApplication(application.id)}
              >
                {isActionPending(`application.convert:${application.id}`)
                  ? "Preparing..."
                  : workflow
                    ? "Prepared"
                    : "Prepare"}
              </button>
            </article>
          );
        })}
        {!filteredApplications.length ? (
          <article className="registrar-empty-row">
            <div>
              <strong>No applications match this view</strong>
              <small>Create an application or clear the search.</small>
            </div>
          </article>
        ) : null}
      </div>
    </DataTableCard>
  );

  const applicationForm = (
    <section className="registrar-panel">
      <div className="registrar-panel-head">
        <div>
          <span>Application intake</span>
          <strong>Create one application file</strong>
        </div>
        <Link
          className="registrar-inline-close"
          href="/app/registrar/applications"
        >
          Cancel
        </Link>
      </div>
      <form
        className="registrar-application-form"
        onSubmit={createApplication}
        aria-label="Create registrar application"
      >
        <label>
          Applicant name
          <input
            name="applicationFullName"
            value={applicationDraft.fullName}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            placeholder="Student or guardian name"
          />
        </label>
        <label>
          Email
          <input
            name="applicationEmail"
            type="email"
            value={applicationDraft.email}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="applicant@nilelearn.local"
          />
        </label>
        <label>
          Phone
          <input
            name="applicationPhone"
            value={applicationDraft.phone}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                phone: event.target.value,
              }))
            }
            placeholder="+20..."
          />
        </label>
        <label>
          Branch
          <select
            name="applicationBranch"
            value={applicationDraft.branchId}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                branchId: event.target.value,
              }))
            }
          >
            {state.branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Course interest
          <input
            name="applicationCourseInterest"
            value={applicationDraft.courseInterest}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                courseInterest: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Schedule preference
          <input
            name="applicationSchedulePreference"
            value={applicationDraft.schedulePreference}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                schedulePreference: event.target.value,
              }))
            }
            placeholder="Morning, evening, weekend"
          />
        </label>
        <label className="wide">
          Notes
          <input
            name="applicationNotes"
            value={applicationDraft.notes}
            onChange={event =>
              setApplicationDraft(current => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Placement, guardian, schedule, or payment context"
          />
        </label>
        <button type="submit" disabled={isAnyActionPending}>
          <UserPlus size={15} />
          {isActionPending("application.create")
            ? "Creating..."
            : "Create application"}
        </button>
      </form>
    </section>
  );

  const placementList = (
    <DataTableCard
      title="Placement bookings"
      subtitle={`${filteredPlacements.length} visible booking(s)`}
      className="registrar-panel registrar-admissions-card"
    >
      <div className="registrar-application-list">
        {filteredPlacements.map(booking => {
          const branch = state.branches.find(
            item => item.id === booking.branchId
          );
          return (
            <article key={booking.id}>
              <div>
                <strong>{booking.fullName}</strong>
                <small>
                  {booking.subject} · {formatDate(booking.preferredDate)} ·{" "}
                  {branch?.name ?? "No branch"}
                </small>
              </div>
              <span>{statusLabel(booking.status)}</span>
              <Link
                className="registrar-row-link"
                href={`/app/registrar/placement-tests/${booking.id}`}
              >
                Open
              </Link>
              <StatusBadge tone={statusTone(booking.status)}>
                {booking.recommendedLevel ?? booking.currentLevel}
              </StatusBadge>
            </article>
          );
        })}
        {!filteredPlacements.length ? (
          <article className="registrar-empty-row">
            <div>
              <strong>No placement bookings match this view</strong>
              <small>Book a placement test or clear the search.</small>
            </div>
          </article>
        ) : null}
      </div>
    </DataTableCard>
  );

  const placementForm = (
    <section className="registrar-panel">
      <div className="registrar-panel-head">
        <div>
          <span>Placement booking</span>
          <strong>Book one test</strong>
        </div>
        <Link
          className="registrar-inline-close"
          href="/app/registrar/placement-tests"
        >
          Cancel
        </Link>
      </div>
      <form
        className="registrar-placement-booking-form"
        onSubmit={createPlacementBooking}
      >
        <label>
          Student name
          <input
            value={placementDraft.fullName}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                fullName: event.target.value,
              }))
            }
            placeholder="Student or guardian name"
          />
        </label>
        <label>
          Phone
          <input
            value={placementDraft.phone}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                phone: event.target.value,
              }))
            }
            placeholder="+20..."
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={placementDraft.email}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="optional"
          />
        </label>
        <label>
          Branch
          <select
            value={placementDraft.branchId}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                branchId: event.target.value,
              }))
            }
          >
            {state.branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <input
            value={placementDraft.subject}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                subject: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Preferred date
          <input
            type="date"
            value={placementDraft.preferredDate}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                preferredDate: event.target.value,
              }))
            }
          />
        </label>
        <label className="wide">
          Current level
          <input
            value={placementDraft.currentLevel}
            onChange={event =>
              setPlacementDraft(current => ({
                ...current,
                currentLevel: event.target.value,
              }))
            }
            placeholder="What the learner can already do"
          />
        </label>
        <button type="submit" disabled={isAnyActionPending}>
          <UserPlus size={15} />
          {isActionPending("placement.create")
            ? "Booking..."
            : "Book placement"}
        </button>
      </form>
    </section>
  );

  const placementResultCard = (
    <section className="registrar-panel registrar-placement-card">
      <div className="registrar-panel-head">
        <div>
          <span>Result</span>
          <strong>
            {selectedPlacement?.fullName ?? "No booking selected"}
          </strong>
        </div>
        <CheckCircle2 size={18} />
      </div>
      {!bookingId ? (
        <label>
          Booking
          <select
            value={selectedPlacement?.id ?? ""}
            onChange={event => setSelectedPlacementId(event.target.value)}
          >
            {state.placementTests.map(booking => (
              <option key={booking.id} value={booking.id}>
                {booking.fullName} · {booking.subject}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <small>
        {selectedPlacement
          ? `${formatDate(selectedPlacement.preferredDate)} · ${selectedPlacement.currentLevel} · ${selectedPlacement.status}`
          : "Create a placement booking first."}
      </small>
      <div className="registrar-placement-inputs">
        <label>
          Recommended level
          <input
            value={recommendedLevel}
            onChange={event => setRecommendedLevel(event.target.value)}
          />
        </label>
        <label>
          Score
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={event => setScore(Number(event.target.value))}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={
          !selectedPlacement ||
          selectedPlacement.status === "completed" ||
          isAnyActionPending
        }
        onClick={recordPlacement}
      >
        <CheckCircle2 size={15} />
        {isActionPending(`placement.result.record:${selectedPlacement?.id}`)
          ? "Saving result..."
          : selectedPlacement?.status === "completed"
            ? "Result recorded"
            : "Record placement result"}
      </button>
    </section>
  );

  if (
    view === "lead-create" ||
    view === "application-create" ||
    view === "placement-create"
  ) {
    const createConfig =
      view === "lead-create"
        ? {
            title: "New lead",
            description: "Capture one new enquiry for the admissions team.",
            form: leadForm,
          }
        : view === "application-create"
          ? {
              title: "New application",
              description: "Create one application file for admissions review.",
              form: applicationForm,
            }
          : {
              title: "Book placement",
              description: "Schedule one learner placement test.",
              form: placementForm,
            };

    return (
      <PlatformShell role="registrar" title={createConfig.title}>
        <FormFlowLayout
          className="registrar-admissions-page registrar-create-page"
          title={createConfig.title}
          description={createConfig.description}
          context="Registrar"
          actions={
            creationResult ? (
              <Link
                className="platform-primary-button"
                href={creationResult.href}
              >
                {creationResult.label}
              </Link>
            ) : undefined
          }
          main={
            creationResult ? (
              <section className="registrar-create-success" role="status">
                <CheckCircle2 size={20} />
                <div>
                  <strong>Saved</strong>
                  <span>{creationResult.message}</span>
                </div>
              </section>
            ) : (
              createConfig.form
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "lead-detail") {
    const missing = leadId && !selectedLead;
    return (
      <PlatformShell role="registrar" title="Lead detail">
        <DetailLayout
          title={selectedLead?.fullName ?? "Lead detail"}
          description="Review one enquiry and decide the next admissions action."
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/leads"
            >
              <ArrowRight size={15} />
              Back to leads
            </Link>
          }
          main={
            missing ? (
              <div className="registrar-detail-empty">
                <AlertCircle size={18} />
                <div>
                  <strong>This lead does not exist.</strong>
                  <small>Use the leads page to choose a valid record.</small>
                </div>
              </div>
            ) : (
              <section className="registrar-panel registrar-detail-focus">
                <div className="registrar-panel-head">
                  <div>
                    <span>Lead lifecycle</span>
                    <strong>{selectedLead?.fullName}</strong>
                  </div>
                  <Megaphone size={18} />
                </div>
                <div className="registrar-detail-grid">
                  <article>
                    <span>Status</span>
                    <strong>{selectedLead?.status}</strong>
                    <small>{selectedLead?.subject}</small>
                  </article>
                  <article>
                    <span>Contact</span>
                    <strong>{selectedLead?.phone}</strong>
                    <small>{selectedLead?.email}</small>
                  </article>
                  <article>
                    <span>Application</span>
                    <strong>
                      {selectedLeadApplication ? "Converted" : "Not converted"}
                    </strong>
                    <small>
                      {selectedLeadApplication?.courseInterest ??
                        selectedLead?.notes ??
                        "Ready for follow-up"}
                    </small>
                  </article>
                  <button
                    type="button"
                    disabled={
                      !selectedLead ||
                      Boolean(selectedLeadApplication) ||
                      isAnyActionPending
                    }
                    onClick={() => selectedLead && convertLead(selectedLead.id)}
                  >
                    <UserPlus size={15} />
                    {isActionPending(`lead.convert:${selectedLead?.id}`)
                      ? "Converting..."
                      : selectedLeadApplication
                        ? "Application exists"
                        : "Convert lead"}
                  </button>
                </div>
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "application-detail") {
    const missing = applicationId && !selectedApplication;
    return (
      <PlatformShell role="registrar" title="Application detail">
        <DetailLayout
          title={selectedApplicationLead?.fullName ?? "Application detail"}
          description="Review one application file and prepare enrollment when ready."
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/applications"
            >
              <ArrowRight size={15} />
              Back to applications
            </Link>
          }
          main={
            missing ? (
              <div className="registrar-detail-empty">
                <AlertCircle size={18} />
                <div>
                  <strong>This application does not exist.</strong>
                  <small>
                    Use the applications page to choose a valid file.
                  </small>
                </div>
              </div>
            ) : (
              <section className="registrar-panel registrar-detail-focus">
                <div className="registrar-panel-head">
                  <div>
                    <span>Application lifecycle</span>
                    <strong>{selectedApplicationLead?.fullName}</strong>
                  </div>
                  <FileText size={18} />
                </div>
                <div className="registrar-detail-grid">
                  <article>
                    <span>Status</span>
                    <strong>{selectedApplication?.status}</strong>
                    <small>{selectedApplication?.courseInterest}</small>
                  </article>
                  <article>
                    <span>Applicant</span>
                    <strong>{selectedApplicationLead?.phone}</strong>
                    <small>{selectedApplicationLead?.email}</small>
                  </article>
                  <article>
                    <span>Branch</span>
                    <strong>
                      {selectedApplicationBranch?.name ?? "No branch"}
                    </strong>
                    <small>{selectedApplication?.schedulePreference}</small>
                  </article>
                  <article>
                    <span>Enrollment handoff</span>
                    <strong>
                      {selectedApplicationWorkflow
                        ? "Prepared"
                        : "Not prepared"}
                    </strong>
                    <small>
                      {selectedApplicationWorkflow?.nextStep ??
                        "Prepare after branch, level, and course fit are confirmed."}
                    </small>
                  </article>
                  <button
                    type="button"
                    disabled={
                      !selectedApplication ||
                      Boolean(selectedApplicationWorkflow) ||
                      isAnyActionPending
                    }
                    onClick={() =>
                      selectedApplication &&
                      convertApplication(selectedApplication.id)
                    }
                  >
                    <UserPlus size={15} />
                    {isActionPending(
                      `application.convert:${selectedApplication?.id}`
                    )
                      ? "Preparing..."
                      : selectedApplicationWorkflow
                        ? "Enrollment prepared"
                        : "Prepare enrollment"}
                  </button>
                  <Link
                    className="registrar-row-link"
                    href="/app/registrar/enrollments"
                  >
                    <ArrowRight size={15} />
                    Open handoff
                  </Link>
                  <Link
                    className="registrar-row-link"
                    href={`/app/registrar/applications/${selectedApplication?.id}/placement`}
                  >
                    <ClipboardList size={15} />
                    Book placement
                  </Link>
                </div>
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "placement-detail") {
    const missing = bookingId && !selectedPlacement;
    return (
      <PlatformShell role="registrar" title="Placement detail">
        <DetailLayout
          title={selectedPlacement?.fullName ?? "Placement detail"}
          description="Record one placement result and prepare the enrollment handoff."
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/placement-tests"
            >
              <ArrowRight size={15} />
              Back to placement
            </Link>
          }
          main={
            missing ? (
              <div className="registrar-detail-empty">
                <AlertCircle size={18} />
                <div>
                  <strong>This placement booking does not exist.</strong>
                  <small>
                    Use the placement page to choose a valid booking.
                  </small>
                </div>
              </div>
            ) : (
              <section className="registrar-panel registrar-detail-focus">
                <div className="registrar-panel-head">
                  <div>
                    <span>Placement lifecycle</span>
                    <strong>{selectedPlacement?.fullName}</strong>
                  </div>
                  <ClipboardList size={18} />
                </div>
                <div className="registrar-detail-grid">
                  <article>
                    <span>Booking</span>
                    <strong>{selectedPlacement?.subject}</strong>
                    <small>
                      {formatDate(selectedPlacement?.preferredDate)} ·{" "}
                      {selectedPlacement?.currentLevel}
                    </small>
                  </article>
                  <article>
                    <span>Status</span>
                    <strong>{selectedPlacement?.status}</strong>
                    <small>
                      {selectedPlacementResult
                        ? `${selectedPlacementResult.score}/100`
                        : "Result pending"}
                    </small>
                  </article>
                  <article>
                    <span>Recommended level</span>
                    <strong>
                      {selectedPlacement?.recommendedLevel ??
                        selectedPlacementResult?.recommendedLevel ??
                        "Not recorded"}
                    </strong>
                    <small>
                      {selectedPlacementWorkflow?.nextStep ??
                        "Record a result to prepare enrollment."}
                    </small>
                  </article>
                </div>
                {placementResultCard}
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "applications") {
    return (
      <PlatformShell role="registrar" title="Applications">
        <WorkspaceLayout
          title="Applications"
          description="Review application files and prepare enrollment."
          context="Registrar"
          actions={
            <Link
              className="platform-primary-button"
              href="/app/registrar/applications/new"
            >
              <UserPlus size={15} />
              New application
            </Link>
          }
          toolbar={admissionsToolbar}
          main={applicationsList}
          className="registrar-workspace registrar-admissions-page"
        />
      </PlatformShell>
    );
  }

  if (view === "placement-tests") {
    return (
      <PlatformShell role="registrar" title="Placement tests">
        <WorkspaceLayout
          title="Placement tests"
          description="Review scheduled placement tests and learner levels."
          context="Registrar"
          actions={
            <Link
              className="platform-primary-button"
              href="/app/registrar/placement-tests/new"
            >
              <UserPlus size={15} />
              Book placement
            </Link>
          }
          toolbar={admissionsToolbar}
          main={placementList}
          className="registrar-workspace registrar-admissions-page"
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="registrar" title="Leads">
      <WorkspaceLayout
        title="Leads"
        description="Review enquiries and convert ready contacts."
        context="Registrar"
        actions={
          <Link
            className="platform-primary-button"
            href="/app/registrar/leads/new"
          >
            <UserPlus size={15} />
            Add lead
          </Link>
        }
        toolbar={admissionsToolbar}
        main={leadList}
        className="registrar-workspace registrar-admissions-page"
      />
    </PlatformShell>
  );
}
