import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useAuth from './hooks/useAuth.js';
import LoginPage from './pages/LoginPage.jsx';
import medicineLogService from './services/medicineLogService.js';
import medicineService from './services/medicineService.js';
import waterService from './services/waterService.js';
import aiService from './services/aiService.js';
import MarkdownText from './components/MarkdownText.jsx';
import NotificationPanel from './components/NotificationPanel.jsx';
import useNotifications from './hooks/useNotifications.js';
import CareCircle from './components/CareCircle.jsx';
import { getLocalDate, toTwentyFourHourTime } from './utils/dateUtils.js';

const GOALS = { water: 8, meals: 3 };
const WATER_GLASS_ML = 250;
const EMPTY_STATE = {
  water: 0,
  meals: 0,
  meds: [],
  streak: 0,
  loaded: false,
  insights: { water: Array(7).fill(0), adherence: Array(7).fill(0), days: [] },
};

// ==========================================================================
// Coach constants — grouped together so they are easy to tune.
// ==========================================================================
const COACH = {
  /** Maximum number of previous messages included in each chat request. */
  MAX_HISTORY_MESSAGES: 10,
  /** localStorage cache for the welcome message — invalidates each calendar day. */
  WELCOME_CACHE_PREFIX: 'aura-welcome',
  /** sessionStorage key used to persist chat messages across tab refresh. */
  SESSION_STORAGE_KEY: 'aura-coach-session',
  /** Maximum session size (in chars) before we truncate. Guards against memory creep. */
  MAX_SESSION_CHARS: 50_000,
};

const Ring = ({ p, size = 64, stroke = 7, children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - Math.min(Math.max(p, 0), 1) * c;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E7EFEA" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#aura)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-600 ease-out" />
      </svg>
      {children}
    </div>
  );
};

const getLogMedicineId = (medicineLog) => medicineLog.medicineId?._id || medicineLog.medicineId;

const buildInsights = (waterLogs, medicineLogs) => {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return getLocalDate(date);
  });

  const water = days.map((day) => {
    const amount = waterLogs
      .filter((waterLog) => getLocalDate(new Date(waterLog.loggedAt)) === day)
      .reduce((total, waterLog) => total + waterLog.amount, 0);
    return Math.round(amount / WATER_GLASS_ML);
  });

  const adherence = days.map((day) => {
    const logs = medicineLogs.filter((medicineLog) => getLocalDate(new Date(medicineLog.scheduledDate)) === day);
    if (!logs.length) return 0;
    return logs.every((medicineLog) => medicineLog.status === 'Taken') ? 1 : 0;
  });

  return {
    water,
    adherence,
    days: days.map((_, index) => (index === 6 ? 'Today' : index === 5 ? 'Yesterday' : `${6 - index}d ago`)),
  };
};

// ==========================================================================
// Helpers used by both Today tab and the root App action handlers. Keeping
// them pure (outside components) makes them easy to test in isolation.
// ==========================================================================

const resolveReminderTime = (reminderTime) => {
  const clean = (reminderTime || '').trim();
  if (!clean) return 'Anytime';
  // Only coerce to 24h format if the user typed AM/PM. Otherwise leave as-is
  // so raw 24h inputs (HH:MM) continue to round-trip cleanly.
  return /[AP]M$/i.test(clean) ? toTwentyFourHourTime(clean) : clean;
};

