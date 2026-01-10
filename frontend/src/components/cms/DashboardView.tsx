import { Search, Package, ShoppingBag, Users, TrendingUp, DollarSign, TrendingDown } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { SalesChart } from "./SalesChart";
import { RoznamchaWidget } from "./RoznamchaWidget";
import { RecentActivity } from "./RecentActivity";
import { useEffect, useState } from "react";
import axios from "axios";

// API Base URL - For Vite, use import.meta.env
const API_BASE_URL = import.meta.env.VITE_API_URL ;

export function DashboardView() {
  const [dashboardStats, setDashboardStats] = useState({
    rawMaterials: { value: 0, formatted: "0" },
    productSold: { value: 0, formatted: "0" },
    totalEmployees: { value: 0, formatted: "0" },
    totalProfit: { value: 0, formatted: "Rs. 0", isPositive: true },
    totalExpenses: { value: 0, formatted: "Rs. 0" }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Fetching dashboard data from ${API_BASE_URL}/api/dashboard/stats`);
      
      const response = await axios.get(`${API_BASE_URL}/api/dashboard/stats`);
      
      if (response.data.success) {
        const data = response.data.data;
        
        // Calculate profit based on available data
        let profitValue = 0;
        let profitFormatted = "Rs. 0";
        let isPositive = true;
        
        // Try different profit fields from backend
        if (data.totalProfit !== undefined) {
          profitValue = data.totalProfit.value || data.totalProfit || 0;
          profitFormatted = data.totalProfit.formatted || `Rs. ${Math.abs(profitValue).toLocaleString()}`;
          isPositive = profitValue >= 0;
        } else if (data.netProfit !== undefined) {
          profitValue = data.netProfit.value || data.netProfit || 0;
          profitFormatted = data.netProfit.formatted || `Rs. ${Math.abs(profitValue).toLocaleString()}`;
          isPositive = profitValue >= 0;
        } else if (data.salesRevenue !== undefined && data.expensesAmount !== undefined) {
          // Calculate profit manually: Profit = Sales - Expenses
          const sales = data.salesRevenue.value || data.salesRevenue || 0;
          const expenses = data.expensesAmount.value || data.expensesAmount || 0;
          profitValue = sales - expenses;
          profitFormatted = `Rs. ${Math.abs(profitValue).toLocaleString()}`;
          isPositive = profitValue >= 0;
        }
        
        // Format profit with +/- sign for negative values
        if (profitValue < 0) {
          profitFormatted = `-Rs. ${Math.abs(profitValue).toLocaleString()}`;
        }
        
        // Map backend response to frontend structure
        setDashboardStats({
          rawMaterials: {
            value: data.totalProducts?.value || data.totalProducts || 0,
            formatted: data.totalProducts?.formatted || data.totalProducts?.toString() || "0"
          },
          productSold: {
            value: data.totalSales?.value || data.totalSales || 0,
            formatted: data.totalSales?.formatted || data.totalSales?.toString() || "0"
          },
          totalEmployees: {
            value: data.totalEmployees?.value || data.totalEmployees || 0,
            formatted: data.totalEmployees?.formatted || data.totalEmployees?.toString() || "0"
          },
          totalProfit: {
            value: profitValue,
            formatted: profitFormatted,
            isPositive: isPositive
          },
          totalExpenses: {
            value: data.totalExpenses?.value || data.expensesAmount?.value || 0,
            formatted: data.totalExpenses?.formatted || data.expensesAmount?.formatted || "Rs. 0"
          }
        });
      } else {
        setError('Backend returned success: false');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Failed to load dashboard data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Refresh data function
  const refreshData = async () => {
    await fetchDashboardData();
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex-1 p-6 overflow-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search for anything..."
                className="bg-cms-card border border-border rounded-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
                disabled
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="bg-cms-card rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex-1 p-6 overflow-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <button
            onClick={refreshData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Retry
          </button>
        </div>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">Unable to connect to backend server</p>
          <button
            onClick={refreshData}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={refreshData}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            title="Refresh dashboard data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for anything..."
              className="bg-cms-card border border-border rounded-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
            />
          </div>
        </div>
      </div>

      {/* Stats Row - CONNECTED TO BACKEND */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatsCard 
          icon={Package} 
          iconColor="text-cms-accent" 
          label="Raw Materials" 
          value={dashboardStats.rawMaterials.formatted} 
        />
        <StatsCard 
          icon={ShoppingBag} 
          iconColor="text-cms-success" 
          label="Product Sold" 
          value={dashboardStats.productSold.formatted} 
        />
        <StatsCard 
          icon={Users} 
          iconColor="text-cms-warning" 
          label="Total Employees" 
          value={dashboardStats.totalEmployees.formatted} 
        />
        {/* Total Profit Card */}
        <StatsCard 
          icon={dashboardStats.totalProfit.isPositive ? TrendingUp : TrendingDown}
          iconColor={dashboardStats.totalProfit.isPositive ? "text-cms-success" : "text-cms-orange"}
          label="Total Profit" 
          value={dashboardStats.totalProfit.formatted}
          valueColor={dashboardStats.totalProfit.isPositive ? "text-cms-success" : "text-cms-orange"}
        />
        <StatsCard 
          icon={DollarSign} 
          iconColor="text-cms-orange" 
          label="Total Expenses" 
          value={dashboardStats.totalExpenses.formatted} 
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2">
          <SalesChart />
        </div>
        <div className="col-span-1">
          <RoznamchaWidget />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}