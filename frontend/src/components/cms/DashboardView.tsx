import { Search, Package, ShoppingBag, Users, DollarSign, TrendingUp } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { SalesChart } from "./SalesChart";
import { RoznamchaWidget } from "./RoznamchaWidget";
import { RecentActivity } from "./RecentActivity";

export function DashboardView() {
  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for anything..."
            className="bg-cms-card border border-border rounded-full pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64"
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatsCard icon={Package} iconColor="text-cms-accent" label="Raw Materials" value="10" />
        <StatsCard icon={ShoppingBag} iconColor="text-cms-success" label="Product Sold" value="5" />
        <StatsCard icon={Users} iconColor="text-cms-warning" label="Total Employees" value="20" />
        <StatsCard icon={DollarSign} iconColor="text-primary" label="Total Asset Value" value="Rs. 100,000" />
        <StatsCard icon={TrendingUp} iconColor="text-cms-orange" label="Total Expenses" value="Rs. 100,000" />
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
