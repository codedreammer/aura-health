import CareCircleContact from '../models/CareCircleContact.js';
import NotificationLog from '../models/NotificationLog.js';
import Medicine from '../models/Medicine.js';
import WaterLog from '../models/WaterLog.js';
import MedicineLog from '../models/MedicineLog.js';
import { sendSimulatedNotification } from '../services/notificationService.js';

// ==========================================================================
// Shared utilities
// ==========================================================================

const toTwentyFourHourTime = (value) => {
  if (!value) return '08:00';
  const cleaned = String(value).trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(cleaned) ? cleaned : '08:00';
  }

  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

const getTodayWindow = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

// ==========================================================================
// Exported helpers (used by aiController, scheduled jobs, tests).
//
// NOTE: These exports look unused to ESLint because careCircleController is
// only wired to routes for CRUD + notification history. They are consumed
// across the app via direct imports — please do not remove them.
// ==========================================================================

/**
 * Seed MedicineLog + (optionally) WaterLog rows for today if they don't yet
 * exist. Safe to call multiple times per day.
 *
 * `options.skipWaterLog` lets callers like the AI controller skip the
 * pointless creation of a 0-amount WaterLog row on every chat turn.
 */
export const ensureTodayLogsForUser = async (userId, options = {}) => {
  if (!userId) return;

  const { skipWaterLog = false } = options;
  const { start: todayStart, end: tomorrowStart } = getTodayWindow();

  const activeMeds = await Medicine.find({ userId, active: true })
    .select('_id userId reminderTimes active')
    .lean();

  if (activeMeds.length > 0) {
    // Bulk-build + bulk-find-one-or-create style loop. Keep sequential per
    // medicine to keep per-day rows deterministic; this runs once per user
    // per day so perf is not a concern.
    for (const med of activeMeds) {
      const times = Array.isArray(med.reminderTimes) && med.reminderTimes.length > 0
        ? med.reminderTimes
        : ['08:00 AM'];
      for (const timeStr of times) {
        const scheduledTime = toTwentyFourHourTime(timeStr);
        const existing = await MedicineLog.findOne({
          userId,
          medicineId: med._id,
          scheduledDate: { $gte: todayStart, $lt: tomorrowStart },
          scheduledTime,
        }).select('_id').lean();
        if (!existing) {
          try {
            await MedicineLog.create({
              userId,
              medicineId: med._id,
              scheduledDate: todayStart,
              scheduledTime,
              status: 'Pending',
            });
          } catch {
            /* swallow duplicate / race — another caller seeded the row */
          }
        }
      }
    }
  }

  if (skipWaterLog) return;

  const waterLogs = await WaterLog.find({
    userId,
    loggedAt: { $gte: todayStart, $lt: tomorrowStart },
  }).select('_id amount').limit(1).lean();

  if (waterLogs.length === 0) {
    try {
      await WaterLog.create({ userId, amount: 0, loggedAt: todayStart });
    } catch {
      /* duplicate guard — same safety as med logs above */
    }
  }
};

/* Exported for the scheduled "every X minutes" medicine reminder job (future).
   Currently triggered by `simulateReminderFlow` and tests only. */
