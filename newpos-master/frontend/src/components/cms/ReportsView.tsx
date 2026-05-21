import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportAsCsv, exportAsExcelTable, exportAsPdf } from '@/lib/exportUtils';
import { fetchCompanySettings, getLogoUrl } from '@/lib/companySettings';
import { FileSpreadsheet, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type MovementType = 'raw' | 'finished' | null;

function fmtKg(n: number | undefined) {
  return `${(n ?? 0).toLocaleString()} kg`;
}

function fmtRs(n: number | undefined) {
  return `Rs. ${(n ?? 0).toLocaleString()}`;
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
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
    </div>
  );
}

export default function ReportsView() {
  const [pl, setPl] = useState<any>(null);
  const [movement, setMovement] = useState<any>(null);
  const [movementType, setMovementType] = useState<MovementType>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingPl, setLoadingPl] = useState(false);
  const [loadingMovement, setLoadingMovement] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const loadPl = async () => {
    setLoadingPl(true);
    try {
      const r = await api.get('/api/reports/profit-loss');
      setPl(r.data.data);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.response?.data?.message || 'Failed to load P&L',
        variant: 'destructive',
      });
    } finally {
      setLoadingPl(false);
    }
  };

  const loadMovement = async (type: 'raw' | 'finished') => {
    setLoadingMovement(true);
    setMovementType(type);
    try {
      const r = await api.get(`/api/reports/daily-movement?date=${date}&type=${type}`);
      setMovement(r.data.data);
    } catch (e: any) {
      setMovement(null);
      toast({
        title: 'Error',
        description: e.response?.data?.message || 'Failed to load movement report',
        variant: 'destructive',
      });
    } finally {
      setLoadingMovement(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const r = await api.get('/api/customers/getall-customers');
      setCustomers(r.data.data || r.data.customers || []);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.response?.data?.message || 'Failed to load customers',
        variant: 'destructive',
      });
    }
  };

  const loadLedger = async () => {
    if (!customerId) {
      toast({ title: 'Select customer', variant: 'destructive' });
      return;
    }
    setLoadingLedger(true);
    try {
      const r = await api.get(`/api/reports/customer-ledger?customerId=${customerId}`);
      setLedger(r.data.data);
    } catch (e: any) {
      setLedger(null);
      toast({
        title: 'Error',
        description: e.response?.data?.message || 'Failed to load ledger',
        variant: 'destructive',
      });
    } finally {
      setLoadingLedger(false);
    }
  };

  const exportPl = async (fmt: 'csv' | 'excel' | 'pdf') => {
    if (!pl) return;
    const rows = [
      { Item: 'Total Revenue', Amount: pl.totalRevenue },
      { Item: 'Material Cost', Amount: pl.totalMaterialCost },
      { Item: 'Gross Profit', Amount: pl.grossProfit },
      { Item: 'Kharcha Expenses', Amount: pl.totalExpenses },
      { Item: 'Net Profit', Amount: pl.netProfit },
    ];
    const headers = ['Item', 'Amount'];
    if (fmt === 'csv') exportAsCsv('profit-loss.csv', headers, rows);
    else if (fmt === 'excel') exportAsExcelTable('profit-loss.xls', 'P&L Report', headers, rows);
    else {
      const s = await fetchCompanySettings();
      exportAsPdf(
        'Profit & Loss',
        `<table><tr><th>Item</th><th>Amount (Rs.)</th></tr>${rows
          .map((r) => `<tr><td>${r.Item}</td><td>${Number(r.Amount).toLocaleString()}</td></tr>`)
          .join('')}</table>`,
        s.companyName,
        getLogoUrl(s.logo)
      );
    }
  };

  return (
    <div className="flex-1 min-w-0 p-4 md:p-6 space-y-8 overflow-auto">
      <div className="bg-cms-table-header rounded-lg px-4 py-3 border-l-4 border-primary">
        <h2 className="text-xl font-bold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground">Profit & Loss, daily movement, customer ledger</p>
      </div>

      {/* Profit & Loss */}
      <section className="rounded-lg border border-border bg-cms-card p-5 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Profit & Loss</h3>
        <Button onClick={loadPl} disabled={loadingPl}>
          {loadingPl ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Load P&L
        </Button>
        {pl && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <SummaryCard label="Total Revenue" value={fmtRs(pl.totalRevenue)} />
              <SummaryCard label="Material / Production Cost" value={fmtRs(pl.totalMaterialCost)} />
              <SummaryCard label="Gross Profit" value={fmtRs(pl.grossProfit)} />
              <SummaryCard label="Kharcha (Expenses)" value={fmtRs(pl.totalExpenses)} />
              <SummaryCard label="Net Profit" value={fmtRs(pl.netProfit)} highlight />
            </div>
            <p className="text-xs text-muted-foreground">{pl.formula}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportPl('excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportPl('pdf')}>
                <FileText className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Daily Movement */}
      <section className="rounded-lg border border-border bg-cms-card p-5 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Daily Movement</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
          </div>
          <div className="flex gap-2 items-end">
            <Button
              variant={movementType === 'finished' ? 'default' : 'outline'}
              onClick={() => loadMovement('finished')}
              disabled={loadingMovement}
            >
              Finished Goods
            </Button>
            <Button
              variant={movementType === 'raw' ? 'default' : 'outline'}
              onClick={() => loadMovement('raw')}
              disabled={loadingMovement}
            >
              Raw Material
            </Button>
          </div>
        </div>

        {loadingMovement && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading report…
          </div>
        )}

        {movement && movement.type === 'raw_material' && movement.summary && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Report date: <strong className="text-foreground">{movement.date}</strong> — Raw material (kg)
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard label="Opening Balance" value={fmtKg(movement.summary.openingBalanceKg)} />
              <SummaryCard label="Purchases (day)" value={fmtKg(movement.summary.purchasesDuringPeriodKg)} />
              <SummaryCard
                label="Used in Production"
                value={fmtKg(movement.summary.productionConsumedDuringPeriodKg)}
              />
              <SummaryCard
                label="Closing Balance"
                value={fmtKg(movement.summary.closingBalanceKg)}
                highlight
              />
            </div>

            {movement.purchases?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Purchases on this date</h4>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-cms-table-header">
                      <tr>
                        <th className="text-left px-3 py-2">Receipt</th>
                        <th className="text-left px-3 py-2">Vendor</th>
                        <th className="text-left px-3 py-2">Material</th>
                        <th className="text-right px-3 py-2">Weight</th>
                        <th className="text-right px-3 py-2">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movement.purchases.map((p: any) => (
                        <tr key={p._id} className="border-t border-border">
                          <td className="px-3 py-2">{p.receiptNo}</td>
                          <td className="px-3 py-2">{p.vendor}</td>
                          <td className="px-3 py-2">{p.materialName}</td>
                          <td className="px-3 py-2 text-right">{p.weightKg} kg</td>
                          <td className="px-3 py-2 text-right">{fmtRs(p.priceRs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {movement.productions?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Production on this date</h4>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-cms-table-header">
                      <tr>
                        <th className="text-left px-3 py-2">Batch</th>
                        <th className="text-left px-3 py-2">Material</th>
                        <th className="text-right px-3 py-2">POP Used</th>
                        <th className="text-right px-3 py-2">Output</th>
                        <th className="text-right px-3 py-2">Waste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movement.productions.map((p: any) => (
                        <tr key={p._id} className="border-t border-border">
                          <td className="px-3 py-2">{p.batchNo}</td>
                          <td className="px-3 py-2">{p.materialName}</td>
                          <td className="px-3 py-2 text-right">{p.weightUsedFromPOPKg} kg</td>
                          <td className="px-3 py-2 text-right">{p.outputKg} kg</td>
                          <td className="px-3 py-2 text-right">{p.wasteKg} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!movement.purchases?.length && !movement.productions?.length && (
              <p className="text-sm text-muted-foreground">No purchases or production on this date.</p>
            )}
          </div>
        )}

        {movement && movement.type === 'finished_goods' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Report date: <strong className="text-foreground">{movement.date}</strong> — Finished goods
            </p>
            {movement.products?.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-cms-table-header">
                    <tr>
                      <th className="text-left px-3 py-2">Material</th>
                      <th className="text-right px-3 py-2">Production</th>
                      <th className="text-right px-3 py-2">Sales</th>
                      <th className="text-right px-3 py-2">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movement.products.map((row: any) => (
                      <tr key={row.materialName} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{row.materialName}</td>
                        <td className="px-3 py-2 text-right">{row.productionKg} kg</td>
                        <td className="px-3 py-2 text-right">{row.salesKg} kg</td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">{row.closingKg} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No finished goods movement on this date.</p>
            )}
          </div>
        )}
      </section>

      {/* Customer Ledger */}
      <section className="rounded-lg border border-border bg-cms-card p-5 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Customer Ledger</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <Button variant="outline" onClick={loadCustomers}>
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
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={loadLedger} disabled={loadingLedger || !customerId}>
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
              <SummaryCard label="Outstanding (Closing)" value={fmtRs(ledger.closingBalance)} highlight />
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
                      <th className="text-left px-3 py-2">Status</th>
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
                        <td className="px-3 py-2 capitalize">{t.paymentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sales for this customer.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
