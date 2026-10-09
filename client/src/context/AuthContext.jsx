import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/verify');
          setUser(res.data.user || res.data.admin);
        } catch {
          localStorage.removeItem('admin_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    verifySession();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken } = res.data;
    const userData = res.data.user || res.data.admin;
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
    setUser(userData);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
  };

  const updateSessionToken = (nextToken) => {
    localStorage.setItem('admin_token', nextToken);
    setToken(nextToken);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        admin: user,
        loading,
        login,
        updateSessionToken,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
