import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from './hooks/useAuth.js';
import LoginPage from './pages/LoginPage.jsx';
import medicineLogService from './services/medicineLogService.js';
import medicineService from './services/medicineService.js';
import waterService from './services/waterService.js';
import { getLocalDate, toTwentyFourHourTime } from './utils/dateUtils.js';

const GOALS = { water: 8, meals: 3 };
const WATER_GLASS_ML = 250;
const EMPTY_STATE = {
  water: 0,
  meals: 0,
  meds: [],
  streak: 0,
  insights: { water: Array(7).fill(0), adherence: Array(7).fill(0), days: [] },
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

function Today({ st, onAddMedicine, onQuickLog, onToggleMedicine, user }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const hr = new Date().getHours();
  const tkn = st.meds.filter((medicine) => medicine.taken).length;
  const pend = st.meds.find((medicine) => !medicine.taken);

  const add = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;

    await onAddMedicine(name.trim(), time.trim() || 'Anytime');
    setName('');
    setTime('');
    setShow(false);
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
        <div className="flex justify-between mb-1"><h2 className="text-sm font-bold">Today's medicines</h2><button onClick={() => setShow(!show)} className="text-xs font-semibold text-[#1F7A63]">{show ? 'Cancel' : '+ Add'}</button></div>
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

function Coach({ st }) {
  const [msgs, setMsgs] = useState([{ s: 'aura', t: "Hi, I'm Aura. I've been keeping an eye on your week — how are you feeling today?" }]);
  const [input, setInput] = useState('');
  const [typ, setTyp] = useState(false);
  const ref = useRef();

  useEffect(() => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }), [msgs, typ]);

  const send = (event) => {
    event.preventDefault();
    if (!input.trim()) return;
    setMsgs((messages) => [...messages, { s: 'user', t: input }]);
    setInput('');
    setTyp(true);
    setTimeout(() => {
      const pend = st.meds.find((medicine) => !medicine.taken);
      setMsgs((messages) => [...messages, { s: 'aura', t: pend ? `You're at ${st.water}/${GOALS.water} glasses today. ${pend.name} isn't logged yet — want a reminder?` : `Nice — you're at ${st.water}/${GOALS.water} glasses today and meds are logged. Keep it up.` }]);
      setTyp(false);
    }, 900);
  };

  const Avatar = () => <div className="relative w-7 h-7 shrink-0"><div className="aura-glow absolute inset-0 rounded-full"></div><div className="absolute inset-[2px] rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-[#14543F]">A</div></div>;

  return (
    <div className="flex flex-col h-full">
      <div ref={ref} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {msgs.map((message, index) => (
          <div key={index} className={`flex items-end gap-2 ${message.s === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.s === 'aura' && <Avatar />}
            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${message.s === 'user' ? 'bg-[#16302B] text-white rounded-br-sm' : 'bg-white border border-black/5 rounded-bl-sm shadow-sm'}`}>{message.t}</div>
          </div>
        ))}
        {typ && <div className="flex items-center gap-2"><Avatar /><div className="bg-white border border-black/5 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-[#16302B]/40">Aura is typing…</div></div>}
      </div>
      <form onSubmit={send} className="flex gap-2 px-5 py-4 border-t border-black/5 bg-[#F6F8F3]">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Aura…" className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30" />
        <button className="tap rounded-full bg-[#16302B] text-white px-5 text-sm font-semibold">Send</button>
      </form>
    </div>
  );
}

