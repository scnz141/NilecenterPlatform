import { useEffect, useState } from "react";
import { Spinner } from "@/staff/ui/kit";
import {
  disconnectNccMoodleSiteRequest,
  fetchNccMoodleSiteRequest,
  saveNccMoodleSiteRequest,
  testNccMoodleSiteRequest,
  type NccMoodleSiteDto,
  type NccMoodleSiteTestDto,
} from "@/lib/backend/api";
import { staffWrite } from "../api";
import { copy } from "../copy";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
} from "../ui/primitives";
import { formatDate } from "./catalog-shared";

const C = copy.moodleSite;

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="staff-muted">{label}</dt>
      <dd className="break-words">{value ?? copy.state.notSet}</dd>
    </div>
  );
}

function yesNo(value: boolean | null) {
  if (value === null) return C.unknown;
  return value ? C.yes : C.no;
}

export default function MoodleSitePage() {
  const { session } = useStaffSession();
  const isSuperAdmin = session?.ncc?.activeRole === "super_admin";

  const [site, setSite] = useState<NccMoodleSiteDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [token, setToken] = useState("");
  const [autoCreate, setAutoCreate] = useState(false);
  const [ptCourse, setPtCourse] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<NccMoodleSiteTestDto | null>(
    null
  );
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await staffWrite(fetchNccMoodleSiteRequest());
      setSite(data.site);
      setSiteUrl(data.site.siteUrl ?? "");
      setAutoCreate(data.site.autoCreateStudentMoodle);
      setPtCourse(
        data.site.placementTestMoodleCourseId !== null
          ? String(data.site.placementTestMoodleCourseId)
          : ""
      );
      setToken("");
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <EmptyState title={copy.shell.noAccess} description={C.noAccess} />
    );
  }
  if (error) {
    return <ErrorState error={error} onRetry={() => void load()} />;
  }
  if (loading || !site) {
    return <LoadingRows />;
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const trimmed = siteUrl.trim();
      const pt = ptCourse.trim();
      await runAction(async () => {
        const result = await staffWrite(
          saveNccMoodleSiteRequest({
            configured: site!.configured,
            siteUrl: trimmed,
            wsToken: token || undefined,
            autoCreateStudentMoodle: autoCreate,
            placementTestMoodleCourseId: pt === "" ? null : Number(pt),
          })
        );
        setSite(result.site);
        setToken("");
        return result;
      }, { success: C.saved });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      await runAction(async () => {
        const result = await staffWrite(testNccMoodleSiteRequest());
        setTestResult(result.result);
        return result;
      });
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      await runAction(async () => {
        const result = await staffWrite(disconnectNccMoodleSiteRequest());
        setSite(result.site);
        setToken("");
        setSiteUrl("");
        setTestResult(null);
        return result;
      }, { success: C.disconnected });
    } finally {
      setDisconnecting(false);
    }
  }

  const ptInvalid =
    ptCourse.trim() !== "" && !/^\d+$/.test(ptCourse.trim());

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="staff-page-header">{C.title}</h1>
        <p className="staff-muted max-w-prose">{C.description}</p>
      </header>

      <section className="staff-card">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{C.statusTitle}</h2>
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {copy.actions.refresh}
          </button>
        </div>
        <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Field
            label={C.statConfigured}
            value={yesNo(site.configured)}
          />
          <Field label={C.statToken} value={yesNo(site.hasToken)} />
          <Field label={C.statReachable} value={yesNo(site.reachable)} />
          <Field
            label={C.statVersion}
            value={yesNo(site.versionExpected)}
          />
          <Field label={C.statSitename} value={site.sitename} />
          <Field label={C.statRelease} value={site.release} />
          <Field
            label={C.statLastChecked}
            value={
              site.lastCheckedAt ? formatDate(site.lastCheckedAt) : null
            }
          />
          <Field label={C.statLastError} value={site.lastError} />
        </dl>
        {site.warnings.length > 0 ? (
          <p className="staff-muted mt-3" role="status">
            {C.statWarnings}: {site.warnings.join(" ")}
          </p>
        ) : null}
      </section>

      <section className="staff-card">
        <h2 className="text-base font-semibold">{C.connection}</h2>
        <p className="staff-muted mt-1">{C.connectionHint}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="staff-field-label">{C.siteUrl}</span>
            <input
              className="staff-input w-full"
              type="url"
              value={siteUrl}
              onChange={event => setSiteUrl(event.target.value)}
              placeholder="https://moodle.example.com"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="staff-field-label">{C.token}</span>
            <input
              className="staff-input w-full"
              type="password"
              autoComplete="new-password"
              value={token}
              onChange={event => setToken(event.target.value)}
              placeholder={site.configured ? C.tokenKeep : ""}
            />
            <span className="staff-muted">
              {site.configured ? C.tokenKeep : C.tokenHint}
            </span>
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={autoCreate}
              onChange={event => setAutoCreate(event.target.checked)}
            />
            <span>{C.autoCreate}</span>
          </label>
          <p className="staff-muted sm:col-span-2">{C.autoCreateHint}</p>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="staff-field-label">{C.ptCourse}</span>
            <input
              className="staff-input w-full"
              inputMode="numeric"
              value={ptCourse}
              onChange={event => setPtCourse(event.target.value)}
            />
            <span className="staff-muted">{C.ptCourseHint}</span>
            {ptInvalid ? (
              <span className="staff-field-error">
                {copy.catalog.shared.sortOrder}
              </span>
            ) : null}
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            onClick={() => void save()}
            disabled={
              saving ||
              !siteUrl.trim() ||
              (!site.configured && !token) ||
              ptInvalid
            }
          >
            {saving ? (
              <Spinner aria-hidden />
            ) : null}
            {site.configured ? C.save : C.connect}
          </button>
          <button
            type="button"
            className="staff-btn"
            onClick={() => void test()}
            disabled={testing || !site.configured}
          >
            {testing ? (
              <Spinner aria-hidden />
            ) : null}
            {C.test}
          </button>
          {site.configured ? (
            <button
              type="button"
              className="staff-btn"
              data-variant="destructive-outline"
              onClick={() => setConfirmDisconnect(true)}
              disabled={disconnecting}
            >
              {C.disconnect}
            </button>
          ) : null}
        </div>

        {testResult ? (
          <div
            className="staff-banner mt-3"
            data-tone={testResult.reachable ? "success" : "error"}
            role="status"
          >
            <strong>
              {testResult.reachable
                ? testResult.versionExpected === false
                  ? C.testVersionWarn
                  : C.testOk
                : C.testFailed}
            </strong>
            <span className="staff-muted block">
              {[
                testResult.sitename,
                testResult.release,
                testResult.error,
                ...testResult.warnings,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={C.disconnectTitle}
        description={C.disconnectBody}
        confirmLabel={C.disconnect}
        destructive
        onConfirm={() => {
          setConfirmDisconnect(false);
          void disconnect();
        }}
      />
    </div>
  );
}
