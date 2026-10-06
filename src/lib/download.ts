/**
 * Client-side exports.
 *
 * CSV and JSON are generated here rather than server-side because the browser
 * already holds exactly what is on screen — including whatever filter the user
 * applied — so a round trip would risk exporting something different from what
 * they are looking at. The accounting GL batch is the exception: that one comes
 * from the API, because it must reconcile to the ledger rather than to a view.
 */

export type Cell = string | number | null | undefined;

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Quotes a field only when it needs it, so the file stays readable. */
function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(name: string, headers: string[], rows: Cell[][]): void {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  // A BOM makes Excel open UTF-8 correctly instead of mangling accents.
  save(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
       `${name}-${stamp()}.csv`);
}

export function downloadJson(name: string, data: unknown): void {
  save(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
       `${name}-${stamp()}.json`);
}

/**
 * Excel-readable without a spreadsheet dependency: an HTML table with an .xls
 * extension, which Excel and LibreOffice both open as a formatted sheet.
 *
 * It is not a real XLSX. If someone needs formulas, pivot tables or multiple
 * sheets, that wants a proper writer on the server rather than this.
 */
export function downloadExcel(
  name: string,
  title: string,
  headers: string[],
  rows: Cell[][],
): void {
  const esc = (v: Cell) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head>
<meta charset="utf-8" />
<style>
  table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11pt; }
  th { background: #00274c; color: #fff; text-align: left; padding: 6px 10px; }
  td { padding: 5px 10px; border-bottom: 1px solid #dde5ef; }
  td.n { text-align: right; mso-number-format: "#,##0.00"; }
  caption { text-align: left; font-size: 14pt; font-weight: bold; padding-bottom: 8px; }
</style></head><body>
<table>
  <caption>${esc(title)} — ${stamp()}</caption>
  <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows
    .map(
      (r) =>
        `<tr>${r
          .map((c) => {
            const numeric = typeof c === "number" || (typeof c === "string" && c !== "" && !Number.isNaN(Number(c)));
            return `<td${numeric ? ' class="n"' : ""}>${esc(c)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</tbody>
</table></body></html>`;

  save(new Blob([html], { type: "application/vnd.ms-excel" }), `${name}-${stamp()}.xls`);
}

/**
 * Print, which is also how you get a PDF — every browser's print dialogue can
 * "Save as PDF". Generating one in-app would mean shipping a PDF library for
 * something the platform already does well.
 */
export function printReport(): void {
  window.print();
}