export const checkAndTriggerOverdueNotifications = async (userId, userName) => {
  try {
    if (!userId) return;
    const { start: todayStart, end: tomorrowStart } = getTodayWindow();

    const todayLogs = await MedicineLog.find({
      userId,
      scheduledDate: { $gte: todayStart, $lt: tomorrowStart },
      status: { $in: ['Pending', 'Missed'] },
    }).populate('medicineId');

    const now = Date.now();
    for (const log of todayLogs) {
      if (!log.medicineId) continue;
      const medicineName = log.medicineId.medicineName;

      const [hours, minutes] = (log.scheduledTime || '00:00').split(':').map((v) => Number(v) || 0);
      const scheduledDateTime = new Date(log.scheduledDate || todayStart);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      const diffMinutes = Math.max(0, Math.round((now - scheduledDateTime.getTime()) / 60000));

      // Stage 1 — Reminder 1 (anytime past due)
      const existingLog1 = await NotificationLog.findOne({
        userId,
        medicineLogId: log._id,
        type: 'Reminder 1',
      }).select('_id').lean();
      if (!existingLog1) {
        await sendSimulatedNotification({
          userId,
          medicineLogId: log._id,
          type: 'Reminder 1',
          recipientName: userName,
          recipientType: 'User',
          channel: 'SMS',
          destination: '+1 (555) 019-9231',
          message: `Hi ${userName}, this is a gentle reminder to take your scheduled dose of ${medicineName} (due at ${log.scheduledTime}). Please record it in your Aura dashboard when taken.`,
        });
      }

      // Stage 2 — Reminder 2 (15 min overdue)
      if (diffMinutes >= 15) {
        const existingLog2 = await NotificationLog.findOne({
          userId,
          medicineLogId: log._id,
          type: 'Reminder 2',
        }).select('_id').lean();
        if (!existingLog2) {
          await sendSimulatedNotification({
            userId,
            medicineLogId: log._id,
            type: 'Reminder 2',
            recipientName: userName,
            recipientType: 'User',
            channel: 'SMS',
            destination: '+1 (555) 019-9231',
            message: `Hi ${userName}, your medicine ${medicineName} (scheduled for ${log.scheduledTime}) is 15 minutes overdue. Please log it soon to keep your adherence streak active!`,
          });
        }
      }

      // Stage 3 — Care Circle escalation (30 min overdue)
      if (diffMinutes >= 30) {
        const existingEscalation = await NotificationLog.findOne({
          userId,
          medicineLogId: log._id,
          type: 'Care Circle Escalation',
        }).select('_id').lean();
        if (!existingEscalation) {
          const contacts = await CareCircleContact.find({
            userId,
            optIn: true,
            'sharingSettings.missedMedicines': true,
          }).select('_id name relationship phone email').lean();

          // Mark missed even if the contacts list is empty — audit trail.
          try {
            log.status = 'Missed';
            await log.save();
          } catch {
            /* ignore if another worker already updated the row */
          }

          if (contacts.length === 0) {
            await sendSimulatedNotification({
              userId,
              medicineLogId: log._id,
              type: 'Care Circle Escalation',
              recipientName: 'Demo Guardian (No contacts configured)',
              recipientType: 'Care Circle Contact',
              channel: 'Email',
              destination: 'guardian@aurahealth.com',
              message: `Aura Health Escalation: ${userName} has missed their scheduled dose of ${medicineName} (due at ${log.scheduledTime}). Since no contacts are registered, we are issuing this fallback alert.`,
            });
          } else {
            for (const contact of contacts) {
              const dest = contact.phone || contact.email || 'contact@example.com';
              const chan = contact.phone ? 'SMS' : 'Email';
              await sendSimulatedNotification({
                userId,
                contactId: contact._id,
                medicineLogId: log._id,
                type: 'Care Circle Escalation',
                recipientName: contact.name,
                recipientType: 'Care Circle Contact',
                channel: chan,
                destination: dest,
                message: `Aura Health Alert: ${userName} has missed their scheduled dose of ${medicineName} (due at ${log.scheduledTime}). As their registered ${contact.relationship}, we are notifying you so you can follow up with them.`,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[careCircle] Error during automated overdue check:', error);
  }
};

/**
 * If the user completed both hydration and medicine adherence today, send a
 * single "Daily Completion" event to opted-in Care Circle contacts. Runs as
 * best-effort; failures are logged server-side only and never thrown to the
 * caller (aiController chat handler).
 */
export const checkDailyCompletion = async (userId, userName) => {
  try {
    if (!userId) return;
    const { start: todayStart, end: tomorrowStart } = getTodayWindow();

    const WATER_GOAL_ML = 8 * 250;
    const [waterAggregate, activeMedicines, existingLog] = await Promise.all([
      WaterLog.aggregate([
        { $match: { userId, loggedAt: { $gte: todayStart, $lt: tomorrowStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Medicine.find({ userId, active: true }).select('_id reminderTimes active').lean(),
      NotificationLog.findOne({
        userId,
        type: 'Daily Completion',
        createdAt: { $gte: todayStart },
      }).select('_id').lean(),
    ]);

    const totalWater = waterAggregate?.[0]?.total || 0;
    if (totalWater < WATER_GOAL_ML) return;

    let medicineGoalReached = activeMedicines.length === 0 && totalWater > 0;
    if (activeMedicines.length > 0) {
      const todayLogs = await MedicineLog.find({
        userId,
        scheduledDate: { $gte: todayStart, $lt: tomorrowStart },
      }).select('status').lean();

      const hasPendingOrMissed = todayLogs.some(
        (log) => log.status === 'Pending' || log.status === 'Missed'
      );
      const totalTaken = todayLogs.filter((log) => log.status === 'Taken').length;

      const totalRemindersCount = activeMedicines.reduce(
        (sum, med) => sum + (Array.isArray(med.reminderTimes) ? med.reminderTimes.length : 1),
        0
      );

      medicineGoalReached = totalTaken >= totalRemindersCount && !hasPendingOrMissed;
    }

    if (!medicineGoalReached) return;
    if (existingLog) return;

    const contacts = await CareCircleContact.find({
      userId,
      optIn: true,
      'sharingSettings.dailyCompletion': true,
    }).select('_id name relationship phone email').lean();

    for (const contact of contacts) {
      const dest = contact.phone || contact.email || 'contact@example.com';
      const chan = contact.phone ? 'SMS' : 'Email';
      await sendSimulatedNotification({
        userId,
        contactId: contact._id,
        type: 'Daily Completion',
        recipientName: contact.name,
        recipientType: 'Care Circle Contact',
        channel: chan,
        destination: dest,
        message: `Aura Health: Great news! ${userName} has completed all of their wellness tasks today, including their hydration goals and medicine schedule. Thanks for being part of their care circle!`,
      });
    }
  } catch (error) {
    console.error('[careCircle] Failed to trigger daily completion notification:', error);
  }
};

/**
 * Emergency path. Called by aiController when Gemini returns `[Intent: Emergency]`.
 * aiController invokes this as fire-and-forget so the user gets the 911
 * advice immediately; we still log every step for compliance audits.
 */
export const triggerEmergencyAlert = async (userId, conversationSnippet, aiReplyText) => {
  try {
    if (!userId) return;

    const safeSnippet =
      typeof conversationSnippet === 'string'
        ? conversationSnippet.trim().slice(0, 240)
        : 'No symptom text captured';
    const safeAiReply = typeof aiReplyText === 'string' ? aiReplyText.trim().slice(0, 240) : '';

    const contacts = await CareCircleContact.find({
      userId,
      optIn: true,
      'sharingSettings.emergencyAlerts': true,
    }).select('_id name relationship phone email').lean();

    // Always write an audit NotificationLog row for the user themselves so
    // clinicians / admins can prove an alert fired, even if zero contacts
    // are registered.
    if (contacts.length === 0) {
      await sendSimulatedNotification({
        userId,
        type: 'Emergency Alert',
        recipientName: 'Fallback Emergency Contact (None configured)',
        recipientType: 'Care Circle Contact',
        channel: 'Audit',
        destination: 'emergency-audit@aurahealth.com',
        message: `AURA EMERGENCY ALERT (no contacts): User reported "${safeSnippet}". Aura advised: ${safeAiReply || 'Call emergency services immediately.'}`,
      });
      return;
    }

    for (const contact of contacts) {
      const dest = contact.phone || contact.email || 'contact@example.com';
      const chan = contact.phone ? 'SMS' : 'Email';
      try {
        await sendSimulatedNotification({
          userId,
          contactId: contact._id,
          type: 'Emergency Alert',
          recipientName: contact.name,
          recipientType: 'Care Circle Contact',
          channel: chan,
          destination: dest,
          message: `AURA EMERGENCY ALERT: User reported to Aura Coach: "${safeSnippet}". Please contact them immediately. Aura advised: ${safeAiReply || 'Call emergency services.'}`,
        });
      } catch (notificationError) {
        // One failing contact (e.g. invalid email format) must never block
        // alerting the rest of the care circle.
        console.error('[careCircle] Single emergency notification failed', {
          userId: String(userId),
          contactId: String(contact._id),
          channel: chan,
          destination: dest,
          error: notificationError?.message || String(notificationError),
        });
      }
    }
  } catch (error) {
    console.error('[careCircle] Failed to trigger emergency Care Circle alerts:', error);
  }
};

// ==========================================================================
// REST handlers for Care Circle Contacts (used by /api/care-circle routes)
// ==========================================================================

export const getContacts = async (req, res) => {
  try {
    const contacts = await CareCircleContact.find({ userId: req.user._id })
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, contacts });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve Care Circle contacts.',
    });
  }
};

export const createContact = async (req, res) => {
  try {
    const { name, relationship, email, phone, sharingSettings, optIn } = req.body || {};

    // Strict runtime validation — never trust the frontend form.
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (typeof relationship !== 'string' || !relationship.trim()) {
      return res.status(400).json({ success: false, message: 'Relationship is required.' });
    }

    const emailProvided = typeof email === 'string' && email.trim() !== '';
    const phoneProvided = typeof phone === 'string' && phone.trim() !== '';
    if (!emailProvided && !phoneProvided) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least an email or phone number.',
      });
    }

    const created = await CareCircleContact.create({
      userId: req.user._id,
      name: name.trim(),
      relationship: relationship.trim(),
      email: emailProvided ? email.trim() : undefined,
      phone: phoneProvided ? phone.trim() : undefined,
      sharingSettings,
      optIn,
    });

    // Strip __v before returning.
    const contact = await CareCircleContact.findById(created._id).select('-__v').lean();
    return res.status(201).json({ success: true, contact });
  } catch (error) {
    console.error('[careCircle] createContact failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Care Circle contact.',
    });
  }
};

export const updateContact = async (req, res) => {
  try {
    const { name, relationship, email, phone, sharingSettings, optIn } = req.body || {};
    const contact = await CareCircleContact.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Care Circle contact not found.',
      });
    }

    // Use `!== undefined` guards so PATCH-style partial updates never wipe
    // stored fields the caller intentionally omitted (H10 P0 fix).
    if (name !== undefined && typeof name === 'string') {
      contact.name = name.trim() || contact.name;
    }
    if (relationship !== undefined && typeof relationship === 'string') {
      contact.relationship = relationship.trim() || contact.relationship;
    }
    if (email !== undefined) {
      // Allow explicit "" / null / undefined clears only when caller is
      // deliberately clearing and the contact still has a phone.
      if (typeof email === 'string') {
        const cleaned = email.trim();
        if (cleaned === '') {
          if (contact.phone) contact.email = undefined;
        } else {
          contact.email = cleaned;
        }
      }
    }
    if (phone !== undefined) {
      if (typeof phone === 'string') {
        const cleaned = phone.trim();
        if (cleaned === '') {
          if (contact.email) contact.phone = undefined;
        } else {
          contact.phone = cleaned;
        }
      }
    }
    if (sharingSettings !== undefined && typeof sharingSettings === 'object') {
      contact.sharingSettings = sharingSettings;
    }
    if (optIn !== undefined) {
      contact.optIn = Boolean(optIn);
    }

    // Guard: after all mutations, refuse to save a contact that has zero
    // contact methods.
    if (!contact.email && !contact.phone) {
      return res.status(400).json({
        success: false,
        message: 'Contact must keep at least one email or phone number.',
      });
    }

    await contact.save();

    const refreshed = await CareCircleContact.findById(contact._id).select('-__v').lean();
    return res.status(200).json({ success: true, contact: refreshed });
  } catch (error) {
    console.error('[careCircle] updateContact failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Care Circle contact.',
    });
  }
};

