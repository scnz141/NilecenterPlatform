import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { SettingsLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import { requireActiveUser } from "@/lib/auth/session";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type {
  StaffAvailabilityStatus,
  TeacherAvailability,
} from "@/lib/domain/types";

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type DayDraft = {
  enabled: boolean;
  startsAt: string;
  endsAt: string;
};

function initialSchedule(
  slots: TeacherAvailability[]
): Record<(typeof weekdays)[number], DayDraft> {
  return Object.fromEntries(
    weekdays.map(weekday => {
      const slot = slots.find(item => item.weekday === weekday);
      return [
        weekday,
        {
          enabled: Boolean(slot),
          startsAt: slot?.startsAt ?? "09:00",
          endsAt: slot?.endsAt ?? "17:00",
        },
      ];
    })
  ) as Record<(typeof weekdays)[number], DayDraft>;
}

export default function TeacherAvailabilityPage() {
  const [state, setState] = useState(() => platformStore.getState());
  const teacherId = requireActiveUser("teacher").id;
  const teacher = state.teachers.find(item => item.userId === teacherId);
  const staff = state.staffProfiles.find(
    item => item.userId === teacherId && item.role === "teacher"
  );
  const branchId = teacher?.branchId ?? staff?.branchIds[0];
  const branch = state.branches.find(item => item.id === branchId);
  const currentSlots = useMemo(
    () =>
      state.teacherAvailability.filter(
        item => item.teacherId === teacherId && item.branchId === branchId
      ),
    [branchId, state.teacherAvailability, teacherId]
  );
  const [status, setStatus] = useState<
    Extract<StaffAvailabilityStatus, "available" | "limited" | "unavailable">
  >(
    teacher?.availabilityStatus === "unavailable" ||
      teacher?.availabilityStatus === "limited"
      ? teacher.availabilityStatus
      : "available"
  );
  const [schedule, setSchedule] = useState(() => initialSchedule(currentSlots));
  const [saving, setSaving] = useState(false);

  const activeDays = weekdays.filter(weekday => schedule[weekday].enabled);

  const saveAvailability = async () => {
    if (!branchId) {
      toast.error("Availability cannot be saved", {
        description: "Your teacher account does not have a branch.",
      });
      return;
    }
    if (status === "available" && !activeDays.length) {
      toast.error("Choose at least one available day");
      return;
    }
    const slots =
      status === "unavailable"
        ? []
        : activeDays.map(weekday => ({
            weekday,
            startsAt: schedule[weekday].startsAt,
            endsAt: schedule[weekday].endsAt,
          }));
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "teacher.availability.update",
      teacherId,
      branchId,
      availabilityStatus: status,
      slots,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      toast.error("Availability was not saved", {
        description: response.error ?? "Check the schedule and try again.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setState(response.data.state);
    toast.success("Availability saved");
  };

  if (!teacher || !staff || !branchId) {
    return (
      <PlatformShell role="teacher" title="Availability">
        <SettingsLayout
          className="teacher-availability-page"
          title="Teaching availability"
          description="Set the weekly times when classes can be scheduled."
          main={
            <div className="platform-empty-state" role="alert">
              <CalendarClock size={22} />
              <strong>Teacher scope is incomplete</strong>
              <span>
                Ask an administrator to assign your branch and teacher profile.
              </span>
            </div>
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="teacher" title="Availability">
      <SettingsLayout
        className="teacher-availability-page"
        title="Teaching availability"
        description="Set the weekly times when classes can be scheduled."
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={saveAvailability}
            disabled={saving}
            data-testid="teacher-availability-save"
          >
            <Save size={15} />
            {saving ? "Saving" : "Save availability"}
          </button>
        }
        main={
          <div className="teacher-availability-workspace">
            <section className="teacher-availability-summary">
              <div>
                <span>Teaching branch</span>
                <strong>{branch?.name ?? "Assigned branch"}</strong>
              </div>
              <StatusBadge
                tone={
                  status === "available"
                    ? "green"
                    : status === "limited"
                      ? "amber"
                      : "red"
                }
              >
                {status}
              </StatusBadge>
            </section>

            <section
              className="teacher-availability-status"
              aria-labelledby="availability-status-heading"
            >
              <div>
                <span>Current status</span>
                <h2 id="availability-status-heading">
                  Can new classes be scheduled?
                </h2>
              </div>
              <div className="teacher-availability-status-options">
                {(["available", "limited", "unavailable"] as const).map(
                  option => (
                    <label key={option}>
                      <input
                        type="radio"
                        name="availability-status"
                        value={option}
                        checked={status === option}
                        onChange={() => setStatus(option)}
                      />
                      <span>{option}</span>
                    </label>
                  )
                )}
              </div>
            </section>

            <section className="teacher-availability-week">
              <div className="teacher-availability-week-heading">
                <div>
                  <span>Weekly schedule</span>
                  <h2>Available teaching hours</h2>
                </div>
                <span>
                  {status === "unavailable" ? 0 : activeDays.length} days
                </span>
              </div>
              <div className="teacher-availability-days">
                {weekdays.map(weekday => {
                  const day = schedule[weekday];
                  const disabled = status === "unavailable";
                  return (
                    <div
                      className="teacher-availability-day"
                      key={weekday}
                      data-enabled={!disabled && day.enabled}
                    >
                      <label className="teacher-availability-day-toggle">
                        <input
                          type="checkbox"
                          checked={!disabled && day.enabled}
                          disabled={disabled}
                          onChange={event =>
                            setSchedule(value => ({
                              ...value,
                              [weekday]: {
                                ...value[weekday],
                                enabled: event.target.checked,
                              },
                            }))
                          }
                        />
                        <span>{weekday}</span>
                      </label>
                      <label>
                        Starts
                        <input
                          type="time"
                          value={day.startsAt}
                          disabled={disabled || !day.enabled}
                          onChange={event =>
                            setSchedule(value => ({
                              ...value,
                              [weekday]: {
                                ...value[weekday],
                                startsAt: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Ends
                        <input
                          type="time"
                          value={day.endsAt}
                          disabled={disabled || !day.enabled}
                          onChange={event =>
                            setSchedule(value => ({
                              ...value,
                              [weekday]: {
                                ...value[weekday],
                                endsAt: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      {!disabled && day.enabled ? (
                        <CheckCircle2 size={17} aria-label="Day enabled" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        }
      />
    </PlatformShell>
  );
}
