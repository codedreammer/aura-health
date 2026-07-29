import * as geminiService from '../services/geminiService.js';
import Medicine from '../models/Medicine.js';
import MedicineLog from '../models/MedicineLog.js';
import WaterLog from '../models/WaterLog.js';
import CareCircleContact from '../models/CareCircleContact.js';
import {
  ensureTodayLogsForUser,
  triggerEmergencyAlert,
  checkDailyCompletion,
} from './careCircleController.js';

// ---------------------------------------------------------------------------
// Intent classification — extremely small, deterministic, regex-only. The
// goal is NOT to be clever; it's to skip unnecessary MongoDB work for
// unambiguous inputs. Anything ambiguous falls through to a full dashboard
// hydrate (safe default).
// ---------------------------------------------------------------------------

const GREETING_REGEX =
  /^(?:(?:good\s+(?:morning|afternoon|evening|night))|hi(?:ya)?|hello|hey|yo|sup|howdy|greetings|namaste|bye|goodbye|see\s+(?:you|ya)|later|thanks?(?:\s+a\s+lot)?|thx|tnx|ok|okay|alright|yep|yes|no|nope)\b[!?.\s]*$/i;

const DASHBOARD_QUERY_REGEXES = [
  /\b(how\s+(am\s+i\s+doing|is\s+it\s+going)|today(?:'s|s)?\s+(progress|summary|status|update|snapshot|report|health|dashboard))\b/i,
  /\b(weekly|week|7\s*day|last\s+(few\s+)?days)\s+(progress|summary|overview|report|adherence|compliance)\b/i,
  /\b(am\s+i\s+on\s+track|how\s+far|how\s+close|my\s+(water|meds|medicines|hydration|pill|pills|dosage))\b/i,
  /\b(glasses?\s+(of\s+)?water|med(?:s|icine)s?\s+taken|dosages?\s+completed|strea?k)\b/i,
];

const MAX_MESSAGE_LENGTH = 15_000;
const WATER_GOAL_GLASSES = 8;
const ML_PER_GLASS = 250;

const isPureGreeting = (text) => {
  if (!text || text.length > 45) return false;
  return GREETING_REGEX.test(text.trim());
};

const wantsDashboardData = (text) => {
  if (!text) return false;
  return DASHBOARD_QUERY_REGEXES.some((regex) => regex.test(text));
};

// ---------------------------------------------------------------------------
// Frontend conversation history extraction.
//
// The new App.jsx Coach buildChatPayload wraps the turn history under a
// sentinel header. We pull it back out into [{role,text}] pairs so Gemini's
// `contents[]` receives the full state — enabling pronoun resolution.
// ---------------------------------------------------------------------------

const HISTORY_HEADER = '[Recent Conversation History — use for continuity only, do not repeat these lines to the user]';
const QUESTION_PREFIX = 'User Question:';

const extractConversationHistory = (rawMessage) => {
  if (typeof rawMessage !== 'string' || !rawMessage.includes(HISTORY_HEADER)) {
    return {
      historyTurns: [],
      currentQuestion: rawMessage || '',
    };
  }

  const lines = rawMessage.split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === HISTORY_HEADER);
  if (headerIndex === -1) {
    return { historyTurns: [], currentQuestion: rawMessage };
  }

  const turns = [];
  let questionLineIndex = -1;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith(QUESTION_PREFIX)) {
      questionLineIndex = index;
      break;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('User:')) {
      turns.push({ role: 'user', text: trimmed.slice('User:'.length).trim() });
    } else if (trimmed.startsWith('Aura:')) {
      turns.push({ role: 'assistant', text: trimmed.slice('Aura:'.length).trim() });
    }
  }

  let currentQuestion;
  if (questionLineIndex === -1) {
    // No explicit question marker: last non-empty line before end of header
    // block or final user turn becomes the question.
    const finalUserTurn = [...turns].reverse().find((turn) => turn.role === 'user');
    currentQuestion = finalUserTurn?.text || rawMessage;
  } else {
    currentQuestion = lines
      .slice(questionLineIndex)
      .join('\n')
      .replace(new RegExp(`^${QUESTION_PREFIX}\\s*`), '')
      .trim();
  }

  return { historyTurns: turns, currentQuestion };
};

