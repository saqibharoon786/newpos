import {
  Package,
  ShoppingBag,
  Users,
  TrendingUp,
  DollarSign,
  TrendingDown,
  Calendar,
  Factory,
  Calculator,
} from "lucide-react";
import { StatsCard } from "./StatsCard";
import { SalesChart } from "./SalesChart";
import { RoznamchaWidget } from "./RoznamchaWidget";
import { RecentActivity } from "./RecentActivity";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { appendSalePricesToParams } from "@/lib/profitCalculationStorage";
import { NotificationsPanel } from "./NotificationsPanel";

const PERIODS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "all", label: "All Time" },
] as const;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type ProductionBasisRow = {
  code: string;
  itemName: string;
  productionKg: number;
  avgCostPerKg: number;
  salePricePerKg: number | null;
  grossProfitPerKg: number | null;
  totalGrossProfit: number | null;
};

type ProductionBasisData = {
  summary: {
    totalProductionKg: number;
    totalProductionCostRs: number;
    totalGrossProfitRs: number;
    totalExpensesRs: number;
    netProfitRs: number;
    expenseCount: number;
  };
  rows: ProductionBasisRow[];
};

function fmtNum(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtRs(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `Rs. ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function parseProfitFormatted(value: number, formatted?: string) {
  let profitFormatted = formatted || `Rs. ${Math.abs(value).toLocaleString()}`;
  if (value < 0) profitFormatted = `-Rs. ${Math.abs(value).toLocaleString()}`;
  return profitFormatted;
}

export function DashboardView() {
  const now = new Date();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly" | "all">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [periodLabel, setPeriodLabel] = useState("This Month");
  const [dashboardStats, setDashboardStats] = useState({
    totalProducts: { value: 0, formatted: "0" },
    totalSalesCount: { value: 0, formatted: "0" },
    salesRevenue: { value: 0, formatted: "Rs. 0" },
    totalEmployees: { value: 0, formatted: "0" },
  });
  const [productionBasis, setProductionBasis] = useState<ProductionBasisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (period !== "all") {
        params.set("period", period);
        if (period === "monthly") {
          params.set("year", String(selectedYear));
          params.set("month", String(selectedMonth));
        } else if (period === "yearly") {
          params.set("year", String(selectedYear));
        }
      }
      appendSalePricesToParams(params);
      const qs = params.toString();
      const response = await api.get(`/api/dashboard/stats${qs ? `?${qs}` : ""}`);
      if (response.data.success) {
        const data = response.data.data;
        if (response.data.periodLabel) setPeriodLabel(response.data.periodLabel);

        setDashboardStats({
          totalProducts: {
            value: data.totalProducts?.value ?? 0,
            formatted: data.totalProducts?.formatted ?? String(data.totalProducts?.value ?? 0),
          },
          totalSalesCount: {
            value: data.totalSales?.value ?? 0,
            formatted: data.totalSales?.formatted ?? String(data.totalSales?.value ?? 0),
          },
          salesRevenue: {
            value: data.salesRevenue?.value ?? 0,
            formatted: data.salesRevenue?.formatted ?? "Rs. 0",
          },
          totalEmployees: {
            value: data.totalEmployees?.value ?? 0,
            formatted: data.totalEmployees?.formatted ?? String(data.totalEmployees?.value ?? 0),
          },
        });

        const pb = response.data.productionBasis as ProductionBasisData | undefined;
        if (pb?.summary) {
          setProductionBasis(pb);
        } else if (data.totalProductionKg || data.totalProfit) {
          setProductionBasis({
            summary: {
              totalProductionKg: data.totalProductionKg?.value ?? 0,
              totalProductionCostRs: data.totalProductionCost?.value ?? 0,
              totalGrossProfitRs: data.grossProfit?.value ?? 0,
              totalExpensesRs: data.expensesAmount?.value ?? 0,
              netProfitRs: data.totalProfit?.value ?? 0,
              expenseCount: 0,
            },
            rows: [],
          });
        } else {
          setProductionBasis(null);
        }
      } else {
        setError("Backend returned success: false");
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError("Session expired. Please logout and login again.");
      } else if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
        setError("Cannot reach server. Start Backend: cd Backend && npm run dev");
      } else {
        setError(`Failed to load dashboard data: ${err.response?.data?.message || err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period, selectedMonth, selectedYear]);

  const pbSummary = productionBasis?.summary;
  const netProfitValue = pbSummary?.netProfitRs ?? 0;
  const netProfitPositive = netProfitValue >= 0;

  if (loading) {
    return (
      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard Overview</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-cms-card rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-6 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
        <div className="flex justify-between items-center mb-4 sm:mb-6 gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <button
            onClick={() => fetchDashboardData()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm"
          >
            Retry
          </button>
        </div>
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
      <NotificationsPanel />
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {periodLabel}
            </span>
            <div className="flex items-center gap-1 bg-cms-card rounded-lg p-1 border border-border">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    period === p.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-cms-card-hover"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchDashboardData()}
              className="p-2 rounded-lg bg-cms-card border border-border hover:bg-cms-card-hover"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {(period === "monthly" || period === "yearly") && (
          <div className="flex items-center gap-3 flex-wrap bg-cms-card rounded-xl p-3 border border-border">
            <span className="text-sm text-muted-foreground">Select period:</span>
            {period === "monthly" && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-cms-input-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-cms-input-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Operations overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatsCard
          icon={Package}
          iconColor="text-cms-accent"
          label="Total Products (POP)"
          value={dashboardStats.totalProducts.formatted}
        />
        <StatsCard
          icon={ShoppingBag}
          iconColor="text-cms-success"
          label="Sales (count)"
          value={dashboardStats.totalSalesCount.formatted}
        />
        <StatsCard
          icon={DollarSign}
          iconColor="text-green-600"
          label="Sales Amount"
          value={dashboardStats.salesRevenue.formatted}
        />
        <StatsCard
          icon={Users}
          iconColor="text-cms-warning"
          label="Employees"
          value={dashboardStats.totalEmployees.formatted}
        />
      </div>

      {/* Production Basis — same as Reports → Profit Calculation */}
      {pbSummary && (
        <section className="mb-4 sm:mb-6 rounded-xl border border-border bg-cms-card p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-2">
            <Calculator className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Profit Calculation on Production Basis
              </h2>
              <p className="text-sm text-muted-foreground">
                Reports wali calculation — FP Summary production, avg cost, sale price (Reports se set), gross & net profit
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <StatsCard
              icon={Factory}
              iconColor="text-blue-600"
              label="Total Production"
              value={`${fmtNum(pbSummary.totalProductionKg)} kg`}
            />
            <StatsCard
              icon={Package}
              iconColor="text-cms-orange"
              label="Production Cost"
              value={fmtRs(pbSummary.totalProductionCostRs)}
            />
            <StatsCard
              icon={TrendingUp}
              iconColor="text-cms-success"
              label="Total Gross Profit"
              value={fmtRs(pbSummary.totalGrossProfitRs)}
            />
            <StatsCard
              icon={TrendingDown}
              iconColor="text-cms-orange"
              label="Expenses (Roznamcha)"
              value={fmtRs(pbSummary.totalExpensesRs)}
            />
            <StatsCard
              icon={netProfitPositive ? TrendingUp : TrendingDown}
              iconColor={netProfitPositive ? "text-cms-success" : "text-red-600"}
              label="Net Profit"
              value={parseProfitFormatted(netProfitValue, fmtRs(netProfitValue))}
              valueColor={netProfitPositive ? "text-cms-success" : "text-red-600"}
            />
          </div>

          {productionBasis.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-cms-table-header">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Product</th>
                    <th className="px-3 py-2 text-right font-semibold">Production (Kg)</th>
                    <th className="px-3 py-2 text-right font-semibold">Avg. Cost/Kg</th>
                    <th className="px-3 py-2 text-right font-semibold">Sale Price/Kg</th>
                    <th className="px-3 py-2 text-right font-semibold">Gross Profit/Kg</th>
                    <th className="px-3 py-2 text-right font-semibold">Total Gross Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {productionBasis.rows.map((row) => (
                    <tr key={row.code} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {row.code} — {row.itemName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.productionKg)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.avgCostPerKg)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(row.salePricePerKg)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
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
          )}

          <div className="rounded-lg border border-border bg-muted/20 p-4 max-w-xl space-y-2">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Total Gross Profit</span>
              <span className="font-bold tabular-nums">{fmtRs(pbSummary.totalGrossProfitRs)}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Less (Expenses)
                {pbSummary.expenseCount > 0 && (
                  <span className="block text-xs">{pbSummary.expenseCount} entries</span>
                )}
              </span>
              <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                {fmtRs(pbSummary.totalExpensesRs)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm border-t border-border pt-2">
              <span className="font-medium">Net Profit</span>
              <span
                className={`font-bold tabular-nums text-lg ${netProfitPositive ? "text-primary" : "text-red-600"}`}
              >
                {parseProfitFormatted(netProfitValue, fmtRs(netProfitValue))}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Sale price per kg Reports section mein set hoti hai — Dashboard wahi prices use karta hai.
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="lg:col-span-2 min-w-0">
          <SalesChart />
        </div>
        <div className="lg:col-span-1 min-w-0">
          <RoznamchaWidget />
        </div>
      </div>

      <RecentActivity />
    </div>
  );
}
