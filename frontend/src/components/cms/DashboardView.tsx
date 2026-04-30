import { Package, ShoppingBag, Users, TrendingUp, DollarSign, TrendingDown, Calendar } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { SalesChart } from "./SalesChart";
import { RoznamchaWidget } from "./RoznamchaWidget";
import { RecentActivity } from "./RecentActivity";
import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const PERIODS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "all", label: "All Time" },
] as const;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    totalExpenses: { value: 0, formatted: "Rs. 0" },
    totalProfit: { value: 0, formatted: "Rs. 0", isPositive: true },
    totalEmployees: { value: 0, formatted: "0" },
  });
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
      const qs = params.toString();
      const url = `${API_BASE_URL/dashboard/stats${qs ? `?${qs}` : ""}`;
      const response = await axios.get(url);
      if (response.data.success) {
        const data = response.data.data;
        if (response.data.periodLabel) setPeriodLabel(response.data.periodLabel);

        let profitValue = data.totalProfit?.value ?? 0;
        let profitFormatted = data.totalProfit?.formatted || `Rs. ${Math.abs(profitValue).toLocaleString()}`;
        if (profitValue < 0) profitFormatted = `-Rs. ${Math.abs(profitValue).toLocaleString()}`;

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
          totalExpenses: {
            value: data.expensesAmount?.value ?? data.totalExpenses?.value ?? 0,
            formatted: data.expensesAmount?.formatted ?? data.totalExpenses?.formatted ?? "Rs. 0",
          },
          totalProfit: {
            value: profitValue,
            formatted: profitFormatted,
            isPositive: profitValue >= 0,
          },
          totalEmployees: {
            value: data.totalEmployees?.value ?? 0,
            formatted: data.totalEmployees?.formatted ?? String(data.totalEmployees?.value ?? 0),
          },
        });
      } else {
        setError("Backend returned success: false");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Failed to load dashboard data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period, selectedMonth, selectedYear]);

  if (loading) {
    return (
      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard Overview</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
          {[...Array(6)].map((_, i) => (
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
          <button onClick={() => fetchDashboardData()} className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm">
            Retry
          </button>
        </div>
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
        <div className="text-center py-8">
          <button onClick={() => fetchDashboardData()} className="bg-primary text-primary-foreground px-6 py-2 rounded">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
      {/* Header + Period selector + Month/Year calendar */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Month / Year picker - show when Monthly or Yearly selected */}
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
            <span className="text-sm text-foreground">
              {period === "monthly" ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}` : `Year ${selectedYear}`}
            </span>
          </div>
        )}
      </div>

      {/* Stats: Total Products, Sales count, Sales amount, Expenses (roznamcha), Profit (sales - expenses) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatsCard
          icon={Package}
          iconColor="text-cms-accent"
          label="Total Products"
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
          icon={TrendingDown}
          iconColor="text-cms-orange"
          label="Expenses (Roznamcha)"
          value={dashboardStats.totalExpenses.formatted}
        />
        <StatsCard
          icon={dashboardStats.totalProfit.isPositive ? TrendingUp : TrendingDown}
          iconColor={dashboardStats.totalProfit.isPositive ? "text-cms-success" : "text-cms-orange"}
          label="Profit"
          value={dashboardStats.totalProfit.formatted}
          valueColor={dashboardStats.totalProfit.isPositive ? "text-cms-success" : "text-red-600"}
        />
        <StatsCard
          icon={Users}
          iconColor="text-cms-warning"
          label="Employees"
          value={dashboardStats.totalEmployees.formatted}
        />
      </div>

      {/* Charts Row - stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="lg:col-span-2 min-w-0">
          <SalesChart />
        </div>
        <div className="lg:col-span-1 min-w-0">
          <RoznamchaWidget />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}