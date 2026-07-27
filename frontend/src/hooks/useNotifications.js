import { useEffect, useMemo, useRef, useState } from 'react';
import aiService from '../services/aiService.js';
import { buildDashboardNotifications } from '../utils/notifications.js';
import { getLocalDate } from '../utils/dateUtils.js';

const STORAGE_PREFIX = 'aura-health-notifications';

const readNotifications = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
};

export default function useNotifications({ user, water, medicines, ready }) {
  const storageKey = `${STORAGE_PREFIX}-${user?._id || 'guest'}`;
  const [notificationMap, setNotificationMap] = useState(() => readNotifications(storageKey));
  const requestedTipIds = useRef(new Set());
  const candidates = useMemo(() => buildDashboardNotifications({ user, water, medicines }), [user, water, medicines]);

  useEffect(() => {
    setNotificationMap(readNotifications(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;

    setNotificationMap((current) => {
      const next = { ...current };
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
    });
  }, [candidates, ready]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notificationMap));
  }, [notificationMap, storageKey]);

  const tipId = `aura-tip-${getLocalDate()}`;
  const hasTip = Boolean(notificationMap[tipId]);

  useEffect(() => {
    if (!ready || hasTip || requestedTipIds.current.has(tipId)) return;

    let active = true;
    requestedTipIds.current.add(tipId);

    const fetchTip = async () => {
      try {
        const data = await aiService.chat('Create one concise, personalized Aura Tip of the Day from today health snapshot. Use one encouraging sentence and no greeting.');
        if (!active || typeof data?.reply !== 'string' || !data.reply.trim()) return;

        setNotificationMap((current) => ({
          ...current,
          [tipId]: {
            id: tipId,
            title: 'Aura Tip of the Day',
            body: data.reply,
            type: 'tip',
            createdAt: new Date().toISOString(),
            read: false,
            dismissed: false,
          },
        }));
      } catch {
        // Tips are optional; a failed request must not affect the dashboard.
      } finally {
        requestedTipIds.current.delete(tipId);
      }
    };

    fetchTip();
    return () => {
      active = false;
      requestedTipIds.current.delete(tipId);
    };
  }, [hasTip, ready, tipId]);

  const notifications = Object.values(notificationMap)
    .filter((notification) => !notification.dismissed)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  const markAsRead = (id) => {
    setNotificationMap((current) => ({
      ...current,
      [id]: { ...current[id], read: true },
    }));
  };

  const markAllAsRead = () => {
    setNotificationMap((current) => Object.fromEntries(
      Object.entries(current).map(([id, notification]) => [id, { ...notification, read: true }]),
    ));
  };

  const clearAll = () => {
    setNotificationMap((current) => Object.fromEntries(
      Object.entries(current).map(([id, notification]) => [id, { ...notification, dismissed: true, read: true }]),
    ));
  };

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
