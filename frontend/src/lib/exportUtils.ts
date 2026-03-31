export type ExportRow = Record<string, string | number | boolean | null | undefined>;

const escapeCsv = (value: unknown): string => {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const downloadFile = (filename: string, mimeType: string, content: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportAsCsv = (filename: string, headers: string[], rows: ExportRow[]) => {
  const csvRows = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
  ];
  downloadFile(filename, "text/csv;charset=utf-8;", csvRows.join("\n"));
};

export const exportAsWordTable = (filename: string, title: string, headers: string[], rows: ExportRow[]) => {
  const safe = (v: unknown) =>
    (v === null || v === undefined ? "" : String(v))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safe(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; }
    h2 { margin: 0 0 8px 0; }
    .meta { margin-bottom: 10px; color: #555; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
    th { background: #f3f3f3; }
  </style>
</head>
<body>
  <h2>${safe(title)}</h2>
  <div class="meta">Generated: ${safe(new Date().toLocaleString())}</div>
  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${safe(h)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr>${headers.map((h) => `<td>${safe(row[h])}</td>`).join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;

  downloadFile(filename, "application/msword;charset=utf-8;", html);
};

/**
 * Excel-friendly export as HTML table (.xls).
 * This preserves table cell alignment better than CSV in many locales.
 */
export const exportAsExcelTable = (filename: string, title: string, headers: string[], rows: ExportRow[]) => {
  const safe = (v: unknown) =>
    (v === null || v === undefined ? "" : String(v))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safe(title)}</title>
  <style>
    table { border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 6px; vertical-align: top; }
    th { background: #eaeaea; font-weight: 700; }
    .text { mso-number-format:\\@; }
  </style>
</head>
<body>
  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${safe(h)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${headers
              .map((h) => `<td class="text">${safe(row[h])}</td>`)
              .join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;

  downloadFile(filename, "application/vnd.ms-excel;charset=utf-8;", html);
};

export const toYmd = (input?: string | Date | null): string => {
  if (!input) return "";
  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(input.trim())) {
    const [dd, mm, yyyy] = input.trim().split("/").map(Number);
    d = new Date(yyyy, mm - 1, dd);
  } else {
    d = new Date(input);
  }
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const inDateRange = (value: string | Date, startDate?: string, endDate?: string): boolean => {
  const current = toYmd(value);
  if (!current) return false;
  if (startDate && current < startDate) return false;
  if (endDate && current > endDate) return false;
  return true;
};
