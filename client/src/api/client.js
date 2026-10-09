import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// The session lives in an httpOnly cookie the server sets; scripts (and XSS) can never read it.
export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // Required by the server for cookie-authenticated writes (CSRF defence).
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Response Interceptor: Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // The startup session probe expects a 401 when signed out and must not trigger a redirect.
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      const path = window.location.pathname;
      const publicPages = ['/admin/login', '/admin/signup', '/admin/check-email', '/admin/verify-email', '/admin/forgot-password', '/admin/reset-password'];
      if (path.startsWith('/admin') && !publicPages.includes(path)) window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);
