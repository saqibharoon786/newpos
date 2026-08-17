export type ExportRow = Record<string, string | number | boolean | null | undefined>;

/** Raw numeric value for export cells — units belong in column headers only. */
export function toExportNumber(value: unknown): number | "" {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "";
    return Math.round(value * 100) / 100;
  }
  const cleaned = String(value)
    .replace(/Rs\.?\s*/gi, "")
    .replace(/PKR\s*/gi, "")
    .replace(/\s*kg/gi, "")
    .replace(/,/g, "")
    .trim();
  if (!cleaned || cleaned === "—" || cleaned === "-") return "";
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return "";
  return Math.round(n * 100) / 100;
}

function isNumericExportValue(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function excelCellMarkup(value: unknown): { attrs: string; content: string } {
  const safeText = (v: unknown) =>
    (v === null || v === undefined ? "" : String(v))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  if (value === null || value === undefined || value === "") {
    return { attrs: "", content: "" };
  }

  if (isNumericExportValue(value)) {
    return {
      attrs: ' style="mso-number-format:0.00;"',
      content: String(value),
    };
  }

  const asNum = toExportNumber(value);
  if (asNum !== "" && String(value).trim() !== "" && /^[\d\s,.\-RsPKRkg]+$/i.test(String(value).trim())) {
    return {
      attrs: ' style="mso-number-format:0.00;"',
      content: String(asNum),
    };
  }

  return {
    attrs: ' style="mso-number-format:\\@;"',
    content: safeText(value),
  };
}

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
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="utf-8" />
  <title>${safe(title)}</title>
  <style>
    table { border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 6px; vertical-align: top; }
    th { background: #eaeaea; font-weight: 700; }
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
              .map((h) => {
                const cell = excelCellMarkup(row[h]);
                return `<td${cell.attrs}>${cell.content}</td>`;
              })
              .join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;

  downloadFile(filename, "application/vnd.ms-excel;charset=utf-8;", html);
};

export type ExcelWorkbookSection = {
  title: string;
  headers: string[];
  rows: ExportRow[];
};

function buildExcelTableSection(headers: string[], rows: ExportRow[], safe: (v: unknown) => string): string {
  return `<table>
    <thead>
      <tr>${headers.map((h) => `<th>${safe(h)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${headers
              .map((h) => {
                const cell = excelCellMarkup(row[h]);
                return `<td${cell.attrs}>${cell.content}</td>`;
              })
              .join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

/** Multi-section Excel workbook — numeric cells only; units in headers. */
export const exportExcelWorkbook = (
  filename: string,
  documentTitle: string,
  sections: ExcelWorkbookSection[],
  meta?: string
) => {
  const safe = (v: unknown) =>
    (v === null || v === undefined ? "" : String(v))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const body = sections
    .map(
      (section) =>
        `<h2 style="font-size:14px;margin:20px 0 6px 0;">${safe(section.title)}</h2>${buildExcelTableSection(section.headers, section.rows, safe)}`
    )
    .join("");

  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="utf-8" />
  <title>${safe(documentTitle)}</title>
  <style>
    table { border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #000; padding: 6px; vertical-align: top; }
    th { background: #eaeaea; font-weight: 700; }
  </style>
</head>
<body>
  <h1 style="font-size:16px;margin:0 0 4px 0;">${safe(documentTitle)}</h1>
  ${meta ? `<p style="color:#555;margin:0 0 12px 0;">${safe(meta)}</p>` : ""}
  ${body}
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

/** Opens printable HTML — user can Save as PDF from browser print dialog */
export const exportAsPdf = (
  title: string,
  htmlBody: string,
  companyName = 'International Plastic',
  logoUrl?: string | null
) => {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
  .header img { max-height: 64px; }
  h1 { margin: 0; font-size: 22px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  ${logoUrl ? `<img src="${logoUrl}" alt="logo" />` : ''}
  <div><h1>${companyName}</h1><p>${title}</p></div>
</div>
${htmlBody}
<script>window.onload = () => { window.print(); }</script>
</body></html>`);
  win.document.close();
};

export const inDateRange = (value: string | Date, startDate?: string, endDate?: string): boolean => {
  const current = toYmd(value);
  if (!current) return false;
  if (startDate && current < startDate) return false;
  if (endDate && current > endDate) return false;
  return true;
};
