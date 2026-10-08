import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const columns = [
  { key: "name", label: "Name" },
  { key: "count", label: "Leads" },
];

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and a header row", () => {
    const csv = toCsv(columns, [{ name: "A", count: 2 }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split("\r\n")[0]).toBe("Name,Leads");
  });

  it("uses CRLF line endings and terminates the last row", () => {
    const csv = toCsv(columns, [
      { name: "A", count: 1 },
      { name: "B", count: 2 },
    ]);
    expect(csv.slice(1)).toBe("Name,Leads\r\nA,1\r\nB,2\r\n");
  });

  it("quotes cells containing commas, quotes and newlines", () => {
    const csv = toCsv(columns, [{ name: 'a, "b"\nc', count: 1 }]);
    expect(csv).toContain('"a, ""b""\nc",1');
  });

  it("prefixes formula-like text to prevent injection", () => {
    const csv = toCsv(columns, [
      { name: "=SUM(A1:A2)", count: 1 },
      { name: "@cmd", count: 1 },
      { name: "-1", count: 1 },
      { name: "+42", count: 1 },
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe("'=SUM(A1:A2),1");
    expect(lines[2]).toBe("'@cmd,1");
    expect(lines[3]).toBe("'-1,1");
    expect(lines[4]).toBe("'+42,1");
  });

  it("renders null and undefined as empty cells", () => {
    const csv = toCsv(columns, [{ name: null, count: undefined }]);
    expect(csv.slice(1).split("\r\n")[1]).toBe(",");
  });
});
