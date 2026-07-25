import { useState, useEffect, useRef } from 'react';

const GOALS = { water: 8, meals: 3 };
const KEY = 'aura-health-state';
const DEFAULTS = [{ id: 'm1', name: 'Vitamin D', time: '8:00 PM', taken: false }, { id: 'm2', name: 'Metformin', time: '8:00 AM', taken: false }];
const PAST = { water: [5, 7, 6, 8, 6, 4], meds: [1, 1, 1, 0, 1, 1], days: ['6d ago', '5d ago', '4d ago', '3d ago', 'Yesterday', 'Last night', 'Today'] };
const getToday = () => new Date().toISOString().slice(0, 10);

const Ring = ({ p, size = 64, stroke = 7, children }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c - Math.min(Math.max(p, 0), 1) * c;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E7EFEA" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#aura)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-600 ease-out" />
      </svg>
      {children}
    </div>
  );
};

function Today({ st, setSt }) {
  const [show, setShow] = useState(false), [name, setName] = useState(''), [time, setTime] = useState('');
  const hr = new Date().getHours(), tkn = st.meds.filter(m => m.taken).length, pend = st.meds.find(m => !m.taken);

  const add = (e) => {
    e.preventDefault();
    if (name.trim()) setSt(s => ({ ...s, meds: [...s.meds, { id: `m${Date.now()}`, name: name.trim(), time: time.trim() || 'Anytime', taken: false }] }));
    setName(''); setTime(''); setShow(false);
  };
  const log = (k, max) => setSt(s => ({ ...s, [k]: Math.min(s[k] + 1, max) }));
  const toggle = (id) => setSt(s => ({ ...s, meds: s.meds.map(m => m.id === id ? { ...m, taken: !m.taken } : m) }));

  return (
    <div className="px-5 pb-8">
      <div className="flex items-center justify-between mt-5">
        <div>
          <p className="text-sm text-[#16302B]/60">Good {hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening'},</p>
          <h1 className="font-display text-2xl italic -mt-0.5">Alex</h1>
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
        {[ { i: '💧', l: 'Water', v: st.water, m: GOALS.water, k: 'water' }, { i: '💊', l: 'Medicine', v: tkn, m: st.meds.length, k: null }, { i: '🍽️', l: 'Meals', v: st.meals, m: GOALS.meals, k: 'meals' }
        ].map(b => (
          <button key={b.l} onClick={() => b.k && log(b.k, b.m)} className={`${b.k ? 'tap' : ''} flex flex-col items-center gap-2 bg-white rounded-2xl p-3 shadow-sm border border-black/5`}>
            <Ring p={b.m ? b.v / b.m : 0} size={52} stroke={5}><span className="text-lg">{b.i}</span></Ring>
            <span className="text-xs font-semibold">{b.l}</span><span className="text-[11px] text-[#16302B]/50">{b.v}/{b.m}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <div className="flex justify-between mb-1"><h2 className="text-sm font-bold">Today's medicines</h2><button onClick={() => setShow(!show)} className="text-xs font-semibold text-[#1F7A63]">{show ? 'Cancel' : '+ Add'}</button></div>
        {show && (
          <form onSubmit={add} className="flex gap-2 mt-3 mb-1">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30" />
            <input value={time} onChange={e => setTime(e.target.value)} placeholder="9:00 AM" className="w-28 rounded-lg border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30" />
            <button className="tap rounded-lg bg-[#16302B] text-white px-3 text-sm font-semibold">Add</button>
          </form>
        )}
        <div className="mt-2 divide-y divide-black/5">
          {st.meds.map(m => (
            <button key={m.id} onClick={() => toggle(m.id)} className="tap w-full flex items-center gap-3 py-2.5 text-left">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${m.taken ? 'bg-[#1F7A63] text-white' : 'border-2 border-black/15 text-transparent'}`}>✓</span>
              <span className={`flex-1 text-sm ${m.taken ? 'line-through text-[#16302B]/40' : ''}`}>{m.name}</span><span className="text-xs text-[#16302B]/40">{m.time}</span>
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
  const [input, setInput] = useState(""), [typ, setTyp] = useState(false), ref = useRef();
  
  useEffect(() => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }), [msgs, typ]);

  const send = (e) => {
    e.preventDefault(); if (!input.trim()) return;
    setMsgs(m => [...m, { s: 'user', t: input }]); setInput(""); setTyp(true);
    setTimeout(() => {
      const pend = st.meds.find(m => !m.taken);
      setMsgs(m => [...m, { s: 'aura', t: pend ? `You're at ${st.water}/${GOALS.water} glasses today. ${pend.name} isn't logged yet — want a reminder?` : `Nice — you're at ${st.water}/${GOALS.water} glasses today and meds are logged. Keep it up.` }]);
      setTyp(false);
    }, 900);
  };

  const Avatar = () => <div className="relative w-7 h-7 shrink-0"><div className="aura-glow absolute inset-0 rounded-full"></div><div className="absolute inset-[2px] rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-[#14543F]">A</div></div>;

  return (
    <div className="flex flex-col h-full">
      <div ref={ref} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.s === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.s === 'aura' && <Avatar />}
            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${m.s === 'user' ? 'bg-[#16302B] text-white rounded-br-sm' : 'bg-white border border-black/5 rounded-bl-sm shadow-sm'}`}>{m.t}</div>
          </div>
        ))}
        {typ && <div className="flex items-center gap-2"><Avatar /><div className="bg-white border border-black/5 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-[#16302B]/40">Aura is typing…</div></div>}
      </div>
      <form onSubmit={send} className="flex gap-2 px-5 py-4 border-t border-black/5 bg-[#F6F8F3]">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Aura…" className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30" />
        <button className="tap rounded-full bg-[#16302B] text-white px-5 text-sm font-semibold">Send</button>
      </form>
    </div>
  );
}

function Insights({ st }) {
  const allMeds = st.meds.length && st.meds.every(m => m.taken), h2o = [...PAST.water, st.water], ad = [...PAST.meds, allMeds ? 1 : 0];
  const mx = Math.max(...h2o, GOALS.water), msg = st.water < GOALS.water/2 && new Date().getHours() >= 15 ? "You're behind on water. A glass now keeps the streak alive." : !allMeds ? "Medicine is still pending — log it to keep your adherence streak alive." : "Your hydration dips on Saturdays. Want an earlier reminder?";

  return (
    <div className="px-5 pb-8">
      <h2 className="font-display text-xl italic mt-5">Your week at a glance</h2>
      <div className="mt-5 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <p className="text-sm font-bold">Hydration</p><p className="text-xs text-[#16302B]/50 mb-4">Glasses per day</p>
        <div className="flex items-end justify-between h-28 gap-2">
          {h2o.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="w-full h-full rounded-full bg-[#DCEEE7] relative overflow-hidden"><div className="absolute bottom-0 inset-x-0 rounded-full" style={{ height: `${(v/mx)*100}%`, background: 'linear-gradient(180deg, #E8B84B, #1F7A63)' }} /></div>
              <span className="text-[10px] text-[#16302B]/50">{PAST.days[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <p className="text-sm font-bold">Medicine adherence</p><p className="text-xs text-[#16302B]/50 mb-4">{Math.round((ad.reduce((a, b) => a+b, 0)/ad.length)*100)}% this week</p>
        <div className="flex justify-between">
          {ad.map((t, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5"><div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${t ? 'bg-[#1F7A63] text-white' : 'bg-[#F0784A]/15 text-[#F0784A]'}`}>{t ? '✓' : '·'}</div><span className="text-[10px] text-[#16302B]/50">{PAST.days[i]}</span></div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-[#16302B] text-white p-4"><p className="text-xs uppercase text-white/50 font-semibold mb-2">Aura noticed</p><p className="text-sm">{msg}</p></div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('today');
  const [st, setSt] = useState({ water: 0, meals: 0, meds: DEFAULTS, streak: 0, hydrated: false });
  
  const userId = 'Alex'; // Hardcoded user prototype for your hackathon
  const todayDate = getToday();

  // 1. FETCH DATA FROM MONGODB ON LOAD
  useEffect(() => {
    fetch(`http://localhost:5000/api/health/${userId}/${todayDate}`)
      .then(res => res.json())
      .then(data => {
        setSt({
          water: data.water ?? 0,
          meals: data.meals ?? 0,
          meds: data.meds?.length ? data.meds : DEFAULTS,
          streak: data.streak ?? 0,
          hydrated: true
        });
      })
      .catch(err => {
        console.error("Failed to load health data:", err);
        setSt(s => ({ ...s, hydrated: true }));
      });
  }, [todayDate]);

  // 2. SAVE DATA TO MONGODB WHENEVER STATE CHANGES
  useEffect(() => {
    if (!st.hydrated) return;

    fetch('http://localhost:5000/api/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        date: todayDate,
        water: st.water,
        meals: st.meals,
        meds: st.meds,
        streak: st.streak
      })
    }).catch(err => console.error("Failed to save health data:", err));
  }, [st, todayDate]);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#F6F8F3] shadow-2xl flex flex-col">
      <svg width="0" height="0" className="absolute" aria-hidden="true"><defs><linearGradient id="aura" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1F7A63" /><stop offset="55%" stopColor="#E8B84B" /><stop offset="100%" stopColor="#F0784A" /></linearGradient></defs></svg>
      <div className="flex items-center gap-2 px-5 pt-5"><div className="relative w-6 h-6"><div className="aura-glow absolute inset-0 rounded-full" /><div className="absolute inset-[2px] rounded-full bg-[#F6F8F3]" /></div><span className="font-display italic text-sm tracking-wide">Aura Health</span></div>
      
      <div className="flex bg-[#DCEEE7] rounded-full p-1 mx-5 mt-4">
        {['today', 'coach', 'insights'].map(t => <button key={t} onClick={() => setTab(t)} className={`tap flex-1 py-2 rounded-full text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-white text-[#14543F] shadow-sm' : 'text-[#14543F]/60'}`}>{t}</button>)}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden mt-1">
        {tab === 'today' && <Today st={st} setSt={setSt} />}
        {tab === 'coach' && <Coach st={st} />}
        {tab === 'insights' && <Insights st={st} />}
      </div>
    </div>
  );
}