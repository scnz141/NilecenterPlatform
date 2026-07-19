import type { HTMLAttributes, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { translateUiLabel } from "@/lib/i18n";
import { useUiLanguage } from "@/lib/i18n-context";

export type OperationalDirectoryColumn<Row> = {
  key: string;
  label: string;
  className?: string;
  render: (row: Row) => ReactNode;
};

type OperationalDirectoryAction<Row> = {
  href: (row: Row) => string | undefined;
  label: (row: Row) => string;
  title?: (row: Row) => string | undefined;
};

type OperationalDirectoryRowAttributes = HTMLAttributes<HTMLTableRowElement> & {
  [attribute: `data-${string}`]: string | number | boolean | undefined;
};

export default function OperationalDirectoryTable<Row>({
  rows,
  rowKey,
  columns,
  action,
  className = "",
  getRowProps,
}: {
  rows: Row[];
  rowKey: (row: Row) => string;
  columns: OperationalDirectoryColumn<Row>[];
  action: OperationalDirectoryAction<Row>;
  className?: string;
  getRowProps?: (row: Row) => OperationalDirectoryRowAttributes;
}) {
  const locale = useUiLanguage();
  const label = (value: string) => translateUiLabel(locale, value);

  return (
    <table className={`platform-directory-table ${className}`.trim()}>
      <thead>
        <tr>
          {columns.map(column => (
            <th key={column.key} className={column.className} scope="col">
              {label(column.label)}
            </th>
          ))}
          <th className="platform-directory-col-action" scope="col">
            <span className="platform-sr-only">{label("Actions")}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const href = action.href(row);
          return (
            <tr key={rowKey(row)} {...getRowProps?.(row)}>
              {columns.map(column => (
                <td key={column.key} data-label={label(column.label)}>
                  {column.render(row)}
                </td>
              ))}
              <td data-label={label("Actions")}>
                {href ? (
                  <Link
                    className="platform-directory-open"
                    href={href}
                    aria-label={`${label("Open")} ${action.label(row)}`}
                    title={action.title?.(row)}
                  >
                    <span>{label("Open")}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="platform-directory-no-action">
                    <span aria-hidden="true">-</span>
                    <span className="platform-sr-only">
                      {label("No action available")}
                    </span>
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
