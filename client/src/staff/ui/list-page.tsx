import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useSearch } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { GlyphChevronDown, GlyphChevronUp, GlyphSearch } from "./glyphs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { cn } from "@/lib/utils";
import { copy } from "../copy";

export interface ListColumn<T> {
  id: string;
  label: string;
  /** Sortable when the accessor is provided. */
  sortValue?: (row: T) => string | number | null;
  render: (row: T) => ReactNode;
  /** Hidden from the column picker when true. */
  always?: boolean;
  /** Off by default when there is no saved column preference. */
  defaultHidden?: boolean;
}

export interface ListFilter {
  /** Query param name. */
  key: string;
  /** Accessible label; not shown next to the trigger. */
  label: string;
  /** Trigger text when nothing is filtered, e.g. "All statuses". */
  allLabel: string;
  options: { value: string; label: string }[];
  /** Applied to rows but not rendered in the toolbar. */
  hidden?: boolean;
}

interface ListPageProps<T> {
  title: string;
  description?: string;
  /** Unique id used for the column-picker localStorage preference. */
  listId: string;
  items: T[];
  columns: ListColumn<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  filters?: ListFilter[];
  /** Which filter field each option compares; returns the row's filter value. */
  filterValue?: (row: T, key: string) => string | null;
  renderCard?: (row: T) => ReactNode;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  pageSize?: number;
  headerActions?: ReactNode;
  empty: ReactNode;
  /**
   * Server mode: `items` is already the filtered page. Search, filters, and
   * `page` still live in the URL, but the page component sends them to the
   * API and passes the provider total here. Client sorting is off.
   */
  server?: { total: number; pageSize: number; refreshing?: boolean };
}

const STORAGE_PREFIX = "staff.list.columns.";

