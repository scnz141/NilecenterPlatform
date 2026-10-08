/** RFC 4180 CSV export for staff reports. */
export type CsvColumn = { key: string; label: string };
export type CsvRow = Record<string, string | number | null | undefined>;

/** Spreadsheet formula injection: text starting with these gets a `'` prefix. */
const FORMULA_PREFIX = /^[=+\-@]/;

function cell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header + rows, CRLF line ends, UTF-8 BOM so Excel reads Arabic names. */
export function toCsv(columns: CsvColumn[], rows: CsvRow[]): string {
  const lines = [
    columns.map(column => cell(column.label)).join(","),
    ...rows.map(row =>
      columns.map(column => cell(row[column.key])).join(",")
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
