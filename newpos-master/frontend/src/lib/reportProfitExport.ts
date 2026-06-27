import { downloadFile, exportAsPdf } from './exportUtils';

export type PlExportLine = {
  label: string;
  amount: number | null;
  indent?: boolean;
  bold?: boolean;
  isHeader?: boolean;
};

type ReportExpenseCategory = {
  category: string;
  totalRs: number;
  count?: number;
};

type ReportExpenseItem = {
  _id?: string;
  date?: string;
  category?: string;
  subject?: string;
  purpose?: string;
  usage?: string;
  priceRs?: number;
  personResponsible?: string;
};

type BusinessReportExport = {
  label?: string;
  startDate?: string;
  endDate?: string;
  summary: {
    sales: { revenueRs?: number; costRs?: number };
    grossProfitRs?: number;
    expenses: { totalRs?: number };
    sellingExpenses?: { totalRs?: number };
    netProfitRs?: number;
  };
  expenses?: ReportExpenseItem[];
  expenseCategories?: ReportExpenseCategory[];
};

function formatExpenseDetailLabel(e: ReportExpenseItem): string {
  const title = (e.subject || e.purpose || e.category || 'Expense').trim();
  const parts: string[] = [title];
  if (e.category && e.category !== 'General' && e.category !== title) {
    parts.push(`(${e.category})`);
  }
  if (e.date) {
    parts.push(`— ${e.date}`);
  }
  return parts.join(' ');
}

function buildDetailExpenseLines(
  expenses: ReportExpenseItem[],
  delivery: number
): PlExportLine[] {
  const sorted = [...expenses].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
  );

  const lines: PlExportLine[] = sorted.map((e) => ({
    label: formatExpenseDetailLabel(e),
    amount: e.priceRs ?? 0,
    indent: true,
  }));

  if (delivery > 0) {
    lines.push({
      label: 'Delivery Charges — Sales',
      amount: delivery,
      indent: true,
    });
  }

  if (lines.length === 0) {
    lines.push({
      label: 'No Kharcha entries in this period',
      amount: 0,
      indent: true,
    });
  }

  return lines;
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildProfitLossExport(report: BusinessReportExport) {
  const s = report.summary;
  const revenue = s.sales?.revenueRs ?? 0;
  const costOfSale = s.sales?.costRs ?? 0;
  const grossProfit = s.grossProfitRs ?? revenue - costOfSale;
  const kharcha = s.expenses?.totalRs ?? 0;
  const delivery = s.sellingExpenses?.totalRs ?? 0;
  const allExpenses = kharcha + delivery;
  const netProfit = s.netProfitRs ?? grossProfit - allExpenses;

  const detailExpenseLines = buildDetailExpenseLines(report.expenses ?? [], delivery);

  const summaryLines: PlExportLine[] = [
    { label: 'Revenue/Sales', amount: revenue },
    { label: 'Less Cost of Sale', amount: costOfSale },
    { label: 'Gross Profit', amount: grossProfit, bold: true },
    { label: 'Total Expenses', amount: allExpenses, bold: true },
    { label: 'Net Profit', amount: netProfit, bold: true },
  ];

  const detailLines: PlExportLine[] = [
    { label: 'Revenue/Sales', amount: revenue },
    { label: 'Less Cost of Sale', amount: costOfSale },
    { label: 'Gross Profit', amount: grossProfit, bold: true },
    { label: 'Less Expenses (Kharcha + Delivery)', amount: null, isHeader: true },
    ...detailExpenseLines,
    ...(allExpenses > 0
      ? [{ label: 'Total Expenses', amount: allExpenses, bold: true } as PlExportLine]
      : []),
    { label: 'Net Profit', amount: netProfit, bold: true },
  ];

  return {
    summaryLines,
    detailLines,
    costOfSaleNote:
      'This head should only include the cost of products that have been sold.',
    expensesNote:
      'This list automatically includes all the expenses that will be added through the Kharcha module.',
    meta: {
      label: report.label || 'Report',
      startDate: report.startDate,
      endDate: report.endDate,
    },
  };
}

function linesToRows(lines: PlExportLine[]) {
  return lines.map((line) => ({
    Description: line.indent ? `  ${line.label}` : line.label,
    'Amount (Rs)': line.amount != null ? line.amount : '',
  }));
}

