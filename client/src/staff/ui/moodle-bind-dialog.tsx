import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/staff/ui/kit";
import { Spinner } from "@/staff/ui/kit";
import { fetchNccMoodleUsersRequest, type NccMoodleUserDto } from "@/lib/backend/api";
import { copy } from "../copy";
import { ActiveMark } from "./primitives";

/**
 * Create or link a Moodle account for one staff user. `link` mode searches the
 * Moodle user directory (min 2 characters) and requires a selection.
 */
export function MoodleBindDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (bind: { mode: "create" } | { mode: "link"; moodleUserId: number }) => Promise<void> | void;
}) {
  const C = copy.staffUsers;
  const [mode, setMode] = useState<"create" | "link">("create");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NccMoodleUserDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("create");
      setQuery("");
      setResults([]);
      setSelectedId(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "link" || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetchNccMoodleUsersRequest(query.trim());
        if (!cancelled) {
          setResults(result.ok ? result.data?.items ?? [] : []);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, mode, query]);

  async function submit() {
    if (submitting) return;
    if (mode === "link" && selectedId === null) return;
    setSubmitting(true);
    try {
      await onConfirm(
        mode === "create"
          ? { mode: "create" }
          : { mode: "link", moodleUserId: selectedId as number }
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{C.moodleAccount}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? C.moodleCreateHint : C.moodleLinkHint}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="staff-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className="staff-tab"
              data-active={mode === "create"}
              onClick={() => setMode("create")}
            >
              {mode === "create" ? <ActiveMark group="moodle-mode" /> : null}
              {C.moodleCreate}
            </button>
            <button
              type="button"
              role="tab"
              className="staff-tab"
              data-active={mode === "link"}
              onClick={() => setMode("link")}
            >
              {mode === "link" ? <ActiveMark group="moodle-mode" /> : null}
              {C.moodleLink}
            </button>
          </div>
          {mode === "link" ? (
            <div className="staff-field">
              <label htmlFor="staff-moodle-search">{C.moodleSearch}</label>
              <input
                id="staff-moodle-search"
                className="staff-input"
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setSelectedId(null);
                }}
                placeholder={C.moodleSearchHint}
                autoComplete="off"
              />
              {query.trim().length < 2 ? (
                <span className="staff-muted text-xs">{C.moodleSearchMin}</span>
              ) : searching ? (
                <span className="staff-muted text-xs flex items-center gap-1.5">
                  <Spinner aria-hidden />
                  {copy.state.loading}
                </span>
              ) : results.length === 0 ? (
                <span className="staff-muted text-xs">{C.moodleSearchEmpty}</span>
              ) : (
                <ul className="staff-menu static max-h-48 overflow-y-auto">
                  {results.map(user => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="staff-menu-item w-full text-start"
                        data-selected={selectedId === user.id}
                        onClick={() => setSelectedId(user.id)}
                      >
                        <span className="truncate">
                          {user.fullName ||
                            [user.firstName, user.lastName]
                              .filter(Boolean)
                              .join(" ") ||
                            user.username ||
                            `#${user.id}`}
                        </span>
                        {user.email ? (
                          <span className="staff-muted block text-xs truncate">
                            {user.email}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <button
            type="button"
            className="staff-btn"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            {copy.actions.cancel}
          </button>
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            disabled={submitting || (mode === "link" && selectedId === null)}
            onClick={() => void submit()}
          >
            {submitting ? (
              <Spinner aria-hidden />
            ) : null}
            {mode === "create" ? C.moodleCreate : C.moodleLink}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
