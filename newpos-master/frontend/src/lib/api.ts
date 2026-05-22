import axios from 'axios';
import { getCurrentUser } from './auth';

/** Use empty baseURL in dev so Vite proxy forwards /api → localhost:5000 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const user = getCurrentUser();
  if (user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  if (user.email) config.headers['X-CMS-Email'] = user.email;
  if (user.role) config.headers['X-CMS-Role'] = user.role;
  if (user.id) config.headers['X-CMS-User-Id'] = user.id;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const hadSession = localStorage.getItem('isLoggedIn') === 'true';
      if (hadSession && !error.config?._authRetry) {
        error.config._authRetry = true;
        const msg = error.response?.data?.message || 'Session expired — please login again';
        error.message = msg;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
