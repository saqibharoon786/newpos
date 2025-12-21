import { Plus, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

const data = [
  { name: "12pm-1pm", value: 120 },
  { name: "1pm-2pm", value: 80 },
  { name: "2pm-3pm", value: 140 },
  { name: "3pm-4pm", value: 100 },
  { name: "4pm-5pm", value: 160 },
];

export function RoznamchaWidget() {
  return (
    <div className="bg-cms-card rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">Roznamcha</h3>
        <div className="flex items-center gap-1 text-xs">
          <button className="px-3 py-1 bg-primary text-primary-foreground rounded-md font-medium">Daily</button>
          <button className="px-3 py-1 text-muted-foreground hover:text-foreground transition-colors">Weekly</button>
          <button className="px-3 py-1 text-muted-foreground hover:text-foreground transition-colors">Monthly</button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-muted-foreground">@ Total Expense</p>
          <p className="text-lg font-bold text-foreground">Rs 20,000 <span className="text-xs text-muted-foreground font-normal">55 Entries 1 Hour</span></p>
        </div>
        <button className="w-8 h-8 bg-cms-success rounded-md flex items-center justify-center text-foreground">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="h-28 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'hsl(180 20% 70%)', fontSize: 8 }}
            />
            <YAxis hide />
            <Bar dataKey="value" fill="hsl(170 80% 45%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for anything..."
          className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-muted-foreground">Filter By</span>
        <select className="bg-transparent text-muted-foreground border-none focus:outline-none">
          <option>All</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-2 font-medium">Subject</th>
              <th className="text-left py-2 font-medium">Purpose</th>
              <th className="text-left py-2 font-medium">Usage</th>
              <th className="text-left py-2 font-medium">Cost</th>
              <th className="text-left py-2 font-medium">Time</th>
              <th className="text-left py-2 font-medium">Action</th>
            </tr>
          </thead>
        </table>
      </div>
    </div>
  );
}
