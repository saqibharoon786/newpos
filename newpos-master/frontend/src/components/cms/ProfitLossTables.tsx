import { buildProfitLossExport, type PlExportLine } from '@/lib/reportProfitExport';

type BusinessReportLike = {
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
  expenses?: Array<{
    _id?: string;
    date?: string;
    category?: string;
    purpose?: string;
    subject?: string;
    usage?: string;
    priceRs?: number;
    personResponsible?: string;
  }>;
  expenseCategories?: Array<{
    category: string;
    totalRs: number;
    count?: number;
  }>;
};

function PlTable({
  title,
  lines,
  note,
}: {
  title: string;
  lines: PlExportLine[];
  note?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-cms-card p-5 space-y-3">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-cms-table-header">
            <tr>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-right px-3 py-2 w-36">Amount (Rs)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-border">
                <td
                  className={`px-3 py-2 ${line.indent ? 'pl-8 text-muted-foreground' : ''} ${
                    line.bold ? 'font-semibold text-foreground' : ''
                  } ${line.isHeader ? 'font-medium text-foreground pt-3' : ''}`}
                >
                  {line.label}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    line.bold ? 'font-semibold' : ''
                  }`}
                >
                  {line.amount != null && line.amount !== 0
                    ? line.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : line.amount === 0
                      ? '0'
                      : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}

export function ProfitLossReportTables({
  report,
  periodLabel,
}: {
  report: BusinessReportLike;
  periodLabel?: string;
}) {
  const data = buildProfitLossExport({
    label: report.label,
    startDate: report.startDate,
    endDate: report.endDate,
    summary: report.summary,
    expenses: report.expenses,
    expenseCategories: report.expenseCategories,
  });

  const ending =
    periodLabel ||
    (report.endDate
      ? report.startDate && report.startDate !== report.endDate
        ? `${report.startDate} — ${report.endDate}`
        : `For the period ending on ${report.endDate}`
      : report.label || 'Report');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-bold text-foreground">International Plastic</p>
        <p className="text-sm font-semibold text-foreground">Profit &amp; Loss Report</p>
        <p className="text-xs text-muted-foreground mt-1">{ending}</p>
      </div>
      <PlTable
        title="Summary"
        lines={data.summaryLines}
        note={data.costOfSaleNote}
      />
      <PlTable
        title="Detail Format"
        lines={data.detailLines}
        note={data.expensesNote}
      />
    </div>
  );
}

export { PlTable };
