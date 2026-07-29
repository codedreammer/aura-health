import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import authService from '../services/authService.js';
import userService from '../services/userService.js';

const AuthContext = createContext(null);

const STORAGE_KEYS = Object.freeze({
  TOKEN: 'aura-health-token',
  USER: 'aura-health-user',
});

/**
 * Safely read a JSON value from localStorage. On malformed JSON, the key is
 * deleted so next boot falls back to the default state instead of looping
 * into the same corrupt read.
 */
const readParsedStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return null;
    const value = JSON.parse(raw);
    return value;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage disabled — nothing we can do */
    }
    return null;
  }
};

const readStorageString = (key) => {
  try {
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
};

const clearAuthStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  } catch {
    /* Storage disabled — swallow, state is still cleared below */
  }
};

const persistAuthSession = (token, user) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch {
    /* Storage disabled — in-memory auth state remains available. */
  }
};

const broadcastUnauthenticated = () => {
  try {
    window.dispatchEvent(new CustomEvent('aura:unauthenticated'));
  } catch {
    /* Event dispatch not available in SSR / test environments */
  }
};

const skipFreshLoginWindowMs = 3000;

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStorageString(STORAGE_KEYS.TOKEN));
  const [user, setUser] = useState(() => readParsedStorage(STORAGE_KEYS.USER));
  const [loading, setLoading] = useState(true);
  const [formMessage, setFormMessage] = useState(null);

  /**
   * Prevents the hydration `getProfile` call from firing immediately after a
   * successful login/signup (where we already received a fresh user payload).
   * Timestamped so a slow-mounting profile tab still fetches if the user
   * left the app open for days.
   */
  const lastLoginAtMs = useRef(0);

  // ---------------------------------------------------------------
  // Persist token + user to localStorage whenever they change.
  // ---------------------------------------------------------------
  useEffect(() => {
    try {
      if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      else localStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch {
      /* Quota / disabled storage is non-fatal — state remains the source of truth */
    }
  }, [token]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {
      /* Same as above */
    }
  }, [user]);

  // ---------------------------------------------------------------
  // Hydration fetch: confirm the stored JWT is still valid by asking
  // the backend for the current user profile. SKIPS if a login just
  // happened (we trust the login payload for a short window).
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!token || !user) {
      if (token || user) {
        clearAuthStorage();
        setToken(null);
        setUser(null);
      }
      setLoading(false);
      return undefined;
    }

    const now = Date.now();
    if (now - lastLoginAtMs.current < skipFreshLoginWindowMs) {
      // Data just came back from login/signup; no redundant fetch needed.
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await userService.getProfile();
        if (cancelled) return;
        setUser(response.user);
      } catch (error) {
        if (cancelled) return;
        // Profile fetch failed with a 401/network error → clear session.
        // The api interceptor may also broadcast aura:unauthenticated,
        // which triggers doLogout a second time (idempotent, safe).
        clearAuthStorage();
        setToken(null);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // We intentionally depend only on token so a shallow user write (e.g.
    // updateUser) does not re-trigger profile hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * Core logout. The `skipBroadcast` flag avoids a loop when this function
   * is itself called FROM the broadcast handler.
   */
  const doLogout = useCallback((options = {}) => {
    const { skipBroadcast = false } = options;
    clearAuthStorage();
    setToken(null);
    setUser(null);
    setFormMessage(null);
    lastLoginAtMs.current = 0;
    if (!skipBroadcast) {
      broadcastUnauthenticated();
    }
  }, []);

  // ---------------------------------------------------------------
  // Cross-module logout event. api.js's response interceptor fires
  // this broadcast on any 401 response so we don't have to import
  // AuthContext into api.js (which would create circular deps).
  // ---------------------------------------------------------------
  useEffect(() => {
    const handler = () => doLogout({ skipBroadcast: true });
    window.addEventListener('aura:unauthenticated', handler);
    return () => window.removeEventListener('aura:unauthenticated', handler);
  }, [doLogout]);

  const login = useCallback(async ({ email, password }) => {
    setFormMessage(null);
    try {
      if (typeof email !== 'string' || !email.trim()) {
        throw new Error('Email is required');
      }
      if (typeof password !== 'string' || !password) {
        throw new Error('Password is required');
      }
      const response = await authService.login({ email: email.trim(), password });
      persistAuthSession(response.token, response.user);
      lastLoginAtMs.current = Date.now();
      setToken(response.token);
      setUser(response.user);
    } catch (error) {
      const message = typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'Login failed. Please try again.';
      setFormMessage(message);
      throw error;
    }
  }, []);

  const signup = useCallback(async ({ fullName, email, password }) => {
    setFormMessage(null);
    try {
      if (typeof fullName !== 'string' || !fullName.trim()) {
        throw new Error('Name is required');
      }
      if (typeof email !== 'string' || !email.trim()) {
        throw new Error('Email is required');
      }
      if (typeof password !== 'string' || !password) {
        throw new Error('Password is required');
      }
      const response = await authService.signup({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      persistAuthSession(response.token, response.user);
      lastLoginAtMs.current = Date.now();
      setToken(response.token);
      setUser(response.user);
    } catch (error) {
      const message = typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'Signup failed. Please try again.';
      setFormMessage(message);
      throw error;
    }
  }, []);

  const updateUser = useCallback((partial) => {
    if (!partial || typeof partial !== 'object') return;
    setUser((previous) => {
      const next = { ...(previous || {}), ...partial };
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user && !loading),
    formMessage,
    login,
    signup,
    logout: () => doLogout(),
    updateUser,
    setFormMessage,
  }), [user, token, loading, formMessage, login, signup, doLogout, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthProvider };
export default AuthContext;
