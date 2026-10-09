import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

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

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user || res.data.admin);
    return res.data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* the cookie expires on its own */ }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, admin: user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
