import NotificationLog from '../models/NotificationLog.js';

export const sendSimulatedNotification = async ({
  userId,
  contactId = null,
  medicineLogId = null,
  type,
  recipientName,
  recipientType,
  channel,
  destination,
  message,
}) => {
  console.log(`\n==================================================`);
  console.log(`[SIMULATED NOTIFICATION - ${type.toUpperCase()}]`);
  console.log(`Channel:      ${channel}`);
  console.log(`Recipient:    ${recipientName} (${recipientType})`);
  console.log(`Destination:  ${destination}`);
  console.log(`Message:      "${message}"`);
  console.log(`==================================================\n`);

  try {
    const log = await NotificationLog.create({
      userId,
      contactId,
      medicineLogId,
      type,
      recipientName,
      recipientType,
      channel,
      destination,
      message,
      status: 'Simulated',
    });
    return log;
  } catch (error) {
    console.error('Failed to save simulated notification log:', error);
    return null;
  }
};
