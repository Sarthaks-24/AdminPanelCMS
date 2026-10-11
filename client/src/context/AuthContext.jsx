import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, SESSION_EXPIRED_EVENT } from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Drop the pre-cookie token left in localStorage by older versions.
    try { localStorage.removeItem('admin_token'); } catch { /* storage unavailable */ }
    let active = true;
    api.get('/auth/verify', { skipAuthRedirect: true })
      .then((res) => { if (active) setUser(res.data.user || res.data.admin); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // A 401 from any dashboard request: drop the identity and let ProtectedRoute redirect.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user || res.data.admin);
    return res.data;
  };

  // Used after the verify-email page signs the user in: the server already set the session cookie
  // and returned the identity, so no second round trip is needed.
  const applySession = useCallback((identity) => { setUser(identity || null); setLoading(false); }, []);

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* the cookie expires on its own */ }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, admin: user, loading, login, logout, setUser, applySession, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
