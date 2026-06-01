import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { exportAsCsv, exportAsExcelTable, exportAsPdf } from '@/lib/exportUtils';
import {
  BookOpen,
  Loader2,
  RefreshCw,
  Package,
  Factory,
  ShoppingCart,
  Store,
  Users,
  Truck,
  UserCog,
  Crown,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PRODUCT_CODES } from '@/lib/productCodes';

const LEDGER_API = '/api/ledger';

type LedgerTab =
  | 'rm-summary'
  | 'rm-detail'
  | 'fp-summary'
  | 'fp-detail'
  | 'purchases'
  | 'sales'
  | 'vendor'
  | 'customer'
  | 'owner'
  | 'employee';

function fmtKg(n: number | undefined) {
  return `${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
}

function fmtRs(n: number | undefined) {
  return `Rs. ${(n ?? 0).toLocaleString()}`;
}

function currentMonthRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return {
    start: `${y}-${String(m).padStart(2, '0')}-01`,
    end: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  };
}

const TABS: { id: LedgerTab; label: string; icon: React.ReactNode }[] = [
  { id: 'rm-summary', label: 'RM Summary', icon: <Package className="w-4 h-4" /> },
  { id: 'rm-detail', label: 'RM Ledger', icon: <Package className="w-4 h-4" /> },
  { id: 'fp-summary', label: 'FP Summary', icon: <Factory className="w-4 h-4" /> },
  { id: 'fp-detail', label: 'FP Ledger', icon: <Factory className="w-4 h-4" /> },
  { id: 'purchases', label: 'Purchase Ledger', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'sales', label: 'Sales Ledger', icon: <Store className="w-4 h-4" /> },
  { id: 'vendor', label: 'Vendor Ledger', icon: <Truck className="w-4 h-4" /> },
  { id: 'customer', label: 'Customer Ledger', icon: <Users className="w-4 h-4" /> },
  { id: 'owner', label: 'Owner Advance', icon: <Crown className="w-4 h-4" /> },
  { id: 'employee', label: 'Employee Advance', icon: <UserCog className="w-4 h-4" /> },
];

export default function LedgerView() {
  const month = currentMonthRange();
  const [activeTab, setActiveTab] = useState<LedgerTab>('rm-summary');
  const [startDate, setStartDate] = useState(month.start);
  const [endDate, setEndDate] = useState(month.end);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const [vendors, setVendors] = useState<{ _id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ _id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string; employeeId: string }[]>([]);

  const [selectedCode, setSelectedCode] = useState('100');
  const [vendorId, setVendorId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const params = { startDate, endDate };

  useEffect(() => {
    api
      .get(`${LEDGER_API}/meta`, { params })
      .then((r) => {
        if (r.data?.success) {
          setVendors(r.data.vendors || []);
          setCustomers(r.data.customers || []);
          setEmployees(r.data.employees || []);
        }
      })
      .catch(() => {});
  }, [startDate, endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      let url = '';
      switch (activeTab) {
        case 'rm-summary':
          url = `${LEDGER_API}/rm-summary`;
          break;
        case 'rm-detail':
          url = `${LEDGER_API}/rm/${selectedCode}`;
          break;
        case 'fp-summary':
          url = `${LEDGER_API}/fp-summary`;
          break;
        case 'fp-detail':
          url = `${LEDGER_API}/fp/${selectedCode}`;
          break;
        case 'purchases':
          url = `${LEDGER_API}/purchases`;
          break;
        case 'sales':
          url = `${LEDGER_API}/sales`;
          break;
        case 'vendor':
          if (!vendorId) {
            toast({ title: 'Vendor select karen', variant: 'destructive' });
            setLoading(false);
            return;
          }
          url = `${LEDGER_API}/vendor/${vendorId}`;
          break;
        case 'customer':
          if (!customerId) {
            toast({ title: 'Customer select karen', variant: 'destructive' });
            setLoading(false);
            return;
          }
          url = `${LEDGER_API}/customer/${customerId}`;
          break;
        case 'owner':
          url = `${LEDGER_API}/owner-advance`;
          break;
        case 'employee':
          if (!employeeId) {
            toast({ title: 'Employee select karen', variant: 'destructive' });
            setLoading(false);
            return;
          }
          url = `${LEDGER_API}/employee/${employeeId}`;
          break;
      }
      const r = await api.get(url, { params });
      if (r.data?.success) setData(r.data.data);
      else throw new Error(r.data?.message || 'Failed');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast({
        title: 'Ledger load failed',
        description: err.response?.data?.message || 'Error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, selectedCode, vendorId, customerId, employeeId]);

  const exportLedger = (format: 'excel' | 'pdf' | 'csv') => {
    if (!data) {
      toast({ title: 'Pehle ledger load karen', variant: 'destructive' });
      return;
    }
    let headers: string[] = [];
    let rows: Record<string, string | number>[] = [];
    const tabLabel = TABS.find((t) => t.id === activeTab)?.label || activeTab;
    const name = `Ledger_${tabLabel}_${startDate}_${endDate}`;

    if ((activeTab === 'rm-detail' || activeTab === 'fp-detail') && data.lines) {
      if (activeTab === 'rm-detail') {
        headers = ['Date', 'Invoice #', 'Vendor', 'Description', 'Purch Qty', 'Rate', 'Amount', 'Issued', 'Closing'];
        rows = (data.lines as Record<string, unknown>[]).map((l) => ({
          Date: String(l.date ?? ''),
          'Invoice #': String(l.invoiceNo ?? '—'),
          Vendor: String(l.vendor ?? '—'),
          Description: String(l.description ?? ''),
          'Purch Qty': l.purchasedQty ? fmtKg(l.purchasedQty as number) : '—',
          Rate: l.purchasedRate ? fmtRs(l.purchasedRate as number) : '—',
          Amount: l.purchasedAmount ? fmtRs(l.purchasedAmount as number) : '—',
          Issued: l.issuedQty ? fmtKg(l.issuedQty as number) : '—',
          Closing: fmtKg(l.closingQty as number),
        }));
      } else {
        headers = ['Date', 'Description', 'From Process', 'Rate', 'Amount', 'Sale Qty', 'Sale Rate', 'Closing'];
        rows = (data.lines as Record<string, unknown>[]).map((l) => ({
          Date: String(l.date ?? ''),
          Description: String(l.description ?? ''),
          'From Process': l.receivedQty ? fmtKg(l.receivedQty as number) : '—',
          Rate: l.receivedRate ? fmtRs(l.receivedRate as number) : '—',
          Amount: l.receivedAmount ? fmtRs(l.receivedAmount as number) : '—',
          'Sale Qty': l.saleQty ? fmtKg(l.saleQty as number) : '—',
          'Sale Rate': l.saleRate ? fmtRs(l.saleRate as number) : '—',
          Closing: fmtKg(l.closingQty as number),
        }));
      }
    } else if (data.rows) {
      if (activeTab === 'vendor' || activeTab === 'customer') {
        headers = ['Date', 'Invoice #', 'Description', 'Debit', 'Credit', 'Balance'];
        rows = (data.lines as Record<string, unknown>[]).map((l) => ({
          Date: String(l.date ?? ''),
          'Invoice #': String(l.invoiceNo ?? '—'),
          Description: String(l.description ?? ''),
          Debit: l.debit ? fmtRs(l.debit as number) : '—',
          Credit: l.credit ? fmtRs(l.credit as number) : '—',
          Balance: fmtRs(l.balance as number),
        }));
      } else if (activeTab === 'purchases' || activeTab === 'sales') {
        headers = ['Date', 'Invoice #', 'Particulars', activeTab === 'purchases' ? 'Vendor' : 'Customer', 'Debit', 'Credit', 'Balance'];
        rows = (data.rows as Record<string, unknown>[]).map((r) => ({
          Date: String(r.date ?? ''),
          'Invoice #': String(r.invoiceNo ?? ''),
          Particulars: String(r.description ?? ''),
          [activeTab === 'purchases' ? 'Vendor' : 'Customer']: String(
            activeTab === 'purchases' ? r.vendor : r.customer
          ),
          Debit: r.debit ? fmtRs(r.debit as number) : '—',
          Credit: r.credit ? fmtRs(r.credit as number) : '—',
          Balance: fmtRs((r.balance ?? r.closing) as number),
        }));
      } else {
        headers = ['Code', 'Item', 'Opening', 'Movement', 'Balance'];
        rows = (data.rows as Record<string, number>[]).map((r) => ({
          Code: r.code,
          Item: r.itemName,
          Opening: fmtKg(r.openingQty),
          Movement:
            activeTab === 'rm-summary'
              ? `P:${fmtKg(r.purchase)} I:${fmtKg(r.issue)}`
              : `Prod:${fmtKg(r.production)} Sale:${fmtKg(r.sale)}`,
          Balance: fmtKg(r.balance),
        }));
      }
    }

    if (!rows.length) {
      toast({ title: 'Export ke liye data nahi', variant: 'destructive' });
      return;
    }
    if (format === 'csv') exportAsCsv(`${name}.csv`, headers, rows);
    else if (format === 'excel') exportAsExcelTable(`${name}.xls`, tabLabel, headers, rows);
    else {
      const body = rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('');
      exportAsPdf(tabLabel, `<table border="1" cellpadding="4"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`);
    }
    toast({ title: `${format.toUpperCase()} exported` });
  };

  const renderTable = (
    headers: { key: string; label: string; align?: 'left' | 'right' }[],
    rows: Record<string, unknown>[],
    emptyMsg: string
  ) => {
    if (!rows?.length) {
      return <p className="text-sm text-muted-foreground py-6">{emptyMsg}</p>;
    }
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-cms-table-header sticky top-0">
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
              <tr key={i} className="border-t border-border hover:bg-muted/30">
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
    );
  };

  const renderContent = () => {
    if (!data) return null;

    if (activeTab === 'rm-summary' && data.rows) {
      const rows = (data.rows as Record<string, number>[]).map((r) => ({
        type: r.type,
        code: r.code,
        itemName: r.itemName,
        openingQty: fmtKg(r.openingQty),
        purchase: fmtKg(r.purchase),
        issue: fmtKg(r.issue),
        avgRate: fmtRs(r.avgRate),
        balance: fmtKg(r.balance),
      }));
      return renderTable(
        [
          { key: 'type', label: 'Type' },
          { key: 'code', label: 'Code' },
          { key: 'itemName', label: 'Item' },
          { key: 'openingQty', label: 'Opening', align: 'right' },
          { key: 'purchase', label: 'Purchase', align: 'right' },
          { key: 'issue', label: 'Issue', align: 'right' },
          { key: 'avgRate', label: 'Avg Rate', align: 'right' },
          { key: 'balance', label: 'Balance', align: 'right' },
        ],
        rows,
        'No RM data'
      );
    }

    if (activeTab === 'fp-summary' && data.rows) {
      const rows = (data.rows as Record<string, number>[]).map((r) => ({
        type: r.type,
        code: r.code,
        itemName: r.itemName,
        openingQty: fmtKg(r.openingQty),
        production: fmtKg(r.production),
        sale: fmtKg(r.sale),
        avgRate: fmtRs(r.avgRate),
        balance: fmtKg(r.balance),
      }));
      return renderTable(
        [
          { key: 'type', label: 'Type' },
          { key: 'code', label: 'Code' },
          { key: 'itemName', label: 'Item' },
          { key: 'openingQty', label: 'Opening', align: 'right' },
          { key: 'production', label: 'Production', align: 'right' },
          { key: 'sale', label: 'Sale', align: 'right' },
          { key: 'avgRate', label: 'Avg Rate', align: 'right' },
          { key: 'balance', label: 'Balance', align: 'right' },
        ],
        rows,
        'No FP data'
      );
    }

    if (activeTab === 'rm-detail' && data.lines) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {String(data.itemName)} — Opening: {fmtKg(data.openingQty as number)} | Closing:{' '}
            {fmtKg(data.closingQty as number)}
          </p>
          {renderTable(
            [
              { key: 'date', label: 'Date' },
              { key: 'invoiceNo', label: 'Invoice #' },
              { key: 'vendor', label: 'Vendor' },
              { key: 'description', label: 'Description' },
              { key: 'purchasedQty', label: 'Purch Qty', align: 'right' },
              { key: 'purchasedRate', label: 'Rate', align: 'right' },
              { key: 'purchasedAmount', label: 'Amount', align: 'right' },
              { key: 'issuedQty', label: 'Issued', align: 'right' },
              { key: 'closingQty', label: 'Closing', align: 'right' },
            ],
            (data.lines as Record<string, unknown>[]).map((l) => ({
              date: l.date,
              invoiceNo: l.invoiceNo ?? '—',
              vendor: l.vendor ?? '—',
              description: l.description,
              purchasedQty: l.purchasedQty ? fmtKg(l.purchasedQty as number) : '—',
              purchasedRate: l.purchasedRate ? fmtRs(l.purchasedRate as number) : '—',
              purchasedAmount: l.purchasedAmount ? fmtRs(l.purchasedAmount as number) : '—',
              issuedQty: l.issuedQty ? fmtKg(l.issuedQty as number) : '—',
              closingQty: fmtKg(l.closingQty as number),
            })),
            'No entries in period'
          )}
        </div>
      );
    }

    if (activeTab === 'fp-detail' && data.lines) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {String(data.itemName)} — Opening: {fmtKg(data.openingQty as number)} | Closing:{' '}
            {fmtKg(data.closingQty as number)}
          </p>
          {renderTable(
            [
              { key: 'date', label: 'Date' },
              { key: 'description', label: 'Description' },
              { key: 'receivedQty', label: 'From Process', align: 'right' },
              { key: 'receivedRate', label: 'Rate', align: 'right' },
              { key: 'receivedAmount', label: 'Amount', align: 'right' },
              { key: 'saleQty', label: 'Sale Qty', align: 'right' },
              { key: 'saleRate', label: 'Sale Rate', align: 'right' },
              { key: 'closingQty', label: 'Closing', align: 'right' },
            ],
            (data.lines as Record<string, unknown>[]).map((l) => ({
              date: l.date,
              description: l.description,
              receivedQty: l.receivedQty ? fmtKg(l.receivedQty as number) : '—',
              receivedRate: l.receivedRate ? fmtRs(l.receivedRate as number) : '—',
              receivedAmount: l.receivedAmount ? fmtRs(l.receivedAmount as number) : '—',
              saleQty: l.saleQty ? fmtKg(l.saleQty as number) : '—',
              saleRate: l.saleRate ? fmtRs(l.saleRate as number) : '—',
              closingQty: fmtKg(l.closingQty as number),
            })),
            'No entries in period'
          )}
        </div>
      );
    }

    if ((activeTab === 'purchases' || activeTab === 'sales') && data.rows) {
      const isPurchase = activeTab === 'purchases';
      const rows = (data.rows as Record<string, unknown>[]).map((r) => ({
        date: r.date,
        invoiceNo: r.invoiceNo,
        description: r.description,
        party: isPurchase ? r.vendor : r.customer,
        debit: r.debit ? fmtRs(r.debit as number) : '—',
        credit: r.credit ? fmtRs(r.credit as number) : '—',
        balance: fmtRs((r.balance ?? r.closing) as number),
      }));
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm max-w-md">
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Opening</span>
              <p className="font-bold">{fmtRs(data.openingBalance as number)}</p>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Closing</span>
              <p className="font-bold">{fmtRs(data.closingBalance as number)}</p>
            </div>
          </div>
          {renderTable(
            [
              { key: 'date', label: 'Date' },
              { key: 'invoiceNo', label: 'Invoice #' },
              { key: 'description', label: 'Particulars' },
              { key: 'party', label: isPurchase ? 'Vendor' : 'Customer' },
              { key: 'debit', label: 'Debit (Rs)', align: 'right' },
              { key: 'credit', label: 'Credit (Rs)', align: 'right' },
              { key: 'balance', label: 'Balance (Rs)', align: 'right' },
            ],
            rows,
            'No transactions'
          )}
        </div>
      );
    }

    if (activeTab === 'vendor' && data.lines) {
      const v = data.vendor as { name: string };
      return (
        <div className="space-y-3">
          <p className="text-lg font-semibold">{v?.name}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Opening</span>
              <p className="font-bold">{fmtRs(data.openingBalance as number)}</p>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Advance</span>
              <p className="font-bold text-green-600">{fmtRs(data.advanceBalance as number)}</p>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Payable</span>
              <p className="font-bold text-red-600">{fmtRs(data.payableBalance as number)}</p>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Closing</span>
              <p className="font-bold">{fmtRs(data.closingBalance as number)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Invoice # alag column — Description sirf detail. Vendor advance (Finance) poori raqam Debit column mein.
          </p>
          {renderTable(
            [
              { key: 'date', label: 'Date' },
              { key: 'invoiceNo', label: 'Invoice #' },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit (Payment)', align: 'right' },
              { key: 'credit', label: 'Credit (Purchase)', align: 'right' },
              { key: 'balance', label: 'Balance (Rs)', align: 'right' },
            ],
            (data.lines as Record<string, unknown>[]).map((l) => ({
              date: l.date,
              invoiceNo: l.invoiceNo,
              description: l.description,
              debit: l.debit ? fmtRs(l.debit as number) : '—',
              credit: l.credit ? fmtRs(l.credit as number) : '—',
              balance: fmtRs(l.balance as number),
            })),
            'No ledger entries'
          )}
        </div>
      );
    }

    if (activeTab === 'customer' && data.lines) {
      const c = data.customer as { name: string };
      return (
        <div className="space-y-3">
          <p className="text-lg font-semibold">{c?.name}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Opening</span>
              <p className="font-bold">{fmtRs(data.openingBalance as number)}</p>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Finance advance</span>
              <p className="font-bold text-green-600">{fmtRs(data.financeAdvanceBalance as number)}</p>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground">Closing due</span>
              <p className="font-bold text-red-600">{fmtRs(data.closingBalance as number)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Balance = Opening + Debit (Sale) − Credit (Payment)
          </p>
          {renderTable(
            [
              { key: 'date', label: 'Date' },
              { key: 'invoiceNo', label: 'Invoice #' },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit (Sale)', align: 'right' },
              { key: 'credit', label: 'Credit (Payment)', align: 'right' },
              { key: 'balance', label: 'Balance (Rs)', align: 'right' },
            ],
            (data.lines as Record<string, unknown>[]).map((l) => ({
              date: l.date,
              invoiceNo: l.invoiceNo,
              description: l.description,
              debit: l.debit ? fmtRs(l.debit as number) : '—',
              credit: l.credit ? fmtRs(l.credit as number) : '—',
              balance: fmtRs(l.balance as number),
            })),
            'No ledger entries'
          )}
        </div>
      );
    }

    if (activeTab === 'owner' && data.lines) {
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Balance = Opening + Debit (Advance Given) − Credit (Payment Received)
          </p>
          {renderTable(
            [
              { key: 'date', label: 'Date' },
              { key: 'voucherNo', label: 'Voucher #' },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit (Advance)', align: 'right' },
              { key: 'credit', label: 'Credit (Received)', align: 'right' },
              { key: 'balance', label: 'Balance (Rs)', align: 'right' },
            ],
            (data.lines as Record<string, unknown>[]).map((l) => ({
              date: l.date,
              voucherNo: l.voucherNo,
              description: `${l.description} (${l.accountName})`,
              debit: l.debit ? fmtRs(l.debit as number) : '—',
              credit: l.credit ? fmtRs(l.credit as number) : '—',
              balance: fmtRs(l.balance as number),
            })),
            'No owner advance transactions — Investment module se add karen'
          )}
        </div>
      );
    }

    if (activeTab === 'employee' && data.lines) {
      const e = data.employee as { name: string; employeeId: string };
      return (
        <div className="space-y-3">
          <p className="text-lg font-semibold">
            {e?.name} ({e?.employeeId})
          </p>
          {data.note && (
            <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
              {String(data.note)}
            </p>
          )}
          {renderTable(
            [
              { key: 'date', label: 'Date' },
              { key: 'voucherNo', label: 'Voucher #' },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit (Advance)', align: 'right' },
              { key: 'credit', label: 'Credit (Received)', align: 'right' },
              { key: 'balance', label: 'Balance (Rs)', align: 'right' },
            ],
            (data.lines as Record<string, unknown>[]).map((l) => ({
              date: l.date,
              voucherNo: l.voucherNo,
              description: l.description,
              debit: l.debit ? fmtRs(l.debit as number) : '—',
              credit: l.credit ? fmtRs(l.credit as number) : '—',
              balance: fmtRs(l.balance as number),
            })),
            'No employee advance on record'
          )}
        </div>
      );
    }

    return null;
  };

  const needsCode = activeTab === 'rm-detail' || activeTab === 'fp-detail';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ledgers</h1>
            <p className="text-sm text-muted-foreground">
              RM, FP, Purchase, Sales, Vendor, Customer, Owner & Employee — format ke mutabiq
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={load} disabled={loading} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Load Ledger
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLedger('excel')} disabled={!data}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLedger('pdf')} disabled={!data}>
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLedger('csv')} disabled={!data}>
            CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-cms-card">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-9" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-9" />
        </div>
        {needsCode && (
          <Select value={selectedCode} onValueChange={setSelectedCode}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Product code" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CODES.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {activeTab === 'vendor' && (
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Vendor" />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v._id} value={v._id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {activeTab === 'customer' && (
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {activeTab === 'employee' && (
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name} ({e.employeeId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTab(t.id);
              setData(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-cms-card p-5 min-h-[320px]">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && !data && (
          <p className="text-center text-muted-foreground py-20">
            Tab select karen aur &quot;Load Ledger&quot; dabayein
          </p>
        )}
        {!loading && data && renderContent()}
      </section>
    </div>
  );
}
