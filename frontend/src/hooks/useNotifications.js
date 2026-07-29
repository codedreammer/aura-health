import { useEffect, useMemo, useRef, useState } from 'react';
import aiService from '../services/aiService.js';
import { buildDashboardNotifications } from '../utils/notifications.js';
import { getLocalDate } from '../utils/dateUtils.js';

const STORAGE_PREFIX = 'aura-health-notifications';

const safeStorage = {
  /**
   * Safely parse JSON from localStorage. Malformed JSON, quota failures,
   * or disabled storage all fall back to an empty map.
   */
  readObject(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  },
  writeObject(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      // Quota exceeded or storage disabled — the in-memory state still works
      // for the lifetime of this tab, so we don't crash the dashboard.
      return false;
    }
  },
};

/**
 * Merge an array of notification candidates into the existing notification
 * map while preserving createdAt/read/dismissed metadata for any candidate
 * that was already seen. This prevents "re-surfacing" of dismissed notifications
 * whenever dashboard data changes.
 */
const mergeCandidates = (currentMap, candidates) => {
  const next = { ...currentMap };
  const createdAt = new Date().toISOString();

  for (const candidate of candidates) {
    const existing = next[candidate.id];
    next[candidate.id] = {
      ...candidate,
      createdAt: existing?.createdAt || createdAt,
      read: existing?.read || false,
      dismissed: existing?.dismissed || false,
    };
  }

  return next;
};

/**
 * Map aiService error codes → user-friendly text for the Tip of the Day
 * feature. Tips are non-critical, so we intentionally NEVER surface raw
 * backend error text in the bell panel. We only log richer info in dev.
 */