function buildPlTableHtml(lines: PlExportLine[], note?: string): string {
  const rows = lines
    .map((line) => {
      const label = line.indent ? `&nbsp;&nbsp;${escapeHtml(line.label)}` : escapeHtml(line.label);
      const style = line.bold ? 'font-weight:700;' : '';
      const amount =
        line.amount != null
          ? escapeHtml(fmtAmount(line.amount))
          : line.isHeader
            ? ''
            : '';
      return `<tr><td style="${style}">${label}</td><td style="text-align:right;${style}">${amount}</td></tr>`;
    })
    .join('');
  const noteHtml = note
    ? `<p style="font-size:11px;color:#555;margin:8px 0 0 0;">${escapeHtml(note)}</p>`
    : '';
  return `<table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
    <thead><tr><th>Description</th><th style="text-align:right;width:140px;">Amount (Rs)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>${noteHtml}`;
}

function periodLabel(meta: { label: string; startDate?: string; endDate?: string }) {
  if (meta.startDate && meta.endDate && meta.startDate !== meta.endDate) {
    return `${meta.label} (${meta.startDate} — ${meta.endDate})`;
  }
  return meta.label;
}

export function exportBusinessProfitLossReport(
  format: 'csv' | 'excel' | 'pdf',
  report: BusinessReportExport
) {
  const data = buildProfitLossExport(report);
  const label = data.meta.label.replace(/[^\w\-]+/g, '-');
  const period = periodLabel(data.meta);

  if (format === 'csv') {
    const summaryRows = linesToRows(data.summaryLines);
    const detailRows = linesToRows(data.detailLines);
    const blocks: string[] = [
      `Profit & Loss Report — ${period}`,
      '',
      'SUMMARY',
      'Description,Amount (Rs)',
      ...summaryRows.map((r) => `${r.Description},${r['Amount (Rs)']}`),
      '',
      escapeCsvNote(data.costOfSaleNote),
      '',
      'DETAIL FORMAT',
      'Description,Amount (Rs)',
      ...detailRows.map((r) => `${r.Description},${r['Amount (Rs)']}`),
      '',
      escapeCsvNote(data.expensesNote),
    ];
    downloadFile(
      `profit-loss-report-${label}.csv`,
      'text/csv;charset=utf-8;',
      blocks.join('\n')
    );
    return;
  }

  if (format === 'excel') {
    const summaryTable = buildPlTableHtml(data.summaryLines, data.costOfSaleNote);
    const detailTable = buildPlTableHtml(data.detailLines, data.expensesNote);
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Profit &amp; Loss Report</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; }
    h2 { margin: 18px 0 6px 0; font-size: 14px; }
    h1 { margin: 0 0 4px 0; font-size: 16px; }
    .meta { color: #555; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>Profit &amp; Loss Report</h1>
  <div class="meta">Period: ${escapeHtml(period)}</div>
  <h2>Summary</h2>
  ${summaryTable}
  <h2>Detail Format</h2>
  ${detailTable}
</body>
</html>`;
    downloadFile(
      `profit-loss-report-${label}.xls`,
      'application/vnd.ms-excel;charset=utf-8;',
      html
    );
    return;
  }

  const body = `
    <p style="color:#555;margin-bottom:16px;">${escapeHtml(
      data.meta.endDate
        ? data.meta.startDate && data.meta.startDate !== data.meta.endDate
          ? `For the period ${data.meta.startDate} — ${data.meta.endDate}`
          : `For the period ending on ${data.meta.endDate}`
        : `Period: ${period}`
    )}</p>
    <h2 style="font-size:15px;margin:0 0 4px 0;">Summary</h2>
    ${buildPlTableHtml(data.summaryLines, data.costOfSaleNote)}
    <h2 style="font-size:15px;margin:20px 0 4px 0;">Detail Format</h2>
    ${buildPlTableHtml(data.detailLines, data.expensesNote)}
  `;
  exportAsPdf('Profit & Loss Report', body);
}

function escapeCsvNote(note: string): string {
  const escaped = note.replace(/"/g, '""');
  return `"${escaped}"`;
}
