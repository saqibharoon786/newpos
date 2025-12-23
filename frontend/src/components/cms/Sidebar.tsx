import { LayoutDashboard, ShoppingCart, Store, BookOpen, Package, Users, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pop", label: "POP", icon: ShoppingCart },
  { id: "pos", label: "POS", icon: Store },
  { id: "roznamcha", label: "Roznamcha", icon: BookOpen },
  { id: "assets", label: "Assets", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "employees", label: "Employees", icon: UserCog },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-52 bg-cms-sidebar min-h-screen flex flex-col sticky top-0">
      <div className="p-4 flex flex-col h-screen">
        {/* Logo - Fixed at top */}
        <div className="flex items-center gap-3 mb-10 px-2 pt-2 flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-cms-success rounded-full flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground tracking-wide">CMS</span>
        </div>

        {/* Navigation Only - Scrollable if needed */}
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Empty div for spacing - No footer content */}
        <div className="pt-4 flex-shrink-0">
          {/* No content here - Just for spacing */}
        </div>
      </div>
    </aside>
  );
}