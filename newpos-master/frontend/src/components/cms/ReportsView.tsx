import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportBusinessProfitLossReport, buildProfitLossExport } from '@/lib/reportProfitExport';
import { FileSpreadsheet, Loader2, RefreshCw, TrendingUp, Package, Factory, ShoppingCart, Receipt } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ProfitCalculationSection from './ProfitCalculationSection';

type Period = 'daily' | 'monthly' | 'yearly' | 'custom';

function fmtKg(n: number | undefined) {
  return `${(n ?? 0).toLocaleString()} kg`;
}

function fmtRs(n: number | undefined) {
  return `Rs. ${(n ?? 0).toLocaleString()}`;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? 'border-primary bg-primary/5' : 'border-border bg-cms-card/50'
      }`}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function DataTable({
  title,
  icon,
  headers,
  rows,
  emptyMsg,
}: {
  title: string;
  icon: React.ReactNode;
  headers: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: Record<string, unknown>[];
  emptyMsg: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-cms-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} record(s)</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{emptyMsg}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-cms-table-header">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h.key}
                    className={`px-3 py-2 whitespace-nowrap ${h.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={(row._id as string) || i} className="border-t border-border hover:bg-muted/30">
                  {headers.map((h) => (
                    <td
                      key={h.key}
                      className={`px-3 py-2 ${h.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {String(row[h.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ReportsView() {
  const [period, setPeriod] = useState<Period>('daily');
  const [date, setDate] = useState(todayYmd());
  const [month, setMonth] = useState(currentMonthValue());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState(todayYmd());
  const [endDate, setEndDate] = useState(todayYmd());
  const [report, setReport] = useState<any>(null);
  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [profitCalcReloadToken, setProfitCalcReloadToken] = useState(0);
  const [profitCalcRangeQuery, setProfitCalcRangeQuery] = useState('');

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [ledger, setLedger] = useState<any>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const buildQuery = useCallback(() => {
    const q = new URLSearchParams({ period });
    if (period === 'daily') q.set('date', date);
    else if (period === 'monthly') q.set('month', month);
    else if (period === 'yearly') q.set('year', year);
    else {
      q.set('startDate', startDate);
      q.set('endDate', endDate);
    }
    return q.toString();
  }, [period, date, month, year, startDate, endDate]);

  const profitRangeQuery = useCallback(() => {
    const rangeQ = new URLSearchParams();
    if (period === 'daily') {
      rangeQ.set('startDate', date);
      rangeQ.set('endDate', date);
    } else if (period === 'monthly') {
      const [y, m] = month.split('-');
      const last = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      rangeQ.set('startDate', `${y}-${m}-01`);
      rangeQ.set('endDate', `${y}-${m}-${String(last).padStart(2, '0')}`);
    } else if (period === 'yearly') {
      rangeQ.set('startDate', `${year}-01-01`);
      rangeQ.set('endDate', `${year}-12-31`);
    } else {
      rangeQ.set('startDate', startDate);
      rangeQ.set('endDate', endDate);
    }
    return rangeQ.toString();
  }, [period, date, month, year, startDate, endDate]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const q = buildQuery();
      const profitQ = profitRangeQuery();
      const [r, pl] = await Promise.all([
        api.get(`/api/reports/business-pipeline?${q}`),
        api.get(`/api/reports/profit-loss?${profitQ}`),
      ]);
      setReport(r.data.data);
      setProfitLoss(pl.data.data);
      setProfitCalcRangeQuery(profitQ);
      setProfitCalcReloadToken((t) => t + 1);
    } catch (e: any) {
      setReport(null);
      toast({
        title: 'Error',
        description: e.response?.data?.message || 'Report load nahi hua',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const exportAll = (format: 'csv' | 'excel' | 'pdf' = 'csv') => {
    if (!report) return;
    exportBusinessProfitLossReport(format, report);
    toast({
      title: 'Export complete',
      description: `Profit & Loss report (${format.toUpperCase()}) download ho gayi hai`,
    });
  };

  const loadCustomers = async () => {
    try {
      const r = await api.get('/api/customers/getall-customers');
      setCustomers(r.data.data || []);
    } catch {
      toast({ title: 'Customers load failed', variant: 'destructive' });
    }
  };

  const loadLedger = async () => {
    if (!customerId) {
      toast({ title: 'Customer select karen', variant: 'destructive' });
      return;
    }
    setLoadingLedger(true);
    try {
      const r = await api.get(`/api/reports/customer-ledger?customerId=${customerId}`);
      setLedger(r.data.data);
    } catch (e: any) {
      setLedger(null);
      toast({ title: 'Error', description: e.response?.data?.message || 'Ledger failed', variant: 'destructive' });
    } finally {
      setLoadingLedger(false);
    }
  };

  const purchaseRows =
    report?.purchases?.map((p: any) => ({
      _id: p._id,
      date: p.date,
      receiptNo: p.receiptNo,
      vendor: p.vendor,
      materialName: p.materialName,
      weightKg: `${p.weightKg} kg`,
      pricePerKg: fmtRs(p.pricePerKg),
      priceRs: fmtRs(p.priceRs),
      remainingKg: `${p.remainingKg} kg`,
    })) || [];

  const productionRows =
    report?.production?.map((p: any) => ({
      _id: p._id,
      date: p.date,
      batchNo: p.batchNo,
      materialName: p.materialName,
      inputKg: `${p.inputKg} kg`,
      outputKg: `${p.outputKg} kg`,
      wasteKg: `${p.wasteKg} kg`,
      yieldPercent: `${p.yieldPercent}%`,
      costRs: fmtRs(p.totalProductionCostRs),
    })) || [];

  const salesRows =
    report?.sales?.map((s: any) => ({
      _id: s._id,
      date: s.date,
      invoiceNo: s.invoiceNo,
      buyerName: s.buyerName,
      materialName: s.materialName,
      weightKg: `${s.weightKg} kg`,
      revenueRs: fmtRs(s.revenueRs),
      deliveryRs: fmtRs(s.deliveryChargesRs ?? 0),
      costRs: fmtRs(s.costRs),
      profitRs: fmtRs(s.profitRs),
    })) || [];

  const expenseRows =
    report?.expenses?.map((e: any) => ({
      _id: e._id,
      date: e.date,
      category: e.category || 'General',
      subject: e.subject,
      purpose: e.purpose,
      usage: e.usage,
      priceRs: fmtRs(e.priceRs),
      personResponsible: e.personResponsible,
    })) || [];

  const expenseCategoryRows =
    report?.expenseCategories?.map((c: any) => ({
      category: c.category,
      count: c.count,
      totalRs: fmtRs(c.totalRs),
    })) || [];

  const s = report?.summary;

  const profitLossExport = report
    ? buildProfitLossExport({
        label: report.label,
        startDate: report.startDate,
        endDate: report.endDate,
        summary: report.summary,
        expenses: report.expenses,
        expenseCategories: report.expenseCategories,
      })
    : null;

  function PlTable({
    title,
    lines,
    note,
  }: {
    title: string;
    lines: { label: string; amount: number | null; indent?: boolean; bold?: boolean; isHeader?: boolean }[];
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
                <th className="text-right px-3 py-2">Amount (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-t border-border">
                  <td
                    className={`px-3 py-2 ${line.indent ? 'pl-6 text-muted-foreground' : ''} ${
                      line.bold ? 'font-semibold text-foreground' : ''
                    }`}
                  >
                    {line.label}
                  </td>
                  <td className={`px-3 py-2 text-right ${line.bold ? 'font-semibold' : ''}`}>
                    {line.amount != null ? line.amount.toLocaleString() : '—'}
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

  return (
    <div className="flex-1 min-w-0 p-4 md:p-6 space-y-6 overflow-auto">
      <div className="bg-cms-table-header rounded-lg px-4 py-3 border-l-4 border-primary">
        <h2 className="text-xl font-bold text-foreground">Business Reports</h2>
        <p className="text-sm text-muted-foreground">
          Mall (POP) → Process → Sales → Kharcha — daily, monthly, yearly ya custom date range
        </p>
      </div>

      {/* Filters */}
      <section className="rounded-lg border border-border bg-cms-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Period filter</h3>
        <div className="flex flex-wrap gap-2">
          {(['daily', 'monthly', 'yearly', 'custom'] as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
              className="capitalize"
            >
              {p === 'custom' ? 'Custom range' : p}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {period === 'daily' && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
            </div>
          )}
          {period === 'monthly' && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Month</label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-xs" />
            </div>
          )}
          {period === 'yearly' && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Year</label>
              <Input
                type="number"
                min={2020}
                max={2035}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="max-w-[120px]"
              />
            </div>
          )}
          {period === 'custom' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">From</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="max-w-xs" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">To</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="max-w-xs" />
              </div>
            </>
          )}
          <Button onClick={loadReport} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Load Report
          </Button>
          {report && (
            <>
              <Button variant="outline" size="sm" onClick={() => exportAll('csv')}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportAll('excel')}>
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportAll('pdf')}>
                PDF
              </Button>
            </>
          )}
        </div>

        {report && (
          <p className="text-sm text-muted-foreground">
            Showing: <strong className="text-foreground">{report.label}</strong>
            {report.startDate !== report.endDate && (
              <span> ({report.startDate} — {report.endDate})</span>
            )}
          </p>
        )}
      </section>

      <ProfitCalculationSection
        rangeQuery={profitCalcRangeQuery}
        reloadToken={profitCalcReloadToken}
      />

      {loading && !report && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading report…
        </div>
      )}

      {s && (
        <>
          {/* Summary */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <SummaryCard
              label="Mall / POP (Cost)"
              value={fmtRs(s.purchases.totalCostRs)}
              sub={`${s.purchases.count} entries · ${fmtKg(s.purchases.totalWeightKg)}`}
            />
            <SummaryCard
              label="Process Output"
              value={fmtKg(s.production.outputKg)}
              sub={`Waste ${fmtKg(s.production.wasteKg)} · Input ${fmtKg(s.production.inputKg)}`}
            />
            <SummaryCard
              label="Sales Revenue"
              value={fmtRs(s.sales.revenueRs)}
              sub={`${s.sales.count} sales · ${fmtKg(s.sales.totalWeightKg)}`}
            />
            <SummaryCard
              label="Sales Profit"
              value={fmtRs(s.sales.profitRs)}
              sub={`Cost ${fmtRs(s.sales.costRs)}`}
            />
            <SummaryCard label="Kharcha" value={fmtRs(s.expenses.totalRs)} sub={`${s.expenses.count} entries`} />
            <SummaryCard
              label="Selling Expenses (Delivery)"
              value={fmtRs(s.sellingExpenses?.totalRs ?? 0)}
              sub="POS delivery / transport charges"
            />
            <SummaryCard
              label="Gross Profit"
              value={fmtRs(s.grossProfitRs)}
              sub="Revenue − sale cost"
            />
            <SummaryCard
              label="Net Profit"
              value={fmtRs(s.netProfitRs)}
              sub={s.formula}
              highlight
            />
            <SummaryCard
              label="Production Cost"
              value={fmtRs(s.production.totalCostRs)}
              sub={`${s.production.count} batches`}
            />
          </div>

          {profitLossExport && (
            <>
              <PlTable
                title="Profit & Loss — Summary (Overall)"
                lines={profitLossExport.summaryLines}
                note={profitLossExport.costOfSaleNote}
              />
              <PlTable
                title="Profit & Loss — Detail (Har Kharcha)"
                lines={profitLossExport.detailLines}
                note={profitLossExport.expensesNote}
              />
            </>
          )}

          <DataTable
            title="1. Mall aya (POP / Purchase)"
            icon={<Package className="w-5 h-5 text-blue-500" />}
            headers={[
              { key: 'date', label: 'Date' },
              { key: 'receiptNo', label: 'Receipt' },
              { key: 'vendor', label: 'Vendor' },
              { key: 'materialName', label: 'Material' },
              { key: 'weightKg', label: 'Weight', align: 'right' },
              { key: 'pricePerKg', label: 'Price/kg', align: 'right' },
              { key: 'priceRs', label: 'Total', align: 'right' },
              { key: 'remainingKg', label: 'Remaining', align: 'right' },
            ]}
            rows={purchaseRows}
            emptyMsg="Is period mein koi purchase nahi."
          />

          {report.purchases?.some((p: any) => p.materials?.length > 0) && (
            <section className="rounded-lg border border-border bg-cms-card/50 p-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Purchase line items (material detail)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1">Receipt</th>
                      <th className="text-left py-1">Material</th>
                      <th className="text-left py-1">Code</th>
                      <th className="text-right py-1">Weight</th>
                      <th className="text-right py-1">Price/kg</th>
                      <th className="text-right py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.purchases.flatMap((p: any) =>
                      (p.materials || []).map((m: any, idx: number) => (
                        <tr key={`${p._id}-${idx}`} className="border-t border-border/50">
                          <td className="py-1">{p.receiptNo}</td>
                          <td className="py-1">{m.name}</td>
                          <td className="py-1">{m.productCode || '—'}</td>
                          <td className="py-1 text-right">{m.weightKg} kg</td>
                          <td className="py-1 text-right">{fmtRs(m.pricePerKg)}</td>
                          <td className="py-1 text-right">{fmtRs(m.totalRs)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <DataTable
            title="2. Process (Production)"
            icon={<Factory className="w-5 h-5 text-amber-500" />}
            headers={[
              { key: 'date', label: 'Date' },
              { key: 'batchNo', label: 'Batch' },
              { key: 'materialName', label: 'Material' },
              { key: 'inputKg', label: 'Input (POP)', align: 'right' },
              { key: 'outputKg', label: 'Output', align: 'right' },
              { key: 'wasteKg', label: 'Waste', align: 'right' },
              { key: 'yieldPercent', label: 'Yield', align: 'right' },
              { key: 'costRs', label: 'Cost', align: 'right' },
            ]}
            rows={productionRows}
            emptyMsg="Is period mein koi production nahi."
          />

          <DataTable
            title="3. Sales (POS)"
            icon={<ShoppingCart className="w-5 h-5 text-green-500" />}
            headers={[
              { key: 'date', label: 'Date' },
              { key: 'invoiceNo', label: 'Invoice' },
              { key: 'buyerName', label: 'Customer' },
              { key: 'materialName', label: 'Material' },
              { key: 'weightKg', label: 'Weight', align: 'right' },
              { key: 'revenueRs', label: 'Sale', align: 'right' },
              { key: 'deliveryRs', label: 'Delivery', align: 'right' },
              { key: 'costRs', label: 'Cost', align: 'right' },
              { key: 'profitRs', label: 'Profit', align: 'right' },
            ]}
            rows={salesRows}
            emptyMsg="Is period mein koi sale nahi."
          />

          <DataTable
            title="4. Kharcha (Expenses)"
            icon={<Receipt className="w-5 h-5 text-red-500" />}
            headers={[
              { key: 'date', label: 'Date' },
              { key: 'category', label: 'Category' },
              { key: 'subject', label: 'Subject' },
              { key: 'purpose', label: 'Purpose' },
              { key: 'usage', label: 'Usage' },
              { key: 'priceRs', label: 'Amount', align: 'right' },
              { key: 'personResponsible', label: 'Responsible' },
            ]}
            rows={expenseRows}
            emptyMsg="Is period mein koi kharcha nahi."
          />

          {expenseCategoryRows.length > 0 && (
            <DataTable
              title="Expense categories"
              icon={<Receipt className="w-5 h-5 text-orange-500" />}
              headers={[
                { key: 'category', label: 'Category' },
                { key: 'count', label: 'Items', align: 'right' },
                { key: 'totalRs', label: 'Total', align: 'right' },
              ]}
              rows={expenseCategoryRows}
              emptyMsg="No expense category summary available."
            />
          )}
        </>
      )}

      {/* Customer ledger */}
      <section className="rounded-lg border border-border bg-cms-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Customer Ledger</h3>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <Button variant="outline" size="sm" onClick={loadCustomers}>
            Load Customers
          </Button>
          <div className="flex-1 min-w-[200px] max-w-md">
            <label className="text-xs text-muted-foreground block mb-1">Customer</label>
            <select
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((c: any) => (
                <option key={c._id} value={c._id}>
                  {c.customerName || c.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={loadLedger} disabled={loadingLedger || !customerId} size="sm">
            {loadingLedger ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Load Ledger
          </Button>
        </div>

        {ledger && (
          <div className="space-y-4">
            <p className="text-lg font-semibold">{ledger.customer}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard label="Opening Balance" value={fmtRs(ledger.openingBalance)} />
              <SummaryCard label="Sales (Credit)" value={fmtRs(ledger.salesAdded)} />
              <SummaryCard label="Payments Received" value={fmtRs(ledger.paymentsReceived)} />
              <SummaryCard label="Outstanding" value={fmtRs(ledger.closingBalance)} highlight />
            </div>
            {ledger.transactions?.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-cms-table-header">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Invoice</th>
                      <th className="text-left px-3 py-2">Material</th>
                      <th className="text-right px-3 py-2">Amount</th>
                      <th className="text-right px-3 py-2">Paid</th>
                      <th className="text-right px-3 py-2">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.transactions.map((t: any) => (
                      <tr key={t._id} className="border-t border-border">
                        <td className="px-3 py-2">{t.date}</td>
                        <td className="px-3 py-2">{t.invoiceNo}</td>
                        <td className="px-3 py-2">{t.materialName}</td>
                        <td className="px-3 py-2 text-right">{fmtRs(t.amountRs)}</td>
                        <td className="px-3 py-2 text-right text-green-600">{fmtRs(t.paidRs)}</td>
                        <td className="px-3 py-2 text-right text-red-600">{fmtRs(t.remainingRs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
