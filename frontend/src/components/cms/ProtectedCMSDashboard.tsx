import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CMSDashboard } from "./CMSDashboard";
import { Shield, Loader } from "lucide-react";

const SUPER_ADMIN = {
  email: "superadmin@gmail.com",
  password: "786786"
};

export function ProtectedCMSDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthentication();
    
    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'isLoggedIn' && e.newValue !== 'true') {
        navigate('/');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate]);

  const checkAuthentication = () => {
    try {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const storedEmail = localStorage.getItem('userEmail');
      
      if (isLoggedIn !== 'true' || !storedEmail) {
        setIsAuthenticated(false);
        return;
      }
      
      const decryptedEmail = decodeURIComponent(escape(atob(storedEmail)));
      if (decryptedEmail === SUPER_ADMIN.email) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ background: 'linear-gradient(135deg, #0e4d4d 0%, #093939 40%, #052b2b 100%)' }}>
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#4db8b8' }} />
          <p className="text-white">Verifying your credentials...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ background: 'linear-gradient(135deg, #0e4d4d 0%, #093939 40%, #052b2b 100%)' }}>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full border border-white/20">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Access Denied</h2>
            <p className="text-gray-300">
              You must be logged in as Super Admin to access the dashboard.
            </p>
            <div className="pt-4">
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105"
                style={{ 
                  background: 'linear-gradient(90deg, #1a7575 0%, #2a9090 100%)',
                  color: '#ffffff'
                }}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show the actual dashboard without extra header
  return <CMSDashboard />;
}