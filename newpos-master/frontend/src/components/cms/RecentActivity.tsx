import { useEffect, useState } from "react";
import { FileText, Truck, Package } from "lucide-react";
import api from "@/lib/api";

const iconMap: Record<string, typeof FileText> = {
  POP: Package,
  POS: FileText,
  Kharcha: Truck,
  Finance: FileText,
};

export function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/activity-logs?limit=8").then((r) => {
      const logs = r.data.data || [];
      setActivities(
        logs.map((l: any) => ({
          icon: iconMap[l.module] || FileText,
          iconBg: "bg-primary/20",
          iconColor: "text-primary",
          title: `${l.userName} — ${l.action}`,
          type: `(${l.module})`,
          typeColor: "text-muted-foreground",
          date: new Date(l.createdAt).toLocaleString(),
          amount: l.reason || "",
        }))
      );
    }).catch(() => {});
  }, []);

  return (
    <div className="bg-cms-card rounded-xl p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent activity logged yet.</p>
        )}
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
              <span className="text-xs text-muted-foreground max-w-[120px] truncate">{activity.amount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
