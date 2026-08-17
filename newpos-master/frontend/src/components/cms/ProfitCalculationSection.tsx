import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, FileSpreadsheet, Loader2 } from 'lucide-react';
import { exportAsCsv, exportAsExcelTable, exportAsPdf, toExportNumber } from '@/lib/exportUtils';
import { toast } from '@/hooks/use-toast';
import { PRODUCT_CODES } from '@/lib/productCodes';
import {
  SALE_PRICE_STORAGE_KEY,
  loadStoredSalePrices,
  appendSalePricesToParams,
} from '@/lib/profitCalculationStorage';

type BaseRow = {
  code: string;
  itemName: string;
  productionKg: number;
  avgCostPerKg: number;
};

type ProfitCalcData = {
  label: string;
  startDate: string;
  endDate: string;
  rows: BaseRow[];
  summary: {
    expensesRs: number;
    expenseCount: number;
  };
};

function fmtNum(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtRs(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export default function ProfitCalculationSection({
  rangeQuery,
  reloadToken,
}: {
  rangeQuery: string;
  reloadToken: number;
}) {
  const [data, setData] = useState<ProfitCalcData | null>(null);
  const [loading, setLoading] = useState(false);
  const [salePrices, setSalePrices] = useState<Record<string, string>>(loadStoredSalePrices);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(rangeQuery);
      appendSalePricesToParams(params);
      const r = await api.get(`/api/reports/profit-calculation?${params.toString()}`);
      setData(r.data.data);
    } catch (e: unknown) {
      setData(null);
      const err = e as { response?: { data?: { message?: string } } };
      toast({
        title: 'Profit calculation load failed',
        description: err.response?.data?.message || 'Report load nahi hua',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [rangeQuery]);

  useEffect(() => {
    if (reloadToken === 0 || !rangeQuery) return;
    fetchData();
  }, [fetchData, reloadToken, rangeQuery]);

  useEffect(() => {
    localStorage.setItem(SALE_PRICE_STORAGE_KEY, JSON.stringify(salePrices));
  }, [salePrices]);

  const computed = useMemo(() => {
    const baseRows = data?.rows ?? PRODUCT_CODES.map((p) => ({
      code: p.code,
      itemName: p.materialName,
      productionKg: 0,
      avgCostPerKg: 0,
    }));

    const rows = baseRows.map((row) => {
      const raw = salePrices[row.code];
      const salePricePerKg =
        raw != null && String(raw).trim() !== '' ? round2(parseFloat(raw) || 0) : null;
      const grossProfitPerKg =
        salePricePerKg != null ? round2(salePricePerKg - row.avgCostPerKg) : null;
      const totalGrossProfit =
        grossProfitPerKg != null ? round2(row.productionKg * grossProfitPerKg) : null;

      return {
        ...row,
        salePricePerKg,
        grossProfitPerKg,
        totalGrossProfit,
      };
    });

    const totalGrossProfitRs = round2(
      rows.reduce((s, r) => s + (r.totalGrossProfit ?? 0), 0)
    );
    const expensesRs = data?.summary?.expensesRs ?? 0;
    const netProfitRs = round2(totalGrossProfitRs - expensesRs);

    return { rows, totalGrossProfitRs, expensesRs, netProfitRs };
  }, [data, salePrices]);

  const exportReport = (format: 'csv' | 'excel' | 'pdf') => {
    const label = data?.label || 'profit-calculation';
    const exportRows = computed.rows.map((r) => ({
      Product: r.code,
      'Production (kg)': toExportNumber(r.productionKg),
      'Avg. Cost per kg (Rs)': toExportNumber(r.avgCostPerKg),
      'Sale price per kg (Rs)': r.salePricePerKg != null ? toExportNumber(r.salePricePerKg) : '',
      'Gross profit per kg (Rs)': r.grossProfitPerKg != null ? toExportNumber(r.grossProfitPerKg) : '',
      'Total gross profit (Rs)': r.totalGrossProfit != null ? toExportNumber(r.totalGrossProfit) : '',
    }));
    const headers = [
      'Product',
      'Production (kg)',
      'Avg. Cost per kg (Rs)',
      'Sale price per kg (Rs)',
      'Gross profit per kg (Rs)',
      'Total gross profit (Rs)',
    ];

    const summaryHtml = `
      <p><strong>Total Gross Profit:</strong> ${fmtRs(computed.totalGrossProfitRs)}</p>
      <p><strong>Less (Expenses):</strong> ${fmtRs(computed.expensesRs)}</p>
      <p><strong>Net Profit:</strong> ${fmtRs(computed.netProfitRs)}</p>
    `;

    if (format === 'excel') {
      exportAsExcelTable(
        `profit-calculation-${label}.xls`,
        'Profit Calculation on Production Basis',
        headers,
        exportRows
      );
    } else if (format === 'pdf') {
      const body = exportRows
        .map(
          (r) =>
            `<tr><td>${r.Product}</td><td>${r['Production in Kg']}</td><td>${r['Avg. Cost per Kg']}</td><td>${r['Sale price per Kg']}</td><td>${r['Gross profit per Kg']}</td><td>${r['Total gross profit']}</td></tr>`
        )
        .join('');
      exportAsPdf(
        'Profit Calculation on Production Basis',
        `<h2>Profit Calculation on Production Basis</h2><p>${label}</p><table border="1" cellpadding="4"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>${summaryHtml}`
      );
    } else {
      exportAsCsv(`profit-calculation-${label}.csv`, headers, exportRows);
    }

    toast({ title: 'Export complete', description: `${format.toUpperCase()} file download ho gayi hai` });
  };

  return (
    <section className="rounded-lg border border-border bg-cms-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Calculator className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Profit Calculation on Production Basis
            </h3>
            {data && (
              <p className="text-sm text-muted-foreground">
                Period: <strong className="text-foreground">{data.label}</strong>
                {data.startDate !== data.endDate && (
                  <span> ({data.startDate} — {data.endDate})</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportReport('csv')}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReport('excel')}>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReport('pdf')}>
            PDF
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-muted-foreground py-6">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading profit calculation…
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-cms-table-header">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    1: Production in Kg
                  </th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    2: Avg. Cost per Kg
                  </th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    3: Sale price per Kg
                  </th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    4: Gross profit per Kg
                  </th>
                  <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    5: Total gross profit
                  </th>
                </tr>
              </thead>
              <tbody>
                {computed.rows.map((row) => (
                  <tr key={row.code} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{row.code}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.productionKg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.avgCostPerKg)}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="Manual"
                        className="h-8 w-[110px] text-right ml-auto"
                        value={salePrices[row.code] ?? ''}
                        onChange={(e) =>
                          setSalePrices((prev) => ({ ...prev, [row.code]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-green-700 dark:text-green-400">
                      {fmtNum(row.grossProfitPerKg)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {fmtNum(row.totalGrossProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 max-w-xl">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Total Gross Profit</span>
              <span className="font-bold tabular-nums">{fmtRs(computed.totalGrossProfitRs)}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Less (Expenses)
                <span className="block text-xs">All expenses as shown in original report</span>
              </span>
              <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                {fmtRs(computed.expensesRs)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm border-t border-border pt-2">
              <span className="font-medium">Net Profit</span>
              <span className="font-bold text-primary tabular-nums text-lg">
                {fmtRs(computed.netProfitRs)}
              </span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
            <p>1. Production in Kg — linked with FP Summary ledger</p>
            <p>2. Avg. cost per Kg — linked with FP Summary ledger</p>
            <p>3. Sale price per Kg — manual entry</p>
            <p>4. Gross profit per kg = Sale price per kg − Avg. cost per kg</p>
            <p>5. Total Gross profit = Production in Kg × Gross profit per kg</p>
          </div>
        </>
      )}
    </section>
  );
}
