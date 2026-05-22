import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportAsCsv } from '@/lib/exportUtils';
import { FileSpreadsheet, Loader2, RefreshCw, TrendingUp, Package, Factory, ShoppingCart, Receipt } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  const [loading, setLoading] = useState(false);

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

  const loadReport = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/reports/business-pipeline?${buildQuery()}`);
      setReport(r.data.data);
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

  const exportAll = () => {
    if (!report) return;
    const label = report.label || 'report';
    const s = report.summary;

    exportAsCsv(`business-report-${label}.csv`, ['Section', 'Metric', 'Value'], [
      { Section: 'Mall (POP)', Metric: 'Entries', Value: s.purchases.count },
      { Section: 'Mall (POP)', Metric: 'Total Weight (kg)', Value: s.purchases.totalWeightKg },
      { Section: 'Mall (POP)', Metric: 'Total Cost (Rs)', Value: s.purchases.totalCostRs },
      { Section: 'Process', Metric: 'Batches', Value: s.production.count },
      { Section: 'Process', Metric: 'Input (kg)', Value: s.production.inputKg },
      { Section: 'Process', Metric: 'Output (kg)', Value: s.production.outputKg },
      { Section: 'Process', Metric: 'Waste (kg)', Value: s.production.wasteKg },
      { Section: 'Sales', Metric: 'Count', Value: s.sales.count },
      { Section: 'Sales', Metric: 'Revenue (Rs)', Value: s.sales.revenueRs },
      { Section: 'Sales', Metric: 'Profit (Rs)', Value: s.sales.profitRs },
      { Section: 'Kharcha', Metric: 'Total (Rs)', Value: s.expenses.totalRs },
      { Section: 'Summary', Metric: 'Net Profit (Rs)', Value: s.netProfitRs },
    ]);

    if (report.purchases?.length) {
      exportAsCsv(`mall-purchases-${label}.csv`, ['Date', 'Receipt', 'Vendor', 'Material', 'Weight kg', 'Price/kg', 'Total Rs'], report.purchases.map((p: any) => ({
        Date: p.date,
        Receipt: p.receiptNo,
        Vendor: p.vendor,
        Material: p.materialName,
        'Weight kg': p.weightKg,
        'Price/kg': p.pricePerKg,
        'Total Rs': p.priceRs,
      })));
    }
    if (report.production?.length) {
      exportAsCsv(`process-${label}.csv`, ['Date', 'Batch', 'Material', 'Input kg', 'Output kg', 'Waste kg', 'Yield %', 'Cost Rs'], report.production.map((p: any) => ({
        Date: p.date,
        Batch: p.batchNo,
        Material: p.materialName,
        'Input kg': p.inputKg,
        'Output kg': p.outputKg,
        'Waste kg': p.wasteKg,
        'Yield %': p.yieldPercent,
        'Cost Rs': p.totalProductionCostRs,
      })));
    }
    if (report.sales?.length) {
      exportAsCsv(`sales-${label}.csv`, ['Date', 'Invoice', 'Customer', 'Material', 'Weight kg', 'Revenue Rs', 'Cost Rs', 'Profit Rs'], report.sales.map((s: any) => ({
        Date: s.date,
        Invoice: s.invoiceNo,
        Customer: s.buyerName,
        Material: s.materialName,
        'Weight kg': s.weightKg,
        'Revenue Rs': s.revenueRs,
        'Cost Rs': s.costRs,
        'Profit Rs': s.profitRs,
      })));
    }
    toast({ title: 'Export complete', description: 'CSV files download ho gayi hain' });
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
      costRs: fmtRs(s.costRs),
      profitRs: fmtRs(s.profitRs),
    })) || [];

  const expenseRows =
    report?.expenses?.map((e: any) => ({
      _id: e._id,
      date: e.date,
      subject: e.subject,
      purpose: e.purpose,
      usage: e.usage,
      priceRs: fmtRs(e.priceRs),
      personResponsible: e.personResponsible,
    })) || [];

  const s = report?.summary;

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
            <Button variant="outline" size="sm" onClick={exportAll}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Export CSV
            </Button>
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
              { key: 'subject', label: 'Subject' },
              { key: 'purpose', label: 'Purpose' },
              { key: 'usage', label: 'Usage' },
              { key: 'priceRs', label: 'Amount', align: 'right' },
              { key: 'personResponsible', label: 'Responsible' },
            ]}
            rows={expenseRows}
            emptyMsg="Is period mein koi kharcha nahi."
          />
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