// ==========================================================================
// Today Tab — PRESERVED UI (zero visual changes), only internals hardened.
// ==========================================================================
function Today({ st, onAddMedicine, onQuickLog, onToggleMedicine, user }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const hr = new Date().getHours();
  const tkn = st.meds.filter((medicine) => medicine.taken).length;
  const pend = st.meds.find((medicine) => !medicine.taken);

  const add = async (event) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    try {
      await onAddMedicine(cleanName, resolveReminderTime(time));
    } catch {
      // Swallow at UI level — the root-level action handler already logs
      // for debugging, and the button disabled/loading state would be the
      // only visual feedback if we later choose to show one. We explicitly
      // do NOT change the UI here.
    } finally {
      setName('');
      setTime('');
      setShow(false);
    }
  };

  return (
    <div className="px-5 pb-8">
      <div className="flex items-center justify-between mt-5">
        <div>
          <p className="text-sm text-[#16302B]/60">Good {hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening'},</p>
          <h1 className="font-display text-2xl italic -mt-0.5">{user?.fullName || 'there'}</h1>
        </div>
        <div className="relative w-14 h-14 flex items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-[#F6F8F3]">
          <div className="aura-glow aura-pulse absolute inset-0 rounded-full"></div>
          <div className="absolute inset-[3px] rounded-full bg-white flex flex-col items-center justify-center"><span className="font-display text-base leading-none">{st.streak}</span><span className="text-[9px] text-[#16302B]/50 mt-0.5">day streak</span></div>
        </div>
      </div>

      {pend && (
        <div className="mt-5 rounded-2xl bg-[#F0784A]/10 border border-[#F0784A]/25 px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⏰</span>
          <div><p className="text-sm font-semibold">{pend.name} is due</p><p className="text-xs text-[#16302B]/60">usually around {pend.time}</p></div>
        </div>
      )}

      <h2 className="text-sm font-bold uppercase tracking-wide text-[#16302B]/50 mt-6 mb-3">Quick log</h2>
      <div className="grid grid-cols-3 gap-3">
        {[{ i: '💧', l: 'Water', v: st.water, m: GOALS.water, k: 'water' }, { i: '💊', l: 'Medicine', v: tkn, m: st.meds.length, k: null }, { i: '🍽️', l: 'Meals', v: st.meals, m: GOALS.meals, k: 'meals' }].map((button) => (
          <button key={button.l} onClick={() => button.k && onQuickLog(button.k)} className={`${button.k ? 'tap' : ''} flex flex-col items-center gap-2 bg-white rounded-2xl p-3 shadow-sm border border-black/5`}>
            <Ring p={button.m ? button.v / button.m : 0} size={52} stroke={5}><span className="text-lg">{button.i}</span></Ring>
            <span className="text-xs font-semibold">{button.l}</span><span className="text-[11px] text-[#16302B]/50">{button.v}/{button.m}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <div className="flex justify-between mb-1"><h2 className="text-sm font-bold">Today's medicines</h2><button onClick={() => setShow((current) => !current)} className="text-xs font-semibold text-[#1F7A63]">{show ? 'Cancel' : '+ Add'}</button></div>
        {show && (
          <form onSubmit={add} className="flex gap-2 mt-3 mb-1">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30" />
            <input value={time} onChange={(event) => setTime(event.target.value)} placeholder="9:00 AM" className="w-28 rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30" />
            <button className="tap rounded-lg bg-[#16302B] text-white px-3 text-sm font-semibold">Add</button>
          </form>
        )}
        <div className="mt-2 divide-y divide-black/5">
          {st.meds.map((medicine) => (
            <button key={medicine.id} onClick={() => onToggleMedicine(medicine)} className="tap w-full flex items-center gap-3 py-2.5 text-left">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${medicine.taken ? 'bg-[#1F7A63] text-white' : 'border-2 border-black/15 text-transparent'}`}>✓</span>
              <span className={`flex-1 text-sm ${medicine.taken ? 'line-through text-[#16302B]/40' : ''}`}>{medicine.name}</span><span className="text-xs text-[#16302B]/40">{medicine.time}</span>
            </button>
          ))}
          {!st.meds.length && <p className="text-sm text-[#16302B]/40 py-2">No medicines added.</p>}
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-[#16302B] text-white p-4">
        <p className="text-xs uppercase tracking-wide text-white/50 font-semibold mb-2">Today's snapshot</p>
        <div className="flex justify-between text-sm mb-1.5"><span>Hydration</span><span className="font-semibold">{Math.round((st.water / GOALS.water) * 100)}%</span></div>
        <div className="flex justify-between text-sm"><span>Adherence streak</span><span className="font-semibold">{st.streak} days</span></div>
      </div>
    </div>
  );
}

// ==========================================================================
// Error banner copy — centralized so every consumer matches exactly.
// Falls back to the backend-provided message when available.
// ==========================================================================
const coachErrorMessage = (error) => {
  const serverMsg = typeof error?.message === 'string' ? error.message.trim() : '';
  switch (error?.code) {
    case 'OFFLINE':
      return 'You are offline. Reconnect to chat with Aura.';
    case 'NETWORK_ERROR':
      return serverMsg || 'Network issue. Please check your connection and try again.';
    case 'RATE_LIMITED':
      return serverMsg || 'Aura is busy. Please wait a moment before sending another message.';
    case 'TIMEOUT':
      return serverMsg || 'Aura is taking longer than expected. Please try again.';
    case 'UNAUTHORIZED':
      return serverMsg || 'Your session expired. Please sign in again to continue.';
    case 'CANCELLED':
      // Cancellation is expected behaviour (user navigated away / sent next
      // message before previous completed). Do not show an error banner for it.
      return '';
    default:
      return serverMsg || "I'm having trouble reaching my AI services right now. Please try again in a moment.";
  }
};

const makeMessageId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const readSessionMessages = (storageKey) => {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSessionMessages = (storageKey, messages) => {
  try {
    const serialized = JSON.stringify(messages);
    if (serialized.length > COACH.MAX_SESSION_CHARS) {
      // Keep only the most recent half of chat history when storage gets
      // large. Avoids blowing up sessionStorage quota on long conversations.
      const trimmed = messages.slice(Math.max(0, Math.floor(messages.length / 2)));
      sessionStorage.setItem(storageKey, JSON.stringify(trimmed));
      return;
    }
    sessionStorage.setItem(storageKey, serialized);
  } catch {
    /* sessionStorage disabled — chat continues working purely in memory */
  }
};

const welcomeCacheKeyFor = (userId) =>
  `${COACH.WELCOME_CACHE_PREFIX}-${userId || 'guest'}-${getLocalDate()}`;

const readCachedWelcome = (userId) => {
  try {
    const value = localStorage.getItem(welcomeCacheKeyFor(userId));
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
};

const writeCachedWelcome = (userId, text) => {
  try {
    localStorage.setItem(welcomeCacheKeyFor(userId), text);
  } catch {
    /* localStorage disabled or full — skip cache write only */
  }
};

// ==========================================================================
// Coach Tab — PRODUCTION-GRADE REWRITE (same exact visual UI as before).
// ==========================================================================
function Coach({ userId }) {
  const storageKey = `${COACH.SESSION_STORAGE_KEY}-${userId || 'guest'}`;

  const [messages, setMessages] = useState(() => readSessionMessages(storageKey));
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState('');

  const scrollRef = useRef(null);
  const pendingRequestRef = useRef(null);
  const inFlightAbortRef = useRef(null);
  const isMountedRef = useRef(false);
  const welcomeRequestSeq = useRef(0);

  // Autoscroll on messages / typing state change. useLayoutEffect runs
  // before the paint so we never flash a scrolled-up position to the user.
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  // Mount/unmount + StrictMode double-mount guard. The cleanup aborts any
  // request that is still in flight so quota is not wasted on an invisible
  // tab's response.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const controller = inFlightAbortRef.current;
      if (controller) {
        try { controller.abort(); } catch { /* ignore */ }
        inFlightAbortRef.current = null;
      }
      pendingRequestRef.current = null;
    };
  }, []);

  // Persist conversation messages for the session.
  useEffect(() => {
    writeSessionMessages(storageKey, messages);
  }, [messages, storageKey]);

  // Clear the error banner silently when the user starts typing. The goal
  // is to avoid forcing an explicit "dismiss" click without changing UI.
  useEffect(() => {
    if (chatError && input.trim()) {
      setChatError('');
    }
  }, [input, chatError]);

  /**
   * Build the message string sent to the AI service. We deliberately keep
   * the header explicit so the model never tries to regurgitate the history
   * verbatim to the user. Short conversations (just a starter click) are
   * sent without the history wrapper for cleaner intent detection and
   * fewer input tokens wasted.
   */
  const buildChatPayload = useCallback((currentMessages, userMessage) => {
    const recent = currentMessages.slice(-COACH.MAX_HISTORY_MESSAGES);
    if (recent.length === 0) return userMessage;

    const lines = recent.map((msg) => `${msg.s === 'user' ? 'User' : 'Aura'}: ${msg.t}`);
    return [
      '[Recent Conversation History — use for continuity only, do not repeat these lines to the user]',
      ...lines,
      '',
      `User Question: ${userMessage}`,
    ].join('\n');
  }, []);

  /**
   * Shared send handler. Used by the textarea Enter, the Send button, and
   * every starter button.
   *
   * Guarantees:
   *  - Only one in-flight request at a time (previous request is cancelled).
   *  - isTyping === true iff there is an in-flight non-cancelled request.
   *  - On any outcome (success/error/cancel/timeout/unmount) isTyping goes false.
   *  - No stale closure — reads msgs from setMsgs(prev => ...) functional form.
   */
  const sendMessage = useCallback(async (rawMessage) => {
    const trimmedMessage = (rawMessage || '').trim();
    if (!trimmedMessage) return;
    if (isTyping || pendingRequestRef.current) return;

    // Cancel any prior request before we begin. Abort propagates through
    // axios signal, aiService converts CANCELLED and the catch below
    // skips setting an error banner for it.
    const priorAbort = inFlightAbortRef.current;
    if (priorAbort) {
      try { priorAbort.abort(); } catch { /* ignore */ }
    }

    const abortController = new AbortController();
    inFlightAbortRef.current = abortController;
    pendingRequestRef.current = Symbol('in-flight');
    setIsTyping(true);
    setChatError('');

    let responseReply = null;
    let caughtError = null;

    try {
      setMessages((prev) => {
        const nextUserMsg = {
          id: makeMessageId('u'),
          s: 'user',
          t: trimmedMessage,
        };
        return [...prev, nextUserMsg];
      });

      // Build the request from the already-rendered conversation. A React
      // state updater is deferred, so it cannot be used as a synchronous
      // mechanism for assigning the payload.
      const payload = buildChatPayload(messages, trimmedMessage);

      const data = await aiService.chat(payload, {
        signal: abortController.signal,
        contextId: 'coach-send',
        allowRetry: true,
      });

      if (typeof data?.reply !== 'string' || !data.reply.trim()) {
        throw new Error('Invalid AI response');
      }
      responseReply = data.reply.trim();
    } catch (error) {
      caughtError = error;
    } finally {
      const controller = inFlightAbortRef.current;
      if (controller === abortController) {
        inFlightAbortRef.current = null;
      }
      pendingRequestRef.current = null;
      if (isMountedRef.current) {
        setIsTyping(false);
      }
    }

    // Commit outcome outside finally so cancelled flows do not touch state.
    if (!isMountedRef.current || abortController.signal.aborted) return;

    if (responseReply) {
      setMessages((prev) => [
        ...prev,
        { id: makeMessageId('a'), s: 'aura', t: responseReply },
      ]);
    } else if (caughtError) {
      const msg = coachErrorMessage(caughtError);
      if (msg) setChatError(msg);
    }
  }, [buildChatPayload, isTyping, messages]);

  // Load welcome — per calendar day, per user, cached to localStorage so
  // repeated tab visits (and StrictMode double-mount) cost 0 API calls.
  useEffect(() => {
    let cancelled = false;
    const seq = ++welcomeRequestSeq.current;

    const run = async () => {
      const cached = readCachedWelcome(userId);
      if (cached) {
        // Only apply cached welcome on first mount (empty session). If the
        // user already has session history, preserve it as-is.
        setMessages((prev) => {
          if (prev.length > 0) return prev;
          return [{ id: makeMessageId('a'), s: 'aura', t: cached }];
        });
        return;
      }

      setIsTyping(true);

      const abortController = new AbortController();
      inFlightAbortRef.current = abortController;

      try {
        const localHour = new Date().getHours();
        const data = await aiService.chat(
          `Generate today's personalized welcome message. (Time of day context: local hour is ${localHour})`,
          {
            signal: abortController.signal,
            contextId: 'coach-welcome',
            allowRetry: true,
          }
        );

        if (cancelled || seq !== welcomeRequestSeq.current) return;
        if (typeof data?.reply !== 'string' || !data.reply.trim()) {
          throw new Error('Invalid welcome response');
        }

        const trimmed = data.reply.trim();
        writeCachedWelcome(userId, trimmed);

        setMessages((prev) => {
          if (prev.length > 0) return prev;
          return [{ id: makeMessageId('a'), s: 'aura', t: trimmed }];
        });
      } catch (error) {
        if (cancelled || seq !== welcomeRequestSeq.current) return;
        const msg = coachErrorMessage(error);
        if (msg) setChatError(msg);
      } finally {
        if (!cancelled && seq === welcomeRequestSeq.current) {
          setIsTyping(false);
          if (inFlightAbortRef.current === abortController) {
            inFlightAbortRef.current = null;
          }
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      if (inFlightAbortRef.current) {
        try { inFlightAbortRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, [userId]);

  const send = (event) => {
    event.preventDefault();
    sendMessage(input);
    setInput('');
  };

  const Avatar = () => (
    <div className="relative w-7 h-7 shrink-0">
      <div className="aura-glow absolute inset-0 rounded-full" />
      <div className="absolute inset-[2px] rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-[#14543F]">A</div>
    </div>
  );

  const starters = useMemo(() => [
    "Summarize my wellness progress today 📊",
    "I'm feeling a bit tired or sluggish today 🥱",
    "How can I build better hydration habits? 💧",
    "I missed a medicine dosage, what should I do? 💊",
  ], []);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 chat-box">
        {messages.map((message) => (
          <div key={message.id} className={`flex items-end gap-2 ${message.s === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.s === 'aura' && <Avatar />}
            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${message.s === 'user' ? 'bg-[#16302B] text-white rounded-br-sm' : 'bg-white border border-black/5 rounded-bl-sm shadow-sm'}`}>
              <MarkdownText content={message.t} />
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2">
            <Avatar />
            <div className="bg-white border border-black/5 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-[#16302B]/40">Aura is typing…</div>
          </div>
        )}
        {chatError && <p className="text-sm text-[#F0784A]">{chatError}</p>}
        {messages.length === 0 && !isTyping && (
          <div className="space-y-2 mt-4">
            <p className="text-[10px] font-bold text-[#16302B]/45 uppercase tracking-wider">Conversation Starters</p>
            <div className="flex flex-col gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  onClick={() => sendMessage(starter)}
                  className="tap text-left text-xs bg-white border border-black/5 rounded-xl p-3 shadow-sm hover:border-[#1F7A63]/30 transition-colors text-[#16302B]"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <form onSubmit={send} className="flex gap-2 px-5 py-4 border-t border-black/5 bg-[#F6F8F3]">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows="1"
          placeholder="Ask Aura…"
          className="flex-1 resize-none rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
        />
        <button
          disabled={isTyping || !input.trim()}
          className="tap rounded-full bg-[#16302B] text-white px-5 text-sm font-semibold disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ==========================================================================
// Insights Tab — UI preserved. adherence calculation moved to a single
// useMemo to avoid recomputing every render.
// ==========================================================================
function Insights({ st }) {
  const allMeds = st.meds.length > 0 && st.meds.every((medicine) => medicine.taken);
  const h2o = st.insights.water;
  const ad = st.insights.adherence;
  const mx = useMemo(() => Math.max(...h2o, GOALS.water), [h2o]);
  const adherence = useMemo(() => {
    const total = ad.length;
    if (!total) return 0;
    return Math.round((ad.reduce((acc, v) => acc + v, 0) / total) * 100);
  }, [ad]);
  const msg =
    st.water < GOALS.water / 2 && new Date().getHours() >= 15
      ? "You're behind on water. A glass now keeps the streak alive."
      : !allMeds
      ? 'Medicine is still pending — log it to keep your adherence streak alive.'
      : 'Your hydration dips on Saturdays. Want an earlier reminder?';

  return (
    <div className="px-5 pb-8">
      <h2 className="font-display text-xl italic mt-5">Your week at a glance</h2>
      <div className="mt-5 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <p className="text-sm font-bold">Hydration</p><p className="text-xs text-[#16302B]/50 mb-4">Glasses per day</p>
        <div className="flex items-end justify-between h-28 gap-2">
          {h2o.map((value, index) => (
            <div key={st.insights.days[index]} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="w-full h-full rounded-full bg-[#DCEEE7] relative overflow-hidden">
                <div
                  className="absolute bottom-0 inset-x-0 rounded-full"
                  style={{ height: `${mx > 0 ? (value / mx) * 100 : 0}%`, background: 'linear-gradient(180deg, #E8B84B, #1F7A63)' }}
                />
              </div>
              <span className="text-[10px] text-[#16302B]/50">{st.insights.days[index]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <p className="text-sm font-bold">Medicine adherence</p><p className="text-xs text-[#16302B]/50 mb-4">{adherence}% this week</p>
        <div className="flex justify-between">
          {ad.map((taken, index) => (
            <div key={st.insights.days[index]} className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${taken ? 'bg-[#1F7A63] text-white' : 'bg-[#F0784A]/15 text-[#F0784A]'}`}>
                {taken ? '✓' : '·'}
              </div>
              <span className="text-[10px] text-[#16302B]/50">{st.insights.days[index]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-[#16302B] text-white p-4">
        <p className="text-xs uppercase text-white/50 font-semibold mb-2">Aura noticed</p>
        <p className="text-sm">{msg}</p>
      </div>
    </div>
  );
}

// ==========================================================================
// Root App. auth gate + tab shell preserved verbatim. Only the dashboard
// refresh was hardened to avoid stale-write race conditions.
// ==========================================================================
export default function App() {
  const { user, token, isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState('today');
  const [st, setSt] = useState(EMPTY_STATE);
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useNotifications({
      user,
      water: st.water,
      medicines: st.meds,
      ready: Boolean(token && user && st.loaded),
    });

  // Guards against the classic "N concurrent dashboard refreshes, last-wins"
  // bug. Every call bumps this counter; only the matching response commits.
  const dashboardRefreshSeqRef = useRef(0);
  const lastAuthenticatedUserIdRef = useRef(null);

  const refreshDashboard = useCallback(async () => {
    if (!user || !token) return;
    const thisCallSeq = ++dashboardRefreshSeqRef.current;
    try {
      const [medicinesData, todayLogsData, todayWaterData, waterHistoryData, medicineHistoryData] =
        await Promise.all([
          medicineService.getMedicines(),
          medicineLogService.getTodayMedicineLogs(),
          waterService.getTodayWaterLogs(),
          waterService.getWaterHistory(),
          medicineLogService.getMedicineHistory(),
        ]);

      if (thisCallSeq !== dashboardRefreshSeqRef.current) {
        // A newer refresh was dispatched while we were waiting for responses.
        // Discard our stale snapshot to avoid flashing old data.
        return;
      }

      const todayLogs = todayLogsData.medicineLogs || [];
      const meds = (medicinesData.medicines || []).map((medicine) => {
        const log = todayLogs.find(
          (medicineLog) => String(getLogMedicineId(medicineLog)) === String(medicine._id)
        );
        return {
          id: medicine._id,
          name: medicine.medicineName,
          time: medicine.reminderTimes?.[0] || 'Anytime',
          taken: log?.status === 'Taken',
          logId: log?._id,
        };
      });

      setSt((previous) => ({
        ...previous,
        water: Math.round((todayWaterData.totalWater || 0) / WATER_GLASS_ML),
        meds,
        loaded: true,
        // TODO: The current backend does not expose a meals or streak endpoint.
        insights: buildInsights(
          waterHistoryData.waterLogs || [],
          medicineHistoryData.medicineLogs || []
        ),
      }));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }, [token, user]);

  useEffect(() => {
    if (loading || !user || !token || !isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await refreshDashboard();
      } catch (error) {
        if (!cancelled) console.error('Failed to load dashboard data:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, loading, refreshDashboard, token, user]);

  useEffect(() => {
    if (isAuthenticated) {
      lastAuthenticatedUserIdRef.current = user?._id || null;
      return;
    }

    const previousUserId = lastAuthenticatedUserIdRef.current;
    if (previousUserId) {
      try {
        sessionStorage.removeItem(`${COACH.SESSION_STORAGE_KEY}-${previousUserId}`);
      } catch {
        /* Storage disabled — the unmounted Coach still clears in memory. */
      }
      lastAuthenticatedUserIdRef.current = null;
    }

    dashboardRefreshSeqRef.current += 1;
    setSt(EMPTY_STATE);
    setShowNotifications(false);
  }, [isAuthenticated, user]);

  const handleQuickLog = async (key) => {
    if (key === 'meals') {
      // TODO: The current backend does not provide a meal logging endpoint.
      setSt((previous) => ({
        ...previous,
        meals: Math.min(previous.meals + 1, GOALS.meals),
      }));
      return;
    }

    try {
      await waterService.addWaterLog({ amount: WATER_GLASS_ML });
      await refreshDashboard();
    } catch (error) {
      console.error('Failed to log water:', error);
    }
  };

  const handleAddMedicine = async (medicineName, reminderTime) => {
    try {
      await medicineService.addMedicine({
        medicineName,
        dosage: 'Not specified',
        frequency: 'Once Daily',
        reminderTimes: [reminderTime],
        startDate: new Date().toISOString(),
      });
      await refreshDashboard();
    } catch (error) {
      console.error('Failed to add medicine:', error);
    }
  };

  const handleToggleMedicine = async (medicine) => {
    try {
      if (medicine.logId) {
        if (medicine.taken) {
          await medicineLogService.markMedicineSkipped(medicine.logId);
        } else {
          await medicineLogService.markMedicineTaken(medicine.logId);
        }
      } else {
        const createdLog = await medicineLogService.createMedicineLog({
          medicineId: medicine.id,
          scheduledTime: toTwentyFourHourTime(medicine.time),
          scheduledDate: new Date().toISOString(),
        });
        await medicineLogService.markMedicineTaken(createdLog.medicineLog._id);
      }
      await refreshDashboard();
    } catch (error) {
      console.error('Failed to update medicine log:', error);
    }
  };

  if (loading) {
    return <div className="max-w-md mx-auto min-h-screen bg-[#F6F8F3] shadow-2xl" />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="relative max-w-md mx-auto min-h-screen bg-[#F6F8F3] shadow-2xl flex flex-col">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="aura" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1F7A63" />
            <stop offset="55%" stopColor="#E8B84B" />
            <stop offset="100%" stopColor="#F0784A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex items-center gap-2 px-5 pt-5">
        <div className="relative w-6 h-6">
          <div className="aura-glow absolute inset-0 rounded-full" />
          <div className="absolute inset-[2px] rounded-full bg-[#F6F8F3]" />
        </div>
        <span className="font-display italic text-sm tracking-wide">Aura Health</span>
        <div className="relative ml-auto">
          <button
            onClick={() => setShowNotifications((show) => !show)}
            aria-label="Open Aura notifications"
            aria-expanded={showNotifications}
            className="tap relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 text-[#14543F]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#F0784A] px-1 text-center text-[9px] font-bold leading-4 text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <NotificationPanel
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onClearAll={clearAll}
            />
          )}
        </div>
      </div>
      <div className="flex bg-[#DCEEE7] rounded-full p-1 mx-5 mt-4">
        {['today', 'coach', 'insights', 'circle'].map((currentTab) => (
          <button
            key={currentTab}
            onClick={() => setTab(currentTab)}
            className={`tap flex-1 py-2 rounded-full text-xs font-bold capitalize transition-colors ${tab === currentTab ? 'bg-white text-[#14543F] shadow-sm' : 'text-[#14543F]/60'}`}
          >
            {currentTab === 'circle' ? 'Care Circle' : currentTab}
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden mt-1">
        {tab === 'today' && (
          <Today
            st={st}
            onAddMedicine={handleAddMedicine}
            onQuickLog={handleQuickLog}
            onToggleMedicine={handleToggleMedicine}
            user={user}
          />
        )}
        {tab === 'coach' && <Coach userId={user?._id} />}
        {tab === 'insights' && <Insights st={st} />}
        {tab === 'circle' && <CareCircle />}
      </div>
    </div>
  );
}