export function ListPage<T>({
  title,
  description,
  listId,
  items,
  columns,
  rowKey,
  searchText,
  filters = [],
  filterValue,
  renderCard,
  bulkActions,
  pageSize = 25,
  headerActions,
  empty,
  server,
}: ListPageProps<T>) {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const reduceMotion = useReducedMotion();

  const defaultColumnIds = () =>
    columns
      .filter(column => column.always || !column.defaultHidden)
      .map(column => column.id);
  const [columnIds, setColumnIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_PREFIX + listId);
      if (!saved) return defaultColumnIds();
      const parsed = JSON.parse(saved) as unknown;
      if (!Array.isArray(parsed)) return defaultColumnIds();
      const valid = parsed.filter(
        (id): id is string =>
          typeof id === "string" && columns.some(c => c.id === id)
      );
      const missing = columns
        .filter(c => c.always && !valid.includes(c.id))
        .map(c => c.id);
      return [...missing, ...valid];
    } catch {
      return defaultColumnIds();
    }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWide(entry.contentRect.width >= 900);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // "/" focuses the list search box when focus is outside a field.
  useEffect(() => {
    if (!searchText) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchText]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(search);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    const raw = next.toString();
    navigate(`?${raw}`, { replace: true });
  }

  const q = (params.get("q") ?? "").trim().toLowerCase();
  const sortKey = params.get("sort") ?? "";
  const sortDir = params.get("dir") === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const filtered = useMemo(() => {
    if (server) return items;
    let rows = items;
    if (q && searchText) {
      rows = rows.filter(row => searchText(row).toLowerCase().includes(q));
    }
    for (const filter of filters) {
      const active = params.get(filter.key);
      if (!active || !filterValue) continue;
      rows = rows.filter(row => filterValue(row, filter.key) === active);
    }
    const column = columns.find(c => c.id === sortKey && c.sortValue);
    if (column?.sortValue) {
      const accessor = column.sortValue;
      rows = [...rows].sort((a, b) => {
        const va = accessor(a);
        const vb = accessor(b);
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        const cmp =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb));
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return rows;
  }, [server, items, q, params, filters, filterValue, columns, sortKey, sortDir, searchText]);

  const size = server?.pageSize ?? pageSize;
  const total = server ? server.total : filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(page, pageCount);
  const pageRows = server
    ? items
    : filtered.slice((currentPage - 1) * size, currentPage * size);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * size + 1;
  const rangeEnd = Math.min(total, (currentPage - 1) * size + pageRows.length);

  const visibleColumns = columns.filter(
    column => column.always || columnIds.includes(column.id)
  );
  const visibleFilters = filters.filter(filter => !filter.hidden);
  const filtersActive =
    Boolean(q) || filters.some(filter => params.get(filter.key));

  function clearFilters() {
    const next = new URLSearchParams(search);
    next.delete("q");
    for (const filter of filters) next.delete(filter.key);
    next.delete("page");
    navigate(`?${next.toString()}`, { replace: true });
  }

  function toggleColumn(id: string) {
    setColumnIds(current => {
      const next = current.includes(id)
        ? current.filter(existing => existing !== id)
        : [...columns.map(c => c.id).filter(c => current.includes(c) || c === id)];
      try {
        window.localStorage.setItem(STORAGE_PREFIX + listId, JSON.stringify(next));
      } catch {
        /* preference only */
      }
      return next;
    });
  }

  function toggleSort(column: ListColumn<T>) {
    if (!column.sortValue) return;
    if (sortKey !== column.id) {
      const next = new URLSearchParams(search);
      next.set("sort", column.id);
      next.set("dir", "asc");
      next.delete("page");
      navigate(`?${next.toString()}`, { replace: true });
      return;
    }
    setParam("dir", sortDir === "asc" ? "desc" : "asc");
  }

  function toggleRow(key: string) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const selectedRows = filtered.filter(row => selected.has(rowKey(row)));

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-4 min-w-0"
      aria-busy={server?.refreshing || undefined}
      data-refreshing={server?.refreshing || undefined}
    >
      <div className="staff-toolbar">
        {searchText ? (
          <label className="staff-search">
            <GlyphSearch className="ui-glyph staff-search-glyph" />
            <input
              ref={searchRef}
              type="search"
              className="staff-input staff-search-input"
              placeholder={copy.actions.search}
              value={params.get("q") ?? ""}
              onChange={event => setParam("q", event.target.value || null)}
              aria-label={copy.actions.search}
            />
            <kbd className="staff-search-kbd" aria-hidden>
              /
            </kbd>
          </label>
        ) : null}
        <div className="staff-toolbar-filters">
          {visibleFilters.map(filter => (
            <Select
              key={filter.key}
              value={params.get(filter.key) ?? "__all"}
              onValueChange={value =>
                setParam(filter.key, value === "__all" || !value ? null : value)
              }
            >
              <SelectTrigger size="sm" aria-label={filter.label}>
                <SelectValue placeholder={filter.allLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{filter.allLabel}</SelectItem>
                {filter.options.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {filtersActive ? (
            <button
              type="button"
              className="staff-btn"
              data-variant="ghost"
              data-size="sm"
              onClick={clearFilters}
            >
              {copy.staffUsers.clearFilters}
            </button>
          ) : null}
        </div>
        <div className="staff-toolbar-end">
          {headerActions}
          <span className="staff-results">
            {copy.staffUsers.results}: {total}
          </span>
          <div className="relative">
            <button
              type="button"
              className="staff-btn"
              data-size="sm"
              aria-expanded={pickerOpen}
              aria-label={copy.actions.columns}
              onClick={() => setPickerOpen(open => !open)}
            >
              <Columns3 strokeWidth={1.75} aria-hidden />
              {copy.actions.columns}
            </button>
            {pickerOpen ? (
              <div className="staff-menu" role="menu">
                {columns
                  .filter(column => !column.always)
                  .map(column => (
                    <label key={column.id} className="staff-menu-item">
                      <input
                        type="checkbox"
                        checked={columnIds.includes(column.id)}
                        onChange={() => toggleColumn(column.id)}
                      />
                      {column.label}
                    </label>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selected.size > 0 && bulkActions ? (
          <div className="staff-bulk-bar" role="toolbar">
            <motion.div
              className="staff-bulk-bar-inner"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 12, filter: "blur(4px)" }
              }
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : {
                      opacity: 0,
                      filter: "blur(4px)",
                      transition: { duration: 0.15, ease: "easeOut" },
                    }
              }
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <span>
                {selected.size} {copy.actions.selected}
              </span>
              {bulkActions(selectedRows, () => setSelected(new Set()))}
              <button
                type="button"
                className="staff-btn ms-auto"
                data-size="sm"
                onClick={() => setSelected(new Set())}
              >
                {copy.actions.clearSelection}
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {pageRows.length === 0 ? (
        empty
      ) : wide ? (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                {bulkActions ? (
                  <th scope="col" style={{ width: "2.5rem" }}>
                    <input
                      type="checkbox"
                      aria-label={copy.actions.selectAll}
                      checked={
                        pageRows.length > 0 &&
                        pageRows.every(row => selected.has(rowKey(row)))
                      }
                      onChange={() =>
                        setSelected(current => {
                          const next = new Set(current);
                          const all = pageRows.every(row =>
                            next.has(rowKey(row))
                          );
                          for (const row of pageRows) {
                            if (all) next.delete(rowKey(row));
                            else next.add(rowKey(row));
                          }
                          return next;
                        })
                      }
                    />
                  </th>
                ) : null}
                {visibleColumns.map(column => (
                  <th key={column.id} scope="col">
                    {column.sortValue && !server ? (
                      <button
                        type="button"
                        className="staff-sort"
                        onClick={() => toggleSort(column)}
                        aria-label={`${column.label} sort`}
                      >
                        {column.label}
                        {sortKey === column.id ? (
                          sortDir === "asc" ? (
                            <GlyphChevronUp />
                          ) : (
                            <GlyphChevronDown />
                          )
                        ) : null}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(row => {
                const key = rowKey(row);
                return (
                  <tr key={key} data-selected={selected.has(key)}>
                    {bulkActions ? (
                      <td className="staff-cell-top">
                        <input
                          type="checkbox"
                          aria-label={copy.actions.selectRow}
                          checked={selected.has(key)}
                          onChange={() => toggleRow(key)}
                        />
                      </td>
                    ) : null}
                    {visibleColumns.map(column => (
                      <td key={column.id}>{column.render(row)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="staff-list-cards">
          {pageRows.map(row => (
            <div
              key={rowKey(row)}
              className={cn("staff-card", renderCard ? "staff-rowcard" : "!py-3")}
            >
              {bulkActions ? (
                <label className="staff-cell-top mb-2 flex items-center gap-2 staff-muted">
                  <input
                    type="checkbox"
                    checked={selected.has(rowKey(row))}
                    onChange={() => toggleRow(rowKey(row))}
                  />
                </label>
              ) : null}
              {renderCard
                ? renderCard(row)
                : visibleColumns.map(column => (
                    <div key={column.id} className="flex justify-between gap-3 py-0.5">
                      <span className="staff-muted">{column.label}</span>
                      <span>{column.render(row)}</span>
                    </div>
                  ))}
            </div>
          ))}
        </div>
      )}

      {total > size ? (
        <nav className="staff-pagination" aria-label={copy.actions.pagination}>
          <button
            type="button"
            className="staff-icon-btn"
            aria-label={copy.actions.previous}
            disabled={currentPage <= 1}
            onClick={() => setParam("page", String(currentPage - 1))}
          >
            <ChevronLeft className="staff-rtl-flip" strokeWidth={1.75} aria-hidden />
          </button>
          <span>
            {rangeStart}–{rangeEnd} {copy.actions.pageOf} {total}
          </span>
          <button
            type="button"
            className="staff-icon-btn"
            aria-label={copy.actions.next}
            disabled={currentPage >= pageCount}
            onClick={() => setParam("page", String(currentPage + 1))}
          >
            <ChevronRight className="staff-rtl-flip" strokeWidth={1.75} aria-hidden />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

export function listPageShell(children: ReactNode, className?: string) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}
