import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  value: string | number;
  className?: string;
}

export function StatsCard({ icon: Icon, iconColor = "text-primary", label, value, className }: StatsCardProps) {
  return (
    <div className={cn(
      "bg-cms-card rounded-xl p-4 flex items-center gap-3 min-w-[140px]",
      className
    )}>
      <div className={cn("w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center", iconColor)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
