import "@/styles/nile-forms.css";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { formContentHasRecordLinks, type FormField, type FormFieldType, type FormPage, type FormVersion, type FormVersionContent } from "@shared/nileForms";
import NileFormRenderer from "@/components/forms/NileFormRenderer";
import { updateFormDraftVersionRequest } from "@/lib/forms/api";
import type { FormDefinitionBundle } from "../../../../server/nileFormsService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/staff/ui/kit";
import { copy } from "../copy";
import {
  CHOICE_TYPES,
  DISPLAY_TYPES,
  branchChoices,
  FIELD_GROUPS,
  contentProblems,
  fieldsInUse,
  moveItem,
  withTurkishFallback,
  newField,
  uid,
} from "../forms/model";
import { formsWrite } from "../forms/write";
import { runAction } from "../run-action";
import { useBranches } from "./admissions-ui";

const F = copy.forms;

type Updater = (content: FormVersionContent) => FormVersionContent;

function updateField(content: FormVersionContent, pageIndex: number, fieldId: string, patch: Partial<FormField>) {
  return {
    ...content,
    pages: content.pages.map((page, index) =>
      index === pageIndex
        ? { ...page, fields: page.fields.map(field => (field.id === fieldId ? { ...field, ...patch } : field)) }
        : page
    ),
  };
}

function updatePage(content: FormVersionContent, pageIndex: number, update: (page: FormPage) => FormPage) {
  return { ...content, pages: content.pages.map((page, index) => (index === pageIndex ? update(page) : page)) };
}

/* ---------------- One question -------------------------------------- */