const formatTipError = (error) => {
  switch (error?.code) {
    case 'OFFLINE':
      return 'Device offline';
    case 'NETWORK_ERROR':
      return 'Network error';
    case 'TIMEOUT':
      return 'Timeout';
    case 'RATE_LIMITED':
      return 'Rate limited';
    case 'SERVER_ERROR':
      return 'Server error';
    case 'UNAUTHORIZED':
      return 'Session expired';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
};

const logTipError = (error, tipId) => {
  // Non-critical feature: dev-only logging keeps the user console clean.
  if (import.meta.env?.DEV !== true) return;
  // eslint-disable-next-line no-console
  console.warn(`[useNotifications] Tip generation skipped (${tipId}): ${formatTipError(error)}`);
};

export default function useNotifications({ user, water, medicines, ready }) {
  const storageKey = `${STORAGE_PREFIX}-${user?._id || 'guest'}`;

  const [notificationMap, setNotificationMap] = useState(() =>
    safeStorage.readObject(storageKey)
  );

  /**
   * Per-user in-flight dedup. Keys are composite: `${storageKey}::${tipId}`.
   * Stops the following scenario:
   *   1. User A logs in, dashboard loads, tip fetch starts (in-flight)
   *   2. User A logs out → User B logs in within the same second
   *   3. The Set still contained User A's `aura-tip-YYYY-MM-DD` entry from (1)
   *      → User B's tip would incorrectly skip because date matched
   */
  const inFlightTipKeys = useRef(new Set());
  const previousStorageKeyRef = useRef(storageKey);

  const candidates = useMemo(
    () => buildDashboardNotifications({ user, water, medicines }),
    [user, water, medicines]
  );

  // ---------------------------------------------------------------
  // Effect 1 — rehydrate the map when the storage owner changes
  //           (guest → logged in, or user A → user B)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      const previousStorageKey = previousStorageKeyRef.current;
      if (previousStorageKey !== storageKey) {
        try {
          localStorage.removeItem(previousStorageKey);
        } catch {
          /* Storage disabled — clear the in-memory notifications below. */
        }
      }
      previousStorageKeyRef.current = storageKey;
      setNotificationMap({});
      return;
    }

    previousStorageKeyRef.current = storageKey;
    setNotificationMap(safeStorage.readObject(storageKey));
  }, [storageKey, user]);

  // ---------------------------------------------------------------
  // Effect 2 — merge dashboard-generated candidate notifications
  //           into the persisted map whenever inputs change.
  //           Only runs once the dashboard data is actually ready.
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!user || !ready) return;
    setNotificationMap((current) => mergeCandidates(current, candidates));
  }, [candidates, ready]);

  // ---------------------------------------------------------------
  // Effect 3 — persist map → localStorage whenever it changes or
  //           the storage owner changes. Failures are swallowed
  //           because in-memory state already reflects the truth.
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    safeStorage.writeObject(storageKey, notificationMap);
  }, [notificationMap, storageKey, user]);

  const tipId = `aura-tip-${getLocalDate()}`;
  const hasTip = Boolean(notificationMap[tipId]);
  const tipDedupKey = `${storageKey}::${tipId}`;

  // ---------------------------------------------------------------
  // Effect 4 — fetch a single "Tip of the Day" from Aura Coach for
  //           the current user + day. Uses an AbortController so
  //           StrictMode double-mount / tab switch cancel the HTTP
  //           request instead of letting it run to completion on
  //           the server (Gemini quota protection).
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!user || !ready || hasTip || inFlightTipKeys.current.has(tipDedupKey)) {
      return undefined;
    }

    const abortController = new AbortController();
    inFlightTipKeys.current.add(tipDedupKey);
    let cancelled = false;

    const fetchTip = async () => {
      try {
        const data = await aiService.chat(
          'Create one concise, personalized Aura Tip of the Day from today health snapshot. Use one encouraging sentence and no greeting.',
          {
            signal: abortController.signal,
            contextId: tipDedupKey,
            allowRetry: true,
          }
        );

        if (cancelled || abortController.signal.aborted) return;
        if (typeof data?.reply !== 'string' || !data.reply.trim()) return;

        setNotificationMap((current) => {
          // Double-check: if a parallel write already stored the tip
          // (e.g. another effect branch), avoid overwriting it.
          if (current[tipId]) return current;
          return {
            ...current,
            [tipId]: {
              id: tipId,
              title: 'Aura Tip of the Day',
              body: data.reply.trim(),
              type: 'tip',
              createdAt: new Date().toISOString(),
              read: false,
              dismissed: false,
            },
          };
        });
      } catch (error) {
        // Cancelled flows are not errors — they're expected under StrictMode
        // and unmount. Do not log, do not persist failure state.
        if (error?.code === 'CANCELLED') return;
        logTipError(error, tipId);
      } finally {
        inFlightTipKeys.current.delete(tipDedupKey);
      }
    };

    fetchTip();

    return () => {
      cancelled = true;
      // Abort the in-flight request. The axios interceptor converts the
      // cancel event to a CANCELLED error code; the try/catch above ignores it.
      try {
        abortController.abort();
      } catch {
        /* AbortController.abort can throw in older browsers; ignore */
      }
      inFlightTipKeys.current.delete(tipDedupKey);
    };
  }, [hasTip, ready, tipDedupKey, tipId, user]);

  // ---------------------------------------------------------------
  // Public view of notifications + user actions.
  // ---------------------------------------------------------------
  const notifications = useMemo(
    () =>
      Object.values(notificationMap)
        .filter((notification) => !notification.dismissed)
        .sort((left, right) => {
          const leftDate = new Date(left.createdAt || 0).getTime();
          const rightDate = new Date(right.createdAt || 0).getTime();
          return rightDate - leftDate;
        }),
    [notificationMap]
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const markAsRead = (id) => {
    if (typeof id !== 'string') return;
    setNotificationMap((current) => {
      if (!current[id]) return current;
      return { ...current, [id]: { ...current[id], read: true } };
    });
  };

  const markAllAsRead = () => {
    setNotificationMap((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, notification]) => [
          id,
          { ...notification, read: true },
        ])
      )
    );
  };

  const clearAll = () => {
    setNotificationMap((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, notification]) => [
          id,
          { ...notification, dismissed: true, read: true },
        ])
      )
    );
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
