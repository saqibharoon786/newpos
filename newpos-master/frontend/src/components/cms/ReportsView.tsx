import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportAsCsv, exportAsExcelTable, exportAsPdf } from '@/lib/exportUtils';
import { fetchCompanySettings, getLogoUrl } from '@/lib/companySettings';

export default function ReportsView() {
  const [pl, setPl] = useState<any>(null);
  const [movement, setMovement] = useState<any>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<any[]>([]);

  const loadPl = async () => {
    const r = await api.get('/api/reports/profit-loss');
    setPl(r.data.data);
  };

  const loadMovement = async (type: string) => {
    const r = await api.get(`/api/reports/daily-movement?date=${date}&type=${type}`);
    setMovement(r.data.data);
  };

  const loadCustomers = async () => {
    const r = await api.get('/api/customers/getall-customers');
    setCustomers(r.data.data || r.data.customers || []);
  };

  const loadLedger = async () => {
    if (!customerId) return;
    const r = await api.get(`/api/reports/customer-ledger?customerId=${customerId}`);
    setLedger(r.data.data);
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
      exportAsPdf('Profit & Loss', `<table><tr><th>Item</th><th>Amount</th></tr>${rows.map((r) => `<tr><td>${r.Item}</td><td>Rs. ${r.Amount?.toLocaleString()}</td></tr>`).join('')}</table>`, s.companyName, getLogoUrl(s.logo));
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Reports</h2>

      <section className="p-4 border rounded-lg space-y-3">
        <h3 className="font-medium">Profit & Loss</h3>
        <Button onClick={loadPl}>Load P&L</Button>
        {pl && (
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <p>Revenue: Rs. {pl.totalRevenue?.toLocaleString()}</p>
            <p>Material Cost: Rs. {pl.totalMaterialCost?.toLocaleString()}</p>
            <p>Gross Profit: Rs. {pl.grossProfit?.toLocaleString()}</p>
            <p>Expenses: Rs. {pl.totalExpenses?.toLocaleString()}</p>
            <p className="font-bold">Net Profit: Rs. {pl.netProfit?.toLocaleString()}</p>
            <div className="flex gap-2 sm:col-span-2">
              <Button size="sm" variant="outline" onClick={() => exportPl('excel')}>Excel</Button>
              <Button size="sm" variant="outline" onClick={() => exportPl('pdf')}>PDF</Button>
            </div>
          </div>
        )}
      </section>

      <section className="p-4 border rounded-lg space-y-3">
        <h3 className="font-medium">Daily Movement</h3>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadMovement('finished')}>Finished Goods</Button>
          <Button variant="outline" onClick={() => loadMovement('raw')}>Raw Material</Button>
        </div>
        {movement && <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">{JSON.stringify(movement, null, 2)}</pre>}
      </section>

      <section className="p-4 border rounded-lg space-y-3">
        <h3 className="font-medium">Customer Ledger</h3>
        <Button variant="outline" onClick={loadCustomers}>Load Customers</Button>
        <select className="border rounded px-3 py-2 max-w-md w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select customer</option>
          {customers.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <Button onClick={loadLedger}>Load Ledger</Button>
        {ledger && (
          <div className="text-sm space-y-1">
            <p>Opening: Rs. {ledger.openingBalance?.toLocaleString()}</p>
            <p>Sales: Rs. {ledger.salesAdded?.toLocaleString()}</p>
            <p>Received: Rs. {ledger.paymentsReceived?.toLocaleString()}</p>
            <p className="font-bold">Closing: Rs. {ledger.closingBalance?.toLocaleString()}</p>
          </div>
        )}
      </section>
    </div>
  );
}
