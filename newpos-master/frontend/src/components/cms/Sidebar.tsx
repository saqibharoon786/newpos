import { useEffect, useState } from "react";
import { LayoutDashboard, ShoppingCart, Store, BookOpen, Package, Users, UserCog, X, Settings, FileBarChart, ScrollText, Shield, Truck, BookMarked } from "lucide-react";
import { getCurrentUser, canApprove } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fetchCompanySettings, getLogoUrl } from "@/lib/companySettings";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** On mobile: sidebar open state */
  isOpen?: boolean;
  /** On mobile: close sidebar (e.g. after navigation) */
  onClose?: () => void;
}

const baseMenuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "vendors", label: "Vendors", icon: Truck },
  { id: "pop", label: "POP", icon: ShoppingCart },
  { id: "process", label: "Process", icon: ShoppingCart },
  { id: "customers", label: "Customers", icon: Users },
  { id: "pos", label: "POS", icon: Store },
  { id: "roznamcha", label: "Kharcha", icon: BookOpen },
  { id: "assets", label: "Assets", icon: Package },
  { id: "employees", label: "Employee", icon: UserCog },
  { id: "Finance", label: "Finance", icon: UserCog },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "ledger", label: "Ledgers", icon: BookMarked },
];

const ownerMenuItems = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "users", label: "Users", icon: Shield },
  { id: "activity", label: "Activity Log", icon: ScrollText },
];

export function Sidebar({ activeTab, onTabChange, isOpen = true, onClose }: SidebarProps) {
  const [companyName, setCompanyName] = useState("Mara Ha International Plastic");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanySettings().then((s) => {
      setCompanyName(s.companyName);
      setLogoUrl(getLogoUrl(s.logo));
    });
  }, []);

  const role = getCurrentUser().role;
  const menuItems = canApprove(role) ? [...baseMenuItems, ...ownerMenuItems] : baseMenuItems;
  const isMobileDrawer = typeof onClose === "function";
  const handleTab = (tab: string) => {
    onTabChange(tab);
    onClose?.();
  };

  const content = (showCloseButton: boolean) => (
    <div className="p-4 flex flex-col h-full min-h-screen">
      <div className={cn("flex items-center justify-between px-2 pt-2 flex-shrink-0", showCloseButton ? "mb-6" : "mb-10")}>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-cms-success rounded-full flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <span className="text-sm font-bold text-foreground tracking-wide leading-tight">{companyName}</span>
        </div>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 touch-manipulation"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => (isMobileDrawer ? handleTab(item.id) : onTabChange(item.id))}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-all duration-200 min-h-[44px] touch-manipulation",
                    isActive
                      ? "bg-sidebar-accent text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="pt-4 flex-shrink-0" />
    </div>
  );

  return (
    <>
      {isMobileDrawer && (
        <>
          <div
            className={cn(
              "fixed inset-0 bg-black/60 z-40 transition-opacity md:hidden",
              isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className={cn(
              "fixed top-0 left-0 z-50 w-[min(280px,85vw)] max-w-[280px] bg-cms-sidebar min-h-screen flex flex-col shadow-xl transition-transform duration-200 ease-out md:hidden",
              isOpen ? "translate-x-0" : "-translate-x-full"
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
          >
            {content(true)}
          </aside>
        </>
      )}
      <aside className="w-52 bg-cms-sidebar min-h-screen flex flex-col sticky top-0 flex-shrink-0 hidden md:flex">
        {content(false)}
      </aside>
    </>
  );
}