function Insights({ st }) {
  const allMeds = st.meds.length && st.meds.every((medicine) => medicine.taken);
  const h2o = st.insights.water;
  const ad = st.insights.adherence;
  const mx = Math.max(...h2o, GOALS.water);
  const totalLogs = ad.length;
  const adherence = totalLogs ? Math.round((ad.reduce((total, value) => total + value, 0) / totalLogs) * 100) : 0;
  const msg = st.water < GOALS.water / 2 && new Date().getHours() >= 15 ? "You're behind on water. A glass now keeps the streak alive." : !allMeds ? 'Medicine is still pending — log it to keep your adherence streak alive.' : 'Your hydration dips on Saturdays. Want an earlier reminder?';

  return (
    <div className="px-5 pb-8">
      <h2 className="font-display text-xl italic mt-5">Your week at a glance</h2>
      <div className="mt-5 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <p className="text-sm font-bold">Hydration</p><p className="text-xs text-[#16302B]/50 mb-4">Glasses per day</p>
        <div className="flex items-end justify-between h-28 gap-2">
          {h2o.map((value, index) => (
            <div key={st.insights.days[index]} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="w-full h-full rounded-full bg-[#DCEEE7] relative overflow-hidden"><div className="absolute bottom-0 inset-x-0 rounded-full" style={{ height: `${(value / mx) * 100}%`, background: 'linear-gradient(180deg, #E8B84B, #1F7A63)' }} /></div>
              <span className="text-[10px] text-[#16302B]/50">{st.insights.days[index]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <p className="text-sm font-bold">Medicine adherence</p><p className="text-xs text-[#16302B]/50 mb-4">{adherence}% this week</p>
        <div className="flex justify-between">
          {ad.map((taken, index) => (
            <div key={st.insights.days[index]} className="flex flex-col items-center gap-1.5"><div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${taken ? 'bg-[#1F7A63] text-white' : 'bg-[#F0784A]/15 text-[#F0784A]'}`}>{taken ? '✓' : '·'}</div><span className="text-[10px] text-[#16302B]/50">{st.insights.days[index]}</span></div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-[#16302B] text-white p-4"><p className="text-xs uppercase text-white/50 font-semibold mb-2">Aura noticed</p><p className="text-sm">{msg}</p></div>
    </div>
  );
}

export default function App() {
  const { user, isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState('today');
  const [st, setSt] = useState(EMPTY_STATE);

  const refreshDashboard = useCallback(async () => {
    const [medicinesData, todayLogsData, todayWaterData, waterHistoryData, medicineHistoryData] = await Promise.all([
      medicineService.getMedicines(),
      medicineLogService.getTodayMedicineLogs(),
      waterService.getTodayWaterLogs(),
      waterService.getWaterHistory(),
      medicineLogService.getMedicineHistory(),
    ]);

    const todayLogs = todayLogsData.medicineLogs || [];
    const meds = (medicinesData.medicines || []).map((medicine) => {
      const log = todayLogs.find((medicineLog) => String(getLogMedicineId(medicineLog)) === String(medicine._id));
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
      // TODO: The current backend does not expose a meals or streak endpoint.
      insights: buildInsights(waterHistoryData.waterLogs || [], medicineHistoryData.medicineLogs || []),
    }));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    refreshDashboard().catch((error) => {
      console.error('Failed to load dashboard data:', error);
    });
  }, [isAuthenticated, refreshDashboard]);

  const handleQuickLog = async (key) => {
    if (key === 'meals') {
      // TODO: The current backend does not provide a meal logging endpoint.
      setSt((previous) => ({ ...previous, meals: Math.min(previous.meals + 1, GOALS.meals) }));
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
    <div className="max-w-md mx-auto min-h-screen bg-[#F6F8F3] shadow-2xl flex flex-col">
      <svg width="0" height="0" className="absolute" aria-hidden="true"><defs><linearGradient id="aura" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1F7A63" /><stop offset="55%" stopColor="#E8B84B" /><stop offset="100%" stopColor="#F0784A" /></linearGradient></defs></svg>
      <div className="flex items-center gap-2 px-5 pt-5"><div className="relative w-6 h-6"><div className="aura-glow absolute inset-0 rounded-full" /><div className="absolute inset-[2px] rounded-full bg-[#F6F8F3]" /></div><span className="font-display italic text-sm tracking-wide">Aura Health</span></div>
      <div className="flex bg-[#DCEEE7] rounded-full p-1 mx-5 mt-4">
        {['today', 'coach', 'insights'].map((currentTab) => <button key={currentTab} onClick={() => setTab(currentTab)} className={`tap flex-1 py-2 rounded-full text-sm font-semibold capitalize transition-colors ${tab === currentTab ? 'bg-white text-[#14543F] shadow-sm' : 'text-[#14543F]/60'}`}>{currentTab}</button>)}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden mt-1">
        {tab === 'today' && <Today st={st} onAddMedicine={handleAddMedicine} onQuickLog={handleQuickLog} onToggleMedicine={handleToggleMedicine} user={user} />}
        {tab === 'coach' && <Coach st={st} />}
        {tab === 'insights' && <Insights st={st} />}
      </div>
    </div>
  );
}
