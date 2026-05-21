import { useEffect, useState } from "react";
import api from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function SalesChart() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch chart data from backend
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true);
        console.log('Fetching chart data from /api/dashboard/chart-data');
        
        const response = await api.get('/api/dashboard/chart-data');
        console.log('Chart API Response:', response.data);
        
        if (response.data.success) {
          setChartData(response.data.data || []);
        } else {
          setError('Backend returned success: false for chart data');
        }
      } catch (err) {
        console.error('Error fetching chart data:', err);
        console.error('Error details:', err.response?.data || err.message);
        setError(`Failed to load chart data: ${err.message}`);
        
        // Fallback to static data if API fails
        setChartData([
          { month: "Jan", sales: 0, expenses: 0 },
          { month: "Feb", sales: 0, expenses: 0 },
          { month: "Mar", sales: 0, expenses: 0 },
          { month: "Apr", sales: 0, expenses: 0 },
          { month: "May", sales: 0, expenses: 0 },
          { month: "Jun", sales: 0, expenses: 0 },
          { month: "Jul", sales: 0, expenses: 0 },
          { month: "Aug", sales: 0, expenses: 0 },
          { month: "Sep", sales: 0, expenses: 0 },
          { month: "Oct", sales: 0, expenses: 0 },
          { month: "Nov", sales: 0, expenses: 0 },
          { month: "Dec", sales: 0, expenses: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="bg-cms-card rounded-xl p-5 h-[320px]">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-foreground">Sales vs Expenses</h3>
        </div>
        <div className="h-[85%] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cms-orange mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading chart data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && chartData.length === 0) {
    return (
      <div className="bg-cms-card rounded-xl p-5 h-[320px]">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-foreground">Sales vs Expenses</h3>
        </div>
        <div className="h-[85%] flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-sm mb-2">Failed to load chart data</p>
            <p className="text-xs text-muted-foreground">Using fallback data</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate totals for display
  const totalSales = chartData.reduce((sum, item) => sum + (item.sales || 0), 0);
  const totalExpenses = chartData.reduce((sum, item) => sum + (item.expenses || 0), 0);
  const totalProfit = totalSales - totalExpenses;

  return (
    <div className="bg-cms-card rounded-xl p-5 h-[320px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-foreground">Sales vs Expenses</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-cms-orange" />
              <span className="text-muted-foreground">Sales</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-cms-accent" />
              <span className="text-muted-foreground">Expenses</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-cms-success" />
              <span className="text-muted-foreground">Profit</span>
            </div>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="flex items-center gap-6 text-xs">
          <div className="text-right">
            <p className="text-muted-foreground">Total Sales</p>
            <p className="font-semibold text-foreground">Rs. {totalSales.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Total Expenses</p>
            <p className="font-semibold text-foreground">Rs. {totalExpenses.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Net Profit</p>
            <p className={`font-semibold ${totalProfit >= 0 ? 'text-cms-success' : 'text-cms-orange'}`}>
              Rs. {totalProfit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="85%">
        <LineChart 
          data={chartData} 
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 40% 20%)" />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(180 20% 70%)', fontSize: 11 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(180 20% 70%)', fontSize: 11 }}
            tickFormatter={(value) => `Rs. ${(value/1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(180 50% 12%)', 
              border: '1px solid hsl(180 40% 25%)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value, name) => {
              const formattedValue = `Rs. ${Number(value).toLocaleString()}`;
              if (name === 'sales') return [formattedValue, 'Sales'];
              if (name === 'expenses') return [formattedValue, 'Expenses'];
              if (name === 'profit') return [formattedValue, 'Profit'];
              return [formattedValue, name];
            }}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="sales" 
            name="Sales"
            stroke="hsl(25 95% 55%)" 
            strokeWidth={2}
            dot={{ fill: 'hsl(25 95% 55%)', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(25 95% 55%)' }}
          />
          <Line 
            type="monotone" 
            dataKey="expenses" 
            name="Expenses"
            stroke="hsl(170 80% 45%)" 
            strokeWidth={2}
            dot={{ fill: 'hsl(170 80% 45%)', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(170 80% 45%)' }}
          />
          {chartData[0]?.profit !== undefined && (
            <Line 
              type="monotone" 
              dataKey="profit" 
              name="Profit"
              stroke="hsl(150 80% 50%)" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: 'hsl(150 80% 50%)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(150 80% 50%)' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          <p>Data points: {chartData.length} | API: {error ? 'Using fallback' : 'Live data'}</p>
        </div>
      )}
    </div>
  );
}