export const deleteContact = async (req, res) => {
  try {
    const contact = await CareCircleContact.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Care Circle contact not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Care Circle contact removed successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete Care Circle contact.',
    });
  }
};

// ==========================================================================
// Notification history + simulation
// ==========================================================================

export const getNotificationLogs = async (req, res) => {
  try {
    const logs = await NotificationLog.find({ userId: req.user._id })
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notification logs.',
    });
  }
};

export const clearNotificationLogs = async (req, res) => {
  try {
    await NotificationLog.deleteMany({ userId: req.user._id });
    return res.status(200).json({
      success: true,
      message: 'Notification history cleared successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to clear notification logs.',
    });
  }
};

export const simulateReminderFlow = async (req, res) => {
  try {
    let medicineName = 'Aspirin (81mg)';
    const userMedicine = await Medicine.findOne({
      userId: req.user._id,
      active: true,
    }).select('medicineName').lean();
    if (userMedicine) medicineName = userMedicine.medicineName;

    const userName = req.user.fullName;

    const contacts = await CareCircleContact.find({
      userId: req.user._id,
      optIn: true,
      'sharingSettings.missedMedicines': true,
    }).select('_id name relationship phone email').lean();

    const simulatedLogs = [];
    const push = (log) => { if (log) simulatedLogs.push(log); };

    push(
      await sendSimulatedNotification({
        userId: req.user._id,
        type: 'Reminder 1',
        recipientName: userName,
        recipientType: 'User',
        channel: 'SMS',
        destination: '+1 (555) 019-9231',
        message: `Hi ${userName}, this is a gentle reminder to take your scheduled dose of ${medicineName}. Please log it in your Aura dashboard when completed.`,
      })
    );

    push(
      await sendSimulatedNotification({
        userId: req.user._id,
        type: 'Reminder 2',
        recipientName: userName,
        recipientType: 'User',
        channel: 'SMS',
        destination: '+1 (555) 019-9231',
        message: `Hi ${userName}, you still have not recorded your ${medicineName} dose. This is your second reminder. Logging your medicines keeps your health streak alive!`,
      })
    );

    if (contacts.length === 0) {
      push(
        await sendSimulatedNotification({
          userId: req.user._id,
          type: 'Care Circle Escalation',
          recipientName: 'Demo Guardian (No contacts configured)',
          recipientType: 'Care Circle Contact',
          channel: 'Email',
          destination: 'guardian@aurahealth.com',
          message: `Aura Health Escalation: ${userName} has missed their scheduled dose of ${medicineName}. Since they have no contacts added, we are sending this demo alert.`,
        })
      );
    } else {
      for (const contact of contacts) {
        const dest = contact.phone || contact.email || 'contact@example.com';
        const chan = contact.phone ? 'SMS' : 'Email';
        push(
          await sendSimulatedNotification({
            userId: req.user._id,
            contactId: contact._id,
            type: 'Care Circle Escalation',
            recipientName: contact.name,
            recipientType: 'Care Circle Contact',
            channel: chan,
            destination: dest,
            message: `Aura Health Alert: ${userName} has missed their scheduled dose of ${medicineName}. As their registered ${contact.relationship}, we are notifying you to check in on their wellness.`,
          })
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Missed medicine reminder flow simulated successfully.',
      logs: simulatedLogs,
    });
  } catch (error) {
    console.error('[careCircle] Simulation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute reminder flow simulation.',
    });
  }
};
