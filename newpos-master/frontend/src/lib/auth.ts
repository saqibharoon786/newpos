const SUPER_ADMIN = {
  email: "superadmin@gmail.com",
  password: "786786"
};

export const verifyAuthentication = (): boolean => {
  try {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userEmail = localStorage.getItem('userEmail');
    
    if (isLoggedIn !== 'true' || !userEmail) {
      return false;
    }
    
    // Decrypt email
    const decryptedEmail = decodeURIComponent(escape(atob(userEmail)));
    return decryptedEmail === SUPER_ADMIN.email;
  } catch (error) {
    return false;
  }
};

export const logout = (): void => {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('authToken');
  localStorage.removeItem('rememberMe');
  sessionStorage.clear();
  
  // Redirect to login
  window.location.href = '/';
};