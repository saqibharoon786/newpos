import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const SUPER_ADMIN = {
  email: 'superadmin@gmail.com',
  password: '786786',
  role: 'owner',
  name: 'Owner',
};

export type UserRole = 'owner' | 'admin' | 'accountant1' | 'accountant2' | 'reception';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  name: string;
  token?: string;
}

export const canApprove = (role?: string) => role === 'owner' || role === 'admin';
export const canDelete = (role?: string) => role === 'owner' || role === 'admin';
export const canEditAny = (role?: string) => role === 'owner' || role === 'admin';
export const isAccountant = (role?: string) => role === 'accountant1' || role === 'accountant2';

export async function loginUser(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === SUPER_ADMIN.email && password === SUPER_ADMIN.password) {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/owner-session`, {
        email: normalizedEmail,
        password,
      });
      if (res.data?.success) {
        const payload = res.data.data || res.data;
        const u = payload.user || payload;
        const token = payload.tokens?.accessToken || payload.token;
        const user: AuthUser = {
          id: u._id || u.id || 'super-admin',
          email: u.email || SUPER_ADMIN.email,
          username: u.username || 'owner',
          role: (u.role as UserRole) || 'owner',
          name: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Owner',
          token,
        };
        persistSession(user);
        return user;
      }
    } catch {
      /* fallback below if API unreachable */
    }
    const user: AuthUser = {
      id: 'super-admin',
      email: SUPER_ADMIN.email,
      username: 'owner',
      role: 'owner',
      name: 'Owner',
    };
    persistSession(user);
    return user;
  }

  try {
    const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
    if (res.data?.success) {
      const payload = res.data.data || res.data;
      const u = payload.user || payload;
      const token = payload.tokens?.accessToken || payload.token;
      const user: AuthUser = {
        id: u._id || u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        name: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        token,
      };
      persistSession(user);
      return user;
    }
  } catch {
    return null;
  }
  return null;
}

function persistSession(user: AuthUser) {
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userEmail', btoa(unescape(encodeURIComponent(user.email))));
  localStorage.setItem('userRole', user.role);
  localStorage.setItem('userName', user.name);
  if (user.id) localStorage.setItem('userId', user.id);
  if (user.token) localStorage.setItem('authToken', user.token);
}

export const verifyAuthentication = (): boolean => {
  try {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userEmail = localStorage.getItem('userEmail');
    return isLoggedIn === 'true' && !!userEmail;
  } catch {
    return false;
  }
};

function decodeStoredEmail(stored: string): string {
  try {
    const decoded = decodeURIComponent(escape(atob(stored)));
    if (decoded.includes('@')) return decoded;
  } catch {
    /* legacy: plain email stored without base64 */
  }
  return stored.includes('@') ? stored : '';
}

export const getCurrentUser = (): Partial<AuthUser> => {
  const rawEmail = localStorage.getItem('userEmail') || '';
  const email = rawEmail ? decodeStoredEmail(rawEmail) : '';
  return {
    id: localStorage.getItem('userId') || (email === SUPER_ADMIN.email ? 'super-admin' : undefined),
    email,
    role: (localStorage.getItem('userRole') as UserRole) || 'owner',
    name: localStorage.getItem('userName') || 'User',
    token: localStorage.getItem('authToken') || undefined,
    username: localStorage.getItem('userName') || 'user',
  };
};

export const logout = (): void => {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('authToken');
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('userId');
  sessionStorage.clear();
  window.location.href = '/';
};
