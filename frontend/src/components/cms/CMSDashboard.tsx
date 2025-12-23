import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { DashboardView } from "./DashboardView";
import { POPView } from "./POPView";
import { POSView } from "./POSView";
import { RoznamchaView } from "./RoznamchaView";
import { AssetsView } from "./AssetsView";
import CustomersView from "./CustomersView";
import { LogOut } from "lucide-react";

const SUPER_ADMIN = {
  email: "superadmin@gmail.com",
  password: "786786"
};

export function CMSDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userEmail, setUserEmail] = useState("");
  const navigate = useNavigate();

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
        
        if (isLoggedIn !== 'true' || !userEmail) {
          navigate('/');
          return;
        }
        
        const decryptedEmail = decodeURIComponent(escape(atob(userEmail)));
        if (decryptedEmail !== SUPER_ADMIN.email) {
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
  const logout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('authToken');
    localStorage.removeItem('rememberMe');
    sessionStorage.clear();
    navigate('/');
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView />;
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
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h2>
              <p className="text-muted-foreground">This section is under development</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col">
        {/* Top Header Bar with Color Scheme */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-700 text-white h-14 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Session Active</span>
            </div>
            <div className="text-lg font-semibold ml-4">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </div>
          </div>
          
          {/* User Info and Logout */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-white/80 hidden md:block">
              {userEmail.split('@')[0]}
            </div>
            
            {/* Logout Button */}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Main Content - No Footer */}
        <main className="flex-1 overflow-auto bg-background p-6">
          {renderContent()}
        </main>

        {/* Footer Removed */}
      </div>
    </div>
  );
}