function FieldCard({
  field,
  index,
  count,
  selected,
  locked,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  field: FormField;
  index: number;
  count: number;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<FormField>) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const display = DISPLAY_TYPES.has(field.type);
  const options = field.options ?? [];
  const branches = useBranches();
  const setOption = (optionId: string, lang: "en" | "ar", value: string) =>
    onChange({
      options: options.map(option =>
        option.id === optionId ? { ...option, label: { ...option.label, [lang]: value } } : option
      ),
    });

  if (!selected) {
    return (
      <button type="button" className="staff-q-card" onClick={onSelect}>
        <span className="staff-q-type">
          {F.types[field.type]}
          {field.type === "entity_reference" ? <span className="staff-text-caution"> · {F.needsAttention}</span> : null}
        </span>
        <span className="staff-q-label">
          {field.label.en || <span className="staff-muted">{F.question}</span>}
          {field.required ? <span className="staff-q-required" aria-label={F.required}> *</span> : null}
        </span>
        {CHOICE_TYPES.has(field.type) ? (
          <span className="staff-muted staff-q-options">{options.map(option => option.label.en).join(" · ")}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="staff-q-card" data-selected>
      <div className="staff-q-head">
        <span className="staff-q-type">{F.types[field.type]}</span>
        <span className="staff-q-tools">
          <button type="button" className="staff-icon-btn" aria-label={F.moveUp} title={F.moveUp} disabled={index === 0} onClick={() => onMove(index - 1)}>
            <ArrowUp strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" className="staff-icon-btn" aria-label={F.moveDown} title={F.moveDown} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
            <ArrowDown strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" className="staff-icon-btn" aria-label={F.duplicate} title={F.duplicate} onClick={onDuplicate}>
            <Copy strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            className="staff-icon-btn"
            aria-label={F.remove}
            title={locked ? F.usedByLogic : F.remove}
            disabled={locked}
            onClick={onRemove}
          >
            <Trash2 strokeWidth={1.75} aria-hidden />
          </button>
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="staff-field">
          <span className="staff-field-label">{F.questionEn}</span>
          <input
            className="staff-input"
            value={field.label.en}
            autoFocus={!field.label.en}
            onChange={event => onChange({ label: { ...field.label, en: event.target.value } })}
          />
        </label>
        <label className="staff-field">
          <span className="staff-field-label">{F.questionAr}</span>
          <input
            className="staff-input"
            dir="rtl"
            value={field.label.ar}
            onChange={event => onChange({ label: { ...field.label, ar: event.target.value } })}
          />
        </label>
      </div>
      <label className="staff-field">
        <span className="staff-field-label">{F.help}</span>
        <input
          className="staff-input"
          value={field.description?.en ?? ""}
          onChange={event =>
            onChange({
              description: event.target.value
                ? { en: event.target.value, ar: field.description?.ar ?? "" }
                : undefined,
            })
          }
        />
      </label>
      {field.type === "entity_reference" ? (
        <div className="staff-banner" data-tone="caution">
          <span>{F.recordLinkNote}</span>
          {field.entityType === "branch" && branches.active.length ? (
            <button
              type="button"
              className="staff-btn"
              data-size="sm"
              onClick={() => onChange({ type: "single_choice", entityType: undefined, options: branchChoices(branches.active) })}
            >
              {F.useBranchList}
            </button>
          ) : null}
        </div>
      ) : null}
      {CHOICE_TYPES.has(field.type) ? (
        <fieldset className="staff-field">
          <legend className="staff-field-label">{F.options}</legend>
          <ul className="staff-q-option-list">
            {options.map((option, optionIndex) => (
              <li key={option.id} className="staff-q-option">
                <input
                  className="staff-input"
                  aria-label={`${F.optionEn} ${optionIndex + 1}`}
                  value={option.label.en}
                  onChange={event => setOption(option.id, "en", event.target.value)}
                />
                <input
                  className="staff-input"
                  dir="rtl"
                  aria-label={`${F.optionAr} ${optionIndex + 1}`}
                  value={option.label.ar}
                  onChange={event => setOption(option.id, "ar", event.target.value)}
                />
                <button
                  type="button"
                  className="staff-icon-btn"
                  aria-label={F.remove}
                  disabled={options.length <= 1}
                  onClick={() => onChange({ options: options.filter(item => item.id !== option.id) })}
                >
                  <Trash2 strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="staff-btn w-fit"
            data-size="sm"
            onClick={() =>
              onChange({
                options: [
                  ...options,
                  { id: uid("opt"), label: { en: `Option ${options.length + 1}`, ar: `الخيار ${options.length + 1}` } },
                ],
              })
            }
          >
            <Plus strokeWidth={1.75} aria-hidden />
            {F.addOption}
          </button>
        </fieldset>
      ) : null}
      {!display ? (
        <label className="staff-check">
          <input type="checkbox" checked={Boolean(field.required)} onChange={event => onChange({ required: event.target.checked })} />
          {F.required}
        </label>
      ) : null}
    </div>
  );
}

/* ---------------- Builder ------------------------------------------- */

export function FormBuilder({
  bundle,
  draft,
  onSaved,
  onDirtyChange,
}: {
  bundle: FormDefinitionBundle;
  draft: FormVersion;
  onSaved: () => Promise<unknown>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [content, setContent] = useState<FormVersionContent>(draft.content);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    setContent(draft.content);
    setAttempted(false);
  }, [draft.id, draft.revision, draft.content]);

  const dirty = JSON.stringify(content) !== JSON.stringify(draft.content);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  // Leaving the page with unsaved work asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const used = useMemo(() => fieldsInUse(content), [content]);
  const problems = contentProblems(content);
  const change = (update: Updater) => setContent(current => update(current));

  function addField(pageIndex: number, type: FormFieldType) {
    const field = newField(type, { en: "", ar: "" });
    change(current => updatePage(current, pageIndex, page => ({ ...page, fields: [...page.fields, field] })));
    setSelected(field.id);
  }

  async function save() {
    setAttempted(true);
    if (problems.length) return;
    setSaving(true);
    await runAction(
      async () => {
        await formsWrite(
          updateFormDraftVersionRequest(bundle.definition.id, draft.id, {
            expectedRevision: draft.revision,
            content: withTurkishFallback(content),
          })
        );
        await onSaved();
      },
      { success: F.savedToast }
    );
    setSaving(false);
  }

  const previewBundle = useMemo(
    () => ({
      definition: bundle.definition,
      publication: bundle.publications[0] ?? {
        id: "preview",
        definitionId: bundle.definition.id,
        versionId: draft.id,
        slug: "preview",
        audience: "public" as const,
        status: "open" as const,
        allowMultiple: false,
        allowDrafts: false,
        offlineEligible: false,
        createdBy: "",
        createdAt: draft.createdAt,
      },
      version: { ...draft, content },
      previousSubmissions: [],
      entityOptions: {},
    }),
    [bundle, draft, content]
  );

  return (
    <div className="staff-builder" data-preview={preview || undefined}>
      <div className="staff-builder-main">
        <div className="staff-builder-bar">
          <span className="staff-muted">
            {F.version} {draft.versionNumber} · {F.editingDraft}
            {dirty ? <strong className="staff-text-caution"> · {F.unsaved}</strong> : null}
          </span>
          <span className="staff-row-actions">
            <button type="button" className="staff-btn" data-size="sm" onClick={() => setPreview(value => !value)}>
              {preview ? <EyeOff strokeWidth={1.75} aria-hidden /> : <Eye strokeWidth={1.75} aria-hidden />}
              {preview ? F.hidePreview : F.preview}
            </button>
            <button type="button" className="staff-btn" data-size="sm" data-variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
              {F.save}
            </button>
          </span>
        </div>

        {attempted && problems.length ? (
          <div className="staff-banner" data-tone="caution" role="alert">
            {F.problems} {problems.map(problem => F[problem]).join(" ")}
          </div>
        ) : null}
        {content.logic.length || content.calculations?.length ? <p className="staff-hint">{F.logicNote}</p> : null}
        {formContentHasRecordLinks(content) ? (
          <p className="staff-banner" data-tone="caution">{F.recordLinkBanner}</p>
        ) : null}

        <section className="staff-section">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="staff-field">
              <span className="staff-field-label">{F.titleEn}</span>
              <input
                className="staff-input staff-builder-title"
                value={content.title.en}
                onChange={event => change(current => ({ ...current, title: { ...current.title, en: event.target.value } }))}
              />
            </label>
            <label className="staff-field">
              <span className="staff-field-label">{F.titleAr}</span>
              <input
                className="staff-input staff-builder-title"
                dir="rtl"
                value={content.title.ar}
                onChange={event => change(current => ({ ...current, title: { ...current.title, ar: event.target.value } }))}
              />
            </label>
          </div>
          <label className="staff-field">
            <span className="staff-field-label">{F.intro}</span>
            <textarea
              className="staff-input"
              rows={2}
              value={content.description.en}
              onChange={event =>
                change(current => ({ ...current, description: { ...current.description, en: event.target.value } }))
              }
            />
          </label>
        </section>

        {content.pages.map((page, pageIndex) => (
          <section key={page.id} className="staff-section staff-builder-page">
            {content.pages.length > 1 ? (
              <div className="staff-section-head">
                <input
                  className="staff-input staff-builder-page-title"
                  aria-label={`${F.page} ${pageIndex + 1}`}
                  placeholder={`${F.page} ${pageIndex + 1}`}
                  value={page.title.en}
                  onChange={event =>
                    change(current =>
                      updatePage(current, pageIndex, value => ({ ...value, title: { ...value.title, en: event.target.value } }))
                    )
                  }
                />
                <button
                  type="button"
                  className="staff-btn"
                  data-size="sm"
                  data-variant="quiet-danger"
                  disabled={page.fields.some(field => used.has(field.id))}
                  onClick={() => change(current => ({ ...current, pages: current.pages.filter((_, index) => index !== pageIndex) }))}
                >
                  {F.removePage}
                </button>
              </div>
            ) : null}
            <div className="staff-q-list">
              {page.fields.map((field, index) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  index={index}
                  count={page.fields.length}
                  selected={selected === field.id}
                  locked={used.has(field.id)}
                  onSelect={() => setSelected(field.id)}
                  onChange={patch => change(current => updateField(current, pageIndex, field.id, patch))}
                  onMove={to => change(current => updatePage(current, pageIndex, value => ({ ...value, fields: moveItem(value.fields, index, to) })))}
                  onDuplicate={() => {
                    const copyField = {
                      ...structuredClone(field),
                      id: uid("field"),
                      options: field.options?.map(option => ({ ...option, id: uid("opt") })),
                    };
                    change(current =>
                      updatePage(current, pageIndex, value => {
                        const fields = [...value.fields];
                        fields.splice(index + 1, 0, copyField);
                        return { ...value, fields };
                      })
                    );
                    setSelected(copyField.id);
                  }}
                  onRemove={() =>
                    change(current =>
                      updatePage(current, pageIndex, value => ({ ...value, fields: value.fields.filter(item => item.id !== field.id) }))
                    )
                  }
                />
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="staff-btn staff-q-add">
                  <Plus strokeWidth={1.75} aria-hidden />
                  {F.addField}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {FIELD_GROUPS.map((group, groupIndex) => (
                  <div key={group.key}>
                    {groupIndex ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuLabel>{F.typeGroups[group.key]}</DropdownMenuLabel>
                    {group.types.map(type => (
                      <DropdownMenuItem key={type} onSelect={() => addField(pageIndex, type)}>
                        {F.types[type]}
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </section>
        ))}
        <button
          type="button"
          className="staff-btn w-fit"
          onClick={() =>
            change(current => ({
              ...current,
              pages: [...current.pages, { id: uid("page"), title: { en: "", ar: "" }, fields: [] }],
            }))
          }
        >
          <Plus strokeWidth={1.75} aria-hidden />
          {F.addPage}
        </button>
      </div>
      {preview ? (
        <aside className="staff-builder-preview" aria-label={F.preview}>
          <NileFormRenderer bundle={previewBundle} mode="preview" />
        </aside>
      ) : null}
    </div>
  );
}
