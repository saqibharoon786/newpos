import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Users, TrendingUp, UserCheck } from "lucide-react";

const SUPER_ADMIN = {
  email: "superadmin@gmail.com",
  password: "786786"
};

const Index = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userEmail = localStorage.getItem('userEmail');
    
    if (isLoggedIn === 'true') {
      try {
        let emailToCheck = userEmail;
        
        // If email is encrypted, decrypt it
        if (userEmail && userEmail !== SUPER_ADMIN.email) {
          try {
            emailToCheck = decodeURIComponent(escape(atob(userEmail)));
          } catch {
            // If decryption fails, stay on login
            return;
          }
        }
        
        if (emailToCheck === SUPER_ADMIN.email) {
          navigate('/CMSDashboard');
        }
      } catch (error) {
        console.log("Session verification failed");
      }
    }
  }, [navigate]);

  const encryptData = (data: string): string => {
    return btoa(unescape(encodeURIComponent(data)));
  };

  const generateSessionToken = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return encryptData(`${timestamp}-${random}-${SUPER_ADMIN.email}`);
  };

  const secureCompare = async (a: string, b: string): Promise<boolean> => {
    // Constant-time comparison to prevent timing attacks
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    // Add random delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    return result === 0;
  };

  // Secure input handlers
  const handleEmailChange = (value: string) => {
    const cleanValue = value.trim().toLowerCase();
    setEmail(cleanValue);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    
    // Auto-clear password after 30 seconds of inactivity
    setTimeout(() => {
      if (document.activeElement?.id !== 'password-field') {
        setPassword("");
      }
    }, 30000);
  };

  // Prevent copy/paste and autocomplete for password
  const handlePasswordPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setError("Pasting is disabled for security");
  };

  const handlePasswordCopy = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setError("Copying password is disabled");
  };

  const handlePasswordCut = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setError("Cutting password is disabled");
  };

  // Disable browser autocomplete and password managers
  const disableAutoComplete = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.autocomplete = "new-password";
    e.target.readOnly = true;
    
    setTimeout(() => {
      e.target.readOnly = false;
    }, 100);
  };

  // Clear error when user starts typing
  const clearError = () => {
    if (error) setError("");
  };

  // Main submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Add delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
      
      // Secure comparison with timing attack prevention
      const isEmailValid = await secureCompare(email, SUPER_ADMIN.email);
      const isPasswordValid = await secureCompare(password, SUPER_ADMIN.password);
      
      if (isEmailValid && isPasswordValid) {
        // Don't store credentials, only store authentication status
        const obfuscatedEmail = encryptData(SUPER_ADMIN.email);
        
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('authToken', generateSessionToken());
        localStorage.setItem('userEmail', obfuscatedEmail);
        
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
        
        // Clear form data
        setEmail("");
        setPassword("");
        
        // Navigate to CMSDashboard
        navigate('/CMSDashboard');
      } else {
        // Always show same error message regardless of what failed
        await new Promise(resolve => setTimeout(resolve, 500));
        setError("Invalid credentials. Please try again.");
      }
    } catch (err) {
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
      
      // Clear sensitive data from state
      setTimeout(() => {
        setPassword("");
      }, 0);
    }
  };

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0e4d4d 0%, #093939 40%, #052b2b 100%)' }}
    >
      
      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #1a6a6a 0%, transparent 70%)' }} />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #0f5555 0%, transparent 70%)' }} />
      </div>

      {/* Wave Background at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-80 opacity-60">
        <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full" preserveAspectRatio="none" style={{ height: '100%' }}>
          <path 
            fill="#0c4545" 
            fillOpacity="0.6" 
            d="M0,160L48,170.7C96,181,192,203,288,192C384,181,480,139,576,128C672,117,768,139,864,165.3C960,192,1056,224,1152,218.7C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
        <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full" preserveAspectRatio="none" style={{ height: '80%' }}>
          <path 
            fill="#083838" 
            fillOpacity="0.5" 
            d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-24">
          
          {/* Left Side - Branding & Stats */}
          <div className="flex flex-col space-y-10 lg:space-y-14 flex-1 animate-[fadeInLeft_0.8s_ease-out]">
            {/* Logo */}
            <div className="flex items-center gap-3 group">
              <div 
                className="w-11 h-11 rounded-full flex items-center justify-center relative transition-transform duration-500 group-hover:scale-110"
                style={{ background: 'linear-gradient(135deg, #1a7a7a 0%, #0d5050 100%)', border: '2px solid #b8a030' }}
              >
                {/* Inner globe pattern */}
                <div className="w-5 h-5 rounded-full flex items-center justify-center relative" style={{ border: '1.5px solid #b8a030' }}>
                  <div className="absolute w-full h-[1px] top-1/2" style={{ background: '#b8a030' }} />
                  <div className="absolute h-full w-[1px] left-1/2" style={{ background: '#b8a030' }} />
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#b8a030' }} />
                </div>
              </div>
              <span style={{ color: '#5cc4c4' }} className="text-xl font-semibold transition-colors duration-300 group-hover:brightness-110">IPP Plus</span>
            </div>

            {/* Headline */}
            <div className="animate-[fadeIn_1s_ease-out_0.3s_both]">
              <h1 className="text-3xl lg:text-[2.5rem] font-bold leading-tight" style={{ color: '#ffffff' }}>
                Innovating Plastic<br />
                Solutions with Data-<br />
                Driven Productions
              </h1>
            </div>

            {/* Stats Cards Container */}
            <div className="relative h-52 w-full max-w-xs animate-[fadeIn_1s_ease-out_0.5s_both]">
              {/* Main Expense Card */}
              <div 
                className="absolute top-0 left-6 rounded-2xl p-5 w-56 shadow-xl transition-all duration-500 hover:scale-105"
                style={{ background: 'rgba(8, 40, 40, 0.85)', border: '1px solid rgba(60, 130, 130, 0.2)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3 h-3" style={{ color: '#4db8b8' }} />
                  <span className="text-[11px]" style={{ color: '#6a9e9e' }}>Total Expense</span>
                </div>
                <p className="text-xl font-bold" style={{ color: '#ffffff' }}>Rs. 300,000</p>
                
                {/* Mini Chart */}
                <div className="mt-3 flex items-end gap-[2px] h-10">
                  {[35, 55, 42, 68, 48, 72, 52, 62, 78, 58, 82, 68].map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm transition-all duration-500"
                      style={{ 
                        height: `${height}%`,
                        background: 'rgba(77, 184, 184, 0.5)',
                        animation: `chartGrow 1s ease-out ${i * 0.08}s both`
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* New Clients Card */}
              <div 
                className="absolute left-0 bottom-6 rounded-xl px-3 py-2.5 shadow-lg z-10 animate-[float_3s_ease-in-out_infinite] transition-all duration-300 hover:scale-110"
                style={{ background: 'rgba(6, 32, 32, 0.9)', border: '1px solid rgba(60, 130, 130, 0.15)' }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Users className="w-3 h-3" style={{ color: '#4db8b8' }} />
                  <span className="text-[9px]" style={{ color: '#6a9e9e' }}>New Clients</span>
                </div>
                <p className="text-lg font-bold" style={{ color: '#ffffff' }}>10</p>
              </div>

              {/* Active Employees Card */}
              <div 
                className="absolute right-4 bottom-0 rounded-xl px-3 py-2.5 shadow-lg animate-[float_3s_ease-in-out_0.5s_infinite] transition-all duration-300 hover:scale-110"
                style={{ background: 'rgba(6, 32, 32, 0.9)', border: '1px solid rgba(60, 130, 130, 0.15)' }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <UserCheck className="w-3 h-3" style={{ color: '#4db8b8' }} />
                  <span className="text-[9px]" style={{ color: '#6a9e9e' }}>Active Employees</span>
                </div>
                <p className="text-lg font-bold" style={{ color: '#ffffff' }}>20</p>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full max-w-md flex-shrink-0 animate-[fadeInRight_0.8s_ease-out]">
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-2xl font-bold mb-2 animate-[fadeIn_0.8s_ease-out_0.2s_both]" style={{ color: '#ffffff' }}>Login Super Admin</h2>
              <p className="text-sm animate-[fadeIn_0.8s_ease-out_0.4s_both]" style={{ color: '#7aadad' }}>
                Please enter your detail to access the dashboard
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm animate-[fadeIn_0.3s_ease-out]"
                   style={{ background: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', border: '1px solid rgba(255, 0, 0, 0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              {/* Email Field */}
              <div className="space-y-2 animate-[fadeIn_0.8s_ease-out_0.5s_both]">
                <label className="text-sm font-medium" style={{ color: '#ffffff' }}>Email Address</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-transform duration-300 group-focus-within:scale-110" style={{ color: '#4db8b8' }}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    name="hidden-email"
                    autoComplete="new-email"
                    placeholder="Example@gmail.com"
                    value={email}
                    onChange={(e) => {
                      handleEmailChange(e.target.value);
                      clearError();
                    }}
                    onFocus={disableAutoComplete}
                    className="w-full h-14 pl-12 pr-4 rounded-xl text-base transition-all duration-300 focus:outline-none"
                    style={{ 
                      background: 'rgba(10, 50, 50, 0.7)',
                      border: error ? '1px solid rgba(255, 100, 100, 0.5)' : '1px solid rgba(77, 184, 184, 0.25)',
                      color: '#ffffff'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = error ? 'rgba(255, 100, 100, 0.7)' : 'rgba(77, 184, 184, 0.5)';
                      e.target.style.boxShadow = error ? '0 0 0 3px rgba(255, 100, 100, 0.1)' : '0 0 0 3px rgba(77, 184, 184, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = error ? 'rgba(255, 100, 100, 0.5)' : 'rgba(77, 184, 184, 0.25)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2 animate-[fadeIn_0.8s_ease-out_0.6s_both]">
                <label className="text-sm font-medium" style={{ color: '#ffffff' }}>Password</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-transform duration-300 group-focus-within:scale-110" style={{ color: '#4db8b8' }}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="password-field"
                    type="password"
                    name="hidden-password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      handlePasswordChange(e.target.value);
                      clearError();
                    }}
                    onPaste={handlePasswordPaste}
                    onCopy={handlePasswordCopy}
                    onCut={handlePasswordCut}
                    onFocus={disableAutoComplete}
                    className="w-full h-14 pl-12 pr-4 rounded-xl text-base transition-all duration-300 focus:outline-none"
                    style={{ 
                      background: 'rgba(10, 50, 50, 0.7)',
                      border: error ? '1px solid rgba(255, 100, 100, 0.5)' : '1px solid rgba(77, 184, 184, 0.25)',
                      color: '#ffffff',
                      WebkitTextSecurity: 'disc'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = error ? 'rgba(255, 100, 100, 0.7)' : 'rgba(77, 184, 184, 0.5)';
                      e.target.style.boxShadow = error ? '0 0 0 3px rgba(255, 100, 100, 0.1)' : '0 0 0 3px rgba(77, 184, 184, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = error ? 'rgba(255, 100, 100, 0.5)' : 'rgba(77, 184, 184, 0.25)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between animate-[fadeIn_0.8s_ease-out_0.7s_both]">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: '#4db8b8' }}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm cursor-pointer transition-colors hover:brightness-110"
                    style={{ color: '#7aadad' }}
                  >
                    Remember me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setError("Please contact administrator for password reset")}
                  className="text-sm transition-all duration-300 hover:brightness-125 focus:outline-none"
                  style={{ color: '#4db8b8' }}
                >
                  Forgot Password?
                </button>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 mt-4 rounded-full font-semibold transition-all duration-500 hover:shadow-[0_0_30px_rgba(77,184,184,0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed animate-[fadeIn_0.8s_ease-out_0.8s_both]"
                style={{ 
                  background: loading 
                    ? 'rgba(77, 184, 184, 0.5)' 
                    : 'linear-gradient(90deg, #1a7575 0%, #2a9090 100%)',
                  color: '#ffffff'
                }}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Authenticating...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Add fake form to confuse password managers */}
      <div style={{ display: 'none' }}>
        <form>
          <input type="email" name="email" autoComplete="username" />
          <input type="password" name="password" autoComplete="current-password" />
        </form>
      </div>

      {/* Custom Keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-25px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(25px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes chartGrow {
          from { height: 0%; }
        }
        input::placeholder {
          color: #5a8888;
        }
        input[type="password"] {
          font-family: monospace;
          letter-spacing: 2px;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px rgba(10, 50, 50, 0.7) inset !important;
          -webkit-text-fill-color: #ffffff !important;
        }
      `}</style>
    </div>
  );
};

export default Index;