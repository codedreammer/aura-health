export const getLocalDate = (date = new Date()) => {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

export const toTwentyFourHourTime = (value) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '00:00';
  }

  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${minutes}`;
};
