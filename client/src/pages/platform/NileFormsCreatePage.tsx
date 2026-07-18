import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  FilePenLine,
  Languages,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  createFormDefinitionRequest,
  fetchFormManagementOptions,
} from "@/lib/forms/api";
import {
  formCategoriesForRole,
  formCategoryLabels,
} from "@/lib/forms/management";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import type { FormManagementOptions } from "@shared/nileForms";
import {
  nileFormsTemplateCatalog,
  type NileFormsTemplateKey,
} from "@shared/nileFormsTemplateCatalog";

export default function NileFormsCreatePage({ role }: { role: Role }) {
  const [, navigate] = useLocation();
  const categories = formCategoriesForRole(role);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [options, setOptions] = useState<FormManagementOptions>({
    roles: [],
    users: [],
    branches: [],
    departments: [],
    courses: [],
    classes: [],
  });
  const [draft, setDraft] = useState({
    key: "",
    titleEn: "",
    titleAr: "",
    titleTr: "",
    templateKey: "" as "" | NileFormsTemplateKey,
    category: categories[0],
    branchId: "",
    departmentId: "",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError("");
      const response = await fetchFormManagementOptions();
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setError(response.error ?? "Form scope options could not be loaded.");
        return;
      }
      setOptions(response.data);
      setDraft(current => ({
        ...current,
        branchId: current.branchId || response.data!.branches[0]?.id || "",
        departmentId:
          current.departmentId || response.data!.departments[0]?.id || "",
      }));
      setStatus("ready");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const createDefinition = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await createFormDefinitionRequest({
      key: draft.key,
      titleEn: draft.titleEn,
      titleAr: draft.titleAr,
      titleTr: draft.titleTr,
      templateKey: draft.templateKey || undefined,
      category: draft.category,
      branchId:
        role === "registrar" || role === "branchadmin"
          ? draft.branchId
          : role === "headofdepartment"
            ? draft.branchId || undefined
            : undefined,
      departmentId:
        role === "headofdepartment" ? draft.departmentId : undefined,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The form definition could not be created.");
      return;
    }
    navigate(
      formsRoute(role, `/manage/${response.data.definition.id}/builder`)
    );
  };

  return (
    <PlatformShell role={role} title="New form">
      <div className="nile-forms-page">
        <NileFormsNavigation role={role} />
        <header className="nile-forms-page-header compact">
          <div>
            <Link
              href={formsRoute(role, "/manage")}
              className="nile-forms-back-link"
            >
              <ArrowLeft size={15} /> Manage forms
            </Link>
            <span className="nile-forms-eyebrow">Definition</span>
            <h1>New form</h1>
          </div>
        </header>

        {status === "loading" ? (
          <section className="nile-forms-state" aria-live="polite">
            <span className="nile-forms-spinner" />
            <strong>Loading form scope</strong>
          </section>
        ) : status === "error" ? (
          <section className="nile-forms-state" role="alert">
            <FilePenLine size={24} />
            <strong>Form scope unavailable</strong>
            <p>{error}</p>
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => setReload(value => value + 1)}
            >
              <RefreshCw size={15} /> Retry
            </button>
          </section>
        ) : (
          <section className="nile-form-create-panel">
            <form onSubmit={createDefinition} aria-busy={saving}>
              <label>
                Starting point
                <select
                  value={draft.templateKey}
                  onChange={event => {
                    const templateKey = event.target.value as
                      | ""
                      | NileFormsTemplateKey;
                    const template = nileFormsTemplateCatalog.find(
                      item => item.key === templateKey
                    );
                    setDraft(current => ({
                      ...current,
                      templateKey,
                      titleEn: template?.title.en ?? current.titleEn,
                      titleAr: template?.title.ar ?? current.titleAr,
                      titleTr: template?.title.tr ?? current.titleTr,
                    }));
                  }}
                >
                  <option value="">Blank form</option>
                  {nileFormsTemplateCatalog
                    .filter(template => template.category === draft.category)
                    .map(template => (
                      <option key={template.key} value={template.key}>
                        {template.title.en}
                      </option>
                    ))}
                </select>
                <small>
                  Templates are copied into a new independent draft.
                </small>
              </label>
              <label>
                English title
                <input
                  autoFocus
                  required
                  value={draft.titleEn}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      titleEn: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Turkish title
                <input
                  required
                  value={draft.titleTr}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      titleTr: event.target.value,
                    }))
                  }
                />
              </label>
              <label dir="rtl">
                العنوان بالعربية
                <input
                  required
                  value={draft.titleAr}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      titleAr: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Form key
                <input
                  required
                  pattern="[a-z][a-z0-9_:-]{2,79}"
                  value={draft.key}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      key: event.target.value
                        .toLowerCase()
                        .replaceAll(" ", "_"),
                    }))
                  }
                  placeholder="student_feedback"
                />
              </label>
              <label>
                Category
                <select
                  value={draft.category}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      category: event.target
                        .value as (typeof categories)[number],
                      templateKey: "",
                    }))
                  }
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {formCategoryLabels[category]}
                    </option>
                  ))}
                </select>
              </label>
              {role === "registrar" ||
              role === "branchadmin" ||
              role === "headofdepartment" ? (
                <label>
                  Branch
                  <select
                    required={role !== "headofdepartment"}
                    value={draft.branchId}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        branchId: event.target.value,
                      }))
                    }
                  >
                    {role === "headofdepartment" ? (
                      <option value="">All assigned branches</option>
                    ) : null}
                    {options.branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {role === "headofdepartment" ? (
                <label>
                  Department
                  <select
                    required
                    value={draft.departmentId}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        departmentId: event.target.value,
                      }))
                    }
                  >
                    {options.departments.map(department => (
                      <option key={department.id} value={department.id}>
                        {department.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {error ? (
                <p className="nile-form-field-error" role="alert">
                  {error}
                </p>
              ) : null}
              <footer>
                <span>
                  <Languages size={15} /> English, Arabic, and Turkish
                </span>
                <div>
                  <Link
                    href={formsRoute(role, "/manage")}
                    className="platform-secondary-button"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    className="platform-primary-button"
                    disabled={saving}
                  >
                    <Plus size={15} />
                    {saving ? "Creating" : "Create form"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        )}
      </div>
    </PlatformShell>
  );
}
