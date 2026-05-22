// CMSDashboard.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { DashboardView } from "./DashboardView";
import { POPView } from "./POPView";
import VendorsView from "./VendorsView";
import { POSView } from "./POSView";
import { RoznamchaView } from "./RoznamchaView";
import { AssetsView } from "./AssetsView";
import CustomersView from "./CustomersView";
import Employee from "./Employee";
import Finance from "./Finance";
import Process from "./process";
import SettingsView from "./SettingsView";
import UsersView from "./UsersView";
import ActivityLogView from "./ActivityLogView";
import ReportsView from "./ReportsView";
import { LogOut, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { verifyAuthentication, logout, getCurrentUser } from "@/lib/auth";

export function CMSDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Get user email
  useEffect(() => {
    const getUserEmail = () => {
      try {
        const storedEmail = localStorage.getItem('userEmail');
        if (storedEmail) {
          const decrypted = decodeURIComponent(escape(atob(storedEmail)));
          setUserEmail(decrypted);
        } else {
          setUserEmail("superadmin@gmail.com");
        }
      } catch (error) {
        setUserEmail("superadmin@gmail.com");
      }
    };
    getUserEmail();
  }, []);

  // Additional protection layer
  useEffect(() => {
    const checkAuth = () => {
      try {
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        const userEmail = localStorage.getItem('userEmail');
        
        if (!verifyAuthentication()) {
          navigate('/');
        }
      } catch (error) {
        navigate('/');
      }
    };
    
    checkAuth();
    const interval = setInterval(checkAuth, 30000);
    return () => clearInterval(interval);
  }, [navigate]);

  // Logout function
  const handleLogout = () => logout();

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView />;
      case "vendors":
        return <VendorsView />;
      case "pop":
        return <POPView />;
      case "pos":
        return <POSView />;
      case "roznamcha":
        return <RoznamchaView />;
      case "assets":
        return <AssetsView />;
      case "customers":
        return <CustomersView />;
      case "employees":
        return <Employee />;
      case "Finance":
        return <Finance />;
      case "process":
        return <Process />;
      case "reports":
        return <ReportsView />;
      case "settings":
        return <SettingsView />;
      case "users":
        return <UsersView />;
      case "activity":
        return <ActivityLogView />;
      // default:
      //   return (
      //     <div className="flex-1 flex items-center justify-center">
      //       <div className="text-center">
      //         <h2 className="text-xl font-semibold text-foreground mb-2">
      //           {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
      //         </h2>
      //         <p className="text-muted-foreground">This section is under development</p>
      //       </div>
      //     </div>
      //   );
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onClose={isMobile ? () => setSidebarOpen(false) : undefined}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header - responsive */}
        <header className="bg-gradient-to-r from-teal-800 to-teal-700 text-white h-14 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-md hover:bg-white/10 touch-manipulation flex-shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0 hidden sm:block" />
              <span className="text-xs sm:text-sm font-medium truncate">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-white/80 hidden sm:block truncate max-w-[100px] md:max-w-none">
              {getCurrentUser().name || userEmail.split('@')[0]}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200 touch-manipulation"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background p-3 sm:p-4 md:p-6 min-h-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}