// ---------------------------------------------------------------------------
// Dashboard hydration helpers.
// ---------------------------------------------------------------------------

const getTodayStartAndEnd = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const buildUserProfile = (reqUser) => {
  if (!reqUser) return null;
  // Use safe field accesses — we intentionally don't destruct the full
  // Mongoose doc so this still works if the protect middleware passes a
  // plain object in tests.
  const pick = (keys) =>
    Object.fromEntries(
      keys
        .map((key) => [key, reqUser[key]])
        .filter(([, value]) => value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0) && value !== '')
    );
  return pick(['fullName', 'age', 'gender', 'height', 'weight', 'bloodGroup', 'allergies', 'chronicDiseases']);
};

const hydrateDashboardSnapshot = async (userId) => {
  // Single-pass, parallel DB queries. Reuses ensureTodayLogsForUser because
  // we need today's medicine log rows to exist before find() below returns
  // anything (otherwise first-day users show 0/0 instead of 0/N).
  try {
    await ensureTodayLogsForUser(userId);
  } catch {
    /* Swallow: missing seed data shouldn't break the chat response */
  }

  const { start: todayStart, end: todayEnd } = getTodayStartAndEnd();

  const [medicines, logs, waterResult, careCircleContacts] = await Promise.all([
    Medicine.find({ userId }).select('_id medicineName').lean(),
    MedicineLog.find({
      userId,
      scheduledDate: { $gte: todayStart, $lte: todayEnd },
    })
      .select('status')
      .lean(),
    WaterLog.aggregate([
      { $match: { userId, loggedAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    CareCircleContact.find({
      userId,
      optIn: true,
    })
      .select('_id')
      .lean(),
  ]);

  const names = medicines.map((medicine) => medicine.medicineName).filter(Boolean);
  const taken = logs.filter((log) => log.status === 'Taken').length;
  const skipped = logs.filter((log) => log.status === 'Skipped').length;
  const total = Math.max(medicines.length, logs.length);
  const waterMl = waterResult?.[0]?.total || 0;
  const waterGlasses = Math.round(waterMl / ML_PER_GLASS);

  return {
    waterGlassCount: waterGlasses,
    waterGoal: WATER_GOAL_GLASSES,
    emergencyContactsCount: careCircleContacts.length,
    medicinesSummary: {
      total,
      taken,
      skipped,
      names,
    },
  };
};

// ---------------------------------------------------------------------------
// Public route handler: POST /ai/chat
// ---------------------------------------------------------------------------

const chatWithCoach = async (req, res) => {
  const userId = req?.user?._id;
  const requestId =
    (req?.body?.meta?.requestId) ||
    `rq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const contextId = req?.body?.meta?.contextId || null;
  const startedAt = Date.now();

  // -------------------------------------------------------------------------
  // 1. Input validation (fail fast, never reach the LLM on garbage).
  // -------------------------------------------------------------------------
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'You must be signed in to chat with Aura.',
      meta: { requestId },
    });
  }

  const rawMessage = req?.body?.message;
  if (typeof rawMessage !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Message must be a string.',
      meta: { requestId },
    });
  }

  const trimmed = rawMessage.trim();
  if (!trimmed) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot be empty.',
      meta: { requestId },
    });
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return res.status(413).json({
      success: false,
      message: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
      meta: { requestId },
    });
  }

  // -------------------------------------------------------------------------
  // 2. Decompose frontend-prefixed input into history + current question.
  // -------------------------------------------------------------------------
  const { historyTurns, currentQuestion } = extractConversationHistory(trimmed);
  const effectiveUserMessage = currentQuestion || trimmed;

  // -------------------------------------------------------------------------
  // 3. Classify intent → decide which dashboard data to fetch (if any).
  // -------------------------------------------------------------------------
  const greeting = isPureGreeting(effectiveUserMessage);
  let intent = 'general';
  if (greeting) intent = 'greeting';
  else if (wantsDashboardData(effectiveUserMessage)) intent = 'dashboard';

  let dashboardSnapshot = {};
  const userProfile = buildUserProfile(req.user);

  if (!greeting) {
    // Greetings skip DB entirely. Everything else at least includes daily
    // completion markers (cheap) so streak stats have a chance to update
    // once per user day, and dashboard-type intents get the full snapshot.
    try {
      await checkDailyCompletion(userId);
    } catch {
      /* streak updates are best-effort only */
    }

    if (intent === 'dashboard') {
      try {
        dashboardSnapshot = await hydrateDashboardSnapshot(userId);
      } catch (dbError) {
        console.error('[aiController] Dashboard hydrate failed', {
          requestId,
          userId: String(userId),
          stack: dbError?.stack || String(dbError),
        });
        dashboardSnapshot = {};
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Call Gemini.
  // -------------------------------------------------------------------------
  let rawReply;
  try {
    rawReply = await geminiService.generateResponseWithHistory({
      userMessage: effectiveUserMessage,
      conversationHistory: historyTurns,
      context: {
        userProfile,
        dashboardSnapshot,
      },
      meta: {
        userId: String(userId),
        requestId,
        contextId,
      },
    });

    if (typeof rawReply !== 'string' || !rawReply.trim()) {
      throw Object.assign(new Error('Empty AI response'), { status: 502 });
    }
  } catch (error) {
    const status = Number(error?.status) || 500;
    const clientMessage =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'Something went wrong while contacting Aura. Please try again in a moment.';

    // Server-side logging keeps the stack trace; clients never see it.
    const causeStack = error?.cause?.stack || error?.stack || null;
    if (causeStack) {
      console.error('[aiController] AI call failed', {
        requestId,
        userId: String(userId),
        intent,
        status,
        message: error?.message,
        stack: causeStack,
      });
    } else {
      console.error('[aiController] AI call failed', {
        requestId,
        userId: String(userId),
        intent,
        status,
        message: error?.message,
      });
    }

    return res.status(status).json({
      success: false,
      message: clientMessage,
      meta: { requestId, intent },
    });
  }

  // -------------------------------------------------------------------------
  // 5. Post-process reply: strip emergency marker, trigger any alert.
  // -------------------------------------------------------------------------
  const emergencyMarker = /^\s*\[Intent:\s*Emergency\]\s*[\r\n]+/i;
  const isEmergency = emergencyMarker.test(rawReply);
  const reply = isEmergency ? rawReply.replace(emergencyMarker, '').trim() : rawReply.trim();

  if (isEmergency) {
    // Fire-and-forget — the user needs the 911 advice in front of them NOW,
    // not after our notification pipeline finishes. Any failure is logged
    // but does not affect the HTTP response.
    Promise.resolve()
      .then(() => triggerEmergencyAlert(userId, effectiveUserMessage, reply))
      .catch((alertError) => {
        console.error('[aiController] Emergency alert dispatch failed', {
          requestId,
          userId: String(userId),
          stack: alertError?.stack || String(alertError),
        });
      });
  }

  const durationMs = Date.now() - startedAt;

  // Request-level access log (no PII). Useful for tracing slow requests or
  // correlating with frontend requestId.
  console.info('[aiController] chat ok', {
    requestId,
    userId: String(userId),
    intent,
    emergency: isEmergency,
    durationMs,
  });

  return res.status(200).json({
    success: true,
    reply,
    meta: {
      requestId,
      emergency: isEmergency,
      cached: false,
      intent,
    },
  });
};

// aiRoutes imports this as a named ESM import: import { chatWithCoach } from './aiController.js'
export { chatWithCoach };

// Exported for unit tests (backend uses "type": "module").
export const __internal = {
  isPureGreeting,
  wantsDashboardData,
  extractConversationHistory,
  buildUserProfile,
};
