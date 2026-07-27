import { getLocalDate } from './dateUtils.js';

const WATER_GOAL = 8;

export const getRelativeTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const minutes = Math.floor((now - date) / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (getLocalDate(date) === getLocalDate(now)) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (getLocalDate(date) === getLocalDate(yesterday)) return 'Yesterday';

  const days = Math.floor((now - date) / 86_400_000);
  return `${days} days ago`;
};

export const buildDashboardNotifications = ({ user, water, medicines }) => {
  const today = getLocalDate();
  const completed = medicines.filter((medicine) => medicine.taken);
  const pending = medicines.filter((medicine) => !medicine.taken);
  const name = user?.fullName?.split(' ')[0] || 'there';
  const notifications = [
    {
      id: `welcome-${today}`,
      title: `Welcome back, ${name}`,
      body: `Here is your wellness summary: ${water} of ${WATER_GOAL} glasses logged and ${completed.length} medicine${completed.length === 1 ? '' : 's'} completed today.`,
      type: 'welcome',
    },
  ];

  if (completed.length) {
    notifications.push({
      id: `medicine-achievement-${today}`,
      title: 'Nice work on your medicine routine',
      body: `You have completed ${completed.length} medicine${completed.length === 1 ? '' : 's'} today. Aura is cheering you on.`,
      type: 'achievement',
    });
  }

  if (pending.length) {
    const medicine = pending[0];
    notifications.push({
      id: `medicine-pending-${today}`,
      title: `A gentle reminder for ${medicine.name}`,
      body: `${medicine.name} is still on today’s schedule${medicine.time && medicine.time !== 'Anytime' ? ` for ${medicine.time}` : ''}. Follow your prescribed plan when it is due.`,
      type: 'reminder',
    });
  }

  if (water >= WATER_GOAL) {
    notifications.push({
      id: `hydration-goal-${today}`,
      title: 'Hydration goal reached',
      body: `You completed all ${WATER_GOAL} glasses today—beautiful consistency!`,
      type: 'achievement',
    });
  } else if (water >= WATER_GOAL - 2) {
    notifications.push({
      id: `hydration-near-${today}`,
      title: 'You are almost at your hydration goal',
      body: `Just ${WATER_GOAL - water} more glass${WATER_GOAL - water === 1 ? '' : 'es'} to go.`,
      type: 'hydration',
    });
  }

  return notifications;
};
