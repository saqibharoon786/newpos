import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data = [
  { month: "Jan", sales: 4000, expenses: 2400 },
  { month: "Feb", sales: 3000, expenses: 1398 },
  { month: "Mar", sales: 9800, expenses: 2000 },
  { month: "Apr", sales: 3908, expenses: 2780 },
  { month: "May", sales: 4800, expenses: 1890 },
  { month: "Jun", sales: 3800, expenses: 2390 },
  { month: "Jul", sales: 14000, expenses: 3490 },
  { month: "Aug", sales: 12000, expenses: 4300 },
  { month: "Sep", sales: 9000, expenses: 2100 },
  { month: "Oct", sales: 8500, expenses: 2500 },
  { month: "Nov", sales: 11000, expenses: 3200 },
  { month: "Dec", sales: 18000, expenses: 4100 },
];

export function SalesChart() {
  return (
    <div className="bg-cms-card rounded-xl p-5 h-[320px]">
      <div className="flex items-center gap-4 mb-4">
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
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(180 50% 12%)', 
              border: '1px solid hsl(180 40% 25%)',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="sales" 
            stroke="hsl(25 95% 55%)" 
            strokeWidth={2}
            dot={{ fill: 'hsl(25 95% 55%)', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="expenses" 
            stroke="hsl(170 80% 45%)" 
            strokeWidth={2}
            dot={{ fill: 'hsl(170 80% 45%)', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
