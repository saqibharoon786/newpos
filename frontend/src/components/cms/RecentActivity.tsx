import { FileText, Truck, Package } from "lucide-react";

const activities = [
  {
    icon: FileText,
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    title: "Client Project Payment",
    type: "(SALE)",
    typeColor: "text-cms-success",
    date: "01 Nov 2023 09:15 AM",
    amount: "Rs. 30,000",
  },
  {
    icon: Truck,
    iconBg: "bg-yellow-500/20",
    iconColor: "text-yellow-400",
    title: "Fuel for Delivery Van",
    type: "(EXPENSE)",
    typeColor: "text-cms-orange",
    date: "01 Nov 2023 08:15 AM",
    amount: "Rs. 5,000",
  },
  {
    icon: Package,
    iconBg: "bg-green-500/20",
    iconColor: "text-green-400",
    title: "Office Supplies",
    type: "(PURCHASE)",
    typeColor: "text-primary",
    date: "01 Nov 2023 08:15 AM",
    amount: "Rs. 3,000",
  },
];

export function RecentActivity() {
  return (
    <div className="bg-cms-card rounded-xl p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Recent Company Activity</h3>
      <div className="space-y-3">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          return (
            <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${activity.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${activity.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {activity.title} <span className={activity.typeColor}>{activity.type}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{activity.date}</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-foreground">{activity.amount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
