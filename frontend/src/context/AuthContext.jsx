import { useEffect, useMemo, useState } from 'react';
import authService from '../services/authService.js';
import userService from '../services/userService.js';
import AuthContext from './authContext.js';

const TOKEN_KEY = 'aura-health-token';
const USER_KEY = 'aura-health-user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  const persistSession = (sessionToken, sessionUser) => {
    localStorage.setItem(TOKEN_KEY, sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
    setToken(sessionToken);
    setUser(sessionUser);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    persistSession(data.token, data.user);
    return data.user;
  };

  useEffect(() => {
    const hydrateSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await userService.getProfile();
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    hydrateSession();
  }, [token]);

  const value = useMemo(() => ({
    login,
    logout,
    user,
    token,
    isAuthenticated: Boolean(token),
    loading,
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
