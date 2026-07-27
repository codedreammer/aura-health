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

  useEffect(() => {
    if (!ready) return;

    const tipId = `aura-tip-${getLocalDate()}`;
    if (notificationMap[tipId] || requestedTipIds.current.has(tipId)) return;

    requestedTipIds.current.add(tipId);
    aiService.chat('Create one concise, personalized Aura Tip of the Day from today’s health snapshot. Use one encouraging sentence and no greeting.').then((data) => {
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
    }).catch(() => {
      requestedTipIds.current.delete(tipId);
    });
  }, [notificationMap, ready]);

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
