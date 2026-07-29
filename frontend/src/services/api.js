import axios from 'axios';

const TOKEN_KEY = 'aura-health-token';
const USER_KEY = 'aura-health-user';
const DEFAULT_TIMEOUT_MS = 30_000;

const clientStatus = {
  /**
   * A soft "logged-out" flag. When `true`, the response interceptor avoids
   * broadcasting a logout event more than once per 401 burst (prevents race
   * conditions where 5 parallel requests each try to clear localStorage).
   */
  logoutInProgress: false,
};

/**
 * Force the app back into an unauthenticated state.
 *
 * Called automatically by the response interceptor on 401 responses.
 * Also called directly by the AuthContext when the user logs out manually.
 *
 * The storage clear is guarded so multiple parallel 401s do not step on
 * each other. The reload fallback is intentionally omitted — we let the
 * auth context reactive state (null token) handle the UI transition.
 */
const broadcastUnauthenticated = () => {
  if (clientStatus.logoutInProgress) return;
  clientStatus.logoutInProgress = true;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* localStorage can throw when quota is 0 or storage is disabled. */
  } finally {
    // Allow the guard to re-arm after the current tick.
    queueMicrotask(() => {
      clientStatus.logoutInProgress = false;
    });
  }

  // A custom event lets AuthContext (or any subscriber) react *without*
  // importing this module, which would create a circular dependency.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura:unauthenticated'));
  }
};

/**
 * Build the normalized error object every service receives in the catch
 * branch. We intentionally hide network-layer details from UI copy and
 * instead surface structured `code` constants for i18n-safe rendering.
 */
export const createClientError = (options) => {
  const error = new Error(options.message || 'Something went wrong');
  error.code = options.code || 'UNKNOWN';
  error.status = options.status || 0;
  error.isNetwork = Boolean(options.isNetwork);
  error.isOffline = Boolean(options.isOffline);
  error.isTimeout = Boolean(options.isTimeout);
  error.original = options.original || null;
  return error;
};

/**
 * Categorize an Axios-originated error into one of the well-known codes
 * that UI code switches on. Callers should never string-match .message.
 */
const classifyAxiosError = (axiosError) => {
  if (!axiosError || !axiosError.isAxiosError) {
    return {
      code: 'UNKNOWN',
      status: 0,
      isNetwork: false,
      isOffline: false,
      isTimeout: false,
      message: axiosError?.message || 'Unknown error',
    };
  }

  const response = axiosError.response;
  const status = response?.status || 0;
  const serverMessage =
    typeof response?.data?.message === 'string' ? response.data.message : null;

  // Network-level failures (DNS, CORS, no internet, TLS handshake abort)
  if (axiosError.code === 'ERR_NETWORK' || !axiosError.request) {
    const isOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      code: isOffline ? 'OFFLINE' : 'NETWORK_ERROR',
      status: 0,
      isNetwork: true,
      isOffline,
      isTimeout: false,
      message: isOffline
        ? 'You are offline. Please check your connection and try again.'
        : serverMessage || 'Network error. Please try again.',
    };
  }

  // Client-side abort via CancelToken / AbortController signal.
  if (axiosError.code === 'ERR_CANCELED' || axiosError.message?.includes?.('canceled')) {
    return {
      code: 'CANCELLED',
      status: 0,
      isNetwork: false,
      isOffline: false,
      isTimeout: false,
      message: 'Request cancelled.',
    };
  }

  // Axios timeout before server responded.
  if (axiosError.code === 'ECONNABORTED' || /timeout/i.test(axiosError.message || '')) {
    return {
      code: 'TIMEOUT',
      status: 0,
      isNetwork: false,
      isOffline: false,
      isTimeout: true,
      message: serverMessage || 'The server took too long to respond.',
    };
  }

  // HTTP status codes — prefer server-provided user-facing message
  // but fall back to stable defaults when server omitted it.
  const defaults = {
    400: 'Please check your input and try again.',
    401: 'Your session has expired. Please sign in again.',
    403: "You don't have permission to do that.",
    404: 'Resource not found.',
    408: 'Request timed out. Please try again.',
    409: 'Conflict. Please refresh and try again.',
    413: 'Payload too large.',
    422: 'Please review your input and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
    499: 'Request cancelled.',
    500: 'Aura could not respond right now. Please try again shortly.',
    502: 'Server error. Please try again later.',
    503: 'Server unavailable. Please try again later.',
    504: 'Aura took too long to respond. Please try again.',
  };

  return {
    code: status === 401 ? 'UNAUTHORIZED' : status >= 500 ? 'SERVER_ERROR' : status === 429 ? 'RATE_LIMITED' : status === 408 || status === 504 ? 'TIMEOUT' : 'REQUEST_ERROR',
    status,
    isNetwork: false,
    isOffline: false,
    isTimeout: status === 408 || status === 504,
    message: serverMessage || defaults[status] || defaults[500],
  };
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: DEFAULT_TIMEOUT_MS,
});

// ---------------------------------------------------------------
// REQUEST interceptor — attach auth + mark user-aware start time.
// ---------------------------------------------------------------
api.interceptors.request.use((config) => {
  const next = { ...config };
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      next.headers = {
        ...(next.headers || {}),
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    // localStorage access can be blocked by privacy settings. Continue
    // without the auth header — downstream routes that need auth will
    // return 401 and the response interceptor handles that.
  }
  return next;
});

// ---------------------------------------------------------------
// RESPONSE interceptor — normalize errors + auto-logout on 401.
// ---------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (axiosError) => {
    const classification = classifyAxiosError(axiosError);

    if (classification.code === 'UNAUTHORIZED') {
      broadcastUnauthenticated();
    }

    const normalized = createClientError({
      code: classification.code,
      status: classification.status,
      message: classification.message,
      isNetwork: classification.isNetwork,
      isOffline: classification.isOffline,
      isTimeout: classification.isTimeout,
      original: axiosError,
    });

    return Promise.reject(normalized);
  }
);

export default api;
