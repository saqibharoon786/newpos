import axios from 'axios';
import { getCurrentUser } from './auth';

/** Use empty baseURL in dev so Vite proxy forwards /api → localhost:5000 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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

export default api;
