import { useEffect, useState } from 'react';
import careCircleService from '../services/careCircleService.js';

export default function CareCircle() {
  const [contacts, setContacts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Family Member');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [missedMeds, setMissedMeds] = useState(true);
  const [dailyComplete, setDailyComplete] = useState(false);
  const [weeklySum, setWeeklySum] = useState(false);
  const [emergencyAlerts, setEmergencyAlerts] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [contactsData, logsData] = await Promise.all([
        careCircleService.getContacts(),
        careCircleService.getNotificationLogs(),
      ]);
      setContacts(contactsData.contacts || []);
      setLogs(logsData.logs || []);
    } catch (error) {
      console.error('Failed to load Care Circle data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [contactsData, logsData] = await Promise.all([
          careCircleService.getContacts(),
          careCircleService.getNotificationLogs(),
        ]);
        if (active) {
          setContacts(contactsData.contacts || []);
          setLogs(logsData.logs || []);
        }
      } catch (error) {
        console.error('Failed to load Care Circle data:', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, []);

  const resetForm = () => {
    setName('');
    setRelationship('Family Member');
    setEmail('');
    setPhone('');
    setMissedMeds(true);
    setDailyComplete(false);
    setWeeklySum(false);
    setEmergencyAlerts(false);
    setEditingId(null);
    setErrorMsg('');
  };

  const handleSaveContact = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setErrorMsg('Please provide at least an email or phone number.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const contactPayload = {
        name: name.trim(),
        relationship,
        email: email.trim(),
        phone: phone.trim(),
        sharingSettings: {
          missedMedicines: missedMeds,
          dailyCompletion: dailyComplete,
          weeklySummary: weeklySum,
          emergencyAlerts: emergencyAlerts,
        },
      };

      if (editingId) {
        await careCircleService.updateContact(editingId, contactPayload);
        setSuccessMsg('Contact updated successfully!');
      } else {
        await careCircleService.createContact(contactPayload);
        setSuccessMsg('Contact added to Care Circle!');
      }

      resetForm();
      setShowAddForm(false);
      await loadData();

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Error saving contact.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (contact) => {
    setEditingId(contact._id);
    setName(contact.name);
    setRelationship(contact.relationship);
    setEmail(contact.email || '');
    setPhone(contact.phone || '');
    setMissedMeds(contact.sharingSettings?.missedMedicines ?? true);
    setDailyComplete(contact.sharingSettings?.dailyCompletion ?? false);
    setWeeklySum(contact.sharingSettings?.weeklySummary ?? false);
    setEmergencyAlerts(contact.sharingSettings?.emergencyAlerts ?? false);
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this contact from your Care Circle?')) return;
    try {
      await careCircleService.deleteContact(id);
      setSuccessMsg('Contact removed successfully.');
      loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Failed to delete contact.');
    }
  };

  const handleRunSimulation = async () => {
    try {
      setSubmitting(true);
      setSuccessMsg('Reminder simulation running...');
      const data = await careCircleService.simulateReminderFlow();
      setLogs((prev) => [...data.logs, ...prev]);
      setSuccessMsg('Missed medicine reminder simulation complete!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Failed to run simulation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await careCircleService.clearNotificationLogs();
      setLogs([]);
      setSuccessMsg('Simulated history cleared.');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch {
      setErrorMsg('Failed to clear logs.');
    }
  };

  return (
    <div className="px-5 pb-8 overflow-y-auto h-full space-y-6">
      {/* Title block */}
      <div className="mt-5">
        <p className="text-sm text-[#16302B]/60">Trusted Support,</p>
        <h1 className="font-display text-2xl italic -mt-0.5">Care Circle</h1>
        <p className="text-xs text-[#16302B]/75 mt-1 leading-relaxed">
          Share your wellness achievements and safety status with trusted contacts. Maintain complete control over what you share and opt out at any time.
        </p>
      </div>

      {successMsg && (
        <div className="bg-[#1F7A63]/10 border border-[#1F7A63]/30 text-[#14543F] text-xs px-3.5 py-2.5 rounded-xl font-medium animate-pulse">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-[#F0784A]/10 border border-[#F0784A]/30 text-[#F0784A] text-xs px-3.5 py-2.5 rounded-xl font-medium">
          {errorMsg}
        </div>
      )}

      {/* Main Form Toggle or List */}
      {!showAddForm ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#16302B]/50">Trusted Contacts</h2>
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="tap text-xs font-bold text-[#1F7A63] hover:text-[#14543F]"
            >
              + Add Contact
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-[#16302B]/40 py-4 text-center">Loading Care Circle contacts...</p>
          ) : contacts.length === 0 ? (
            <div className="bg-white border border-black/5 rounded-2xl p-5 text-center shadow-sm">
              <span className="text-2xl">👥</span>
              <p className="text-sm font-semibold mt-2 text-[#16302B]">Your Care Circle is empty</p>
              <p className="text-xs text-[#16302B]/50 mt-1">Add family members, spouses, or caregivers to share alerts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact._id} className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 flex flex-col gap-3.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#16302B]">{contact.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCEEE7] text-[#14543F] capitalize">
                          {contact.relationship}
                        </span>
                      </div>
                      <div className="text-xs text-[#16302B]/60 mt-1 space-y-0.5">
                        {contact.email && <p>📧 {contact.email}</p>}
                        {contact.phone && <p>📱 {contact.phone}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartEdit(contact)}
                        className="tap text-xs font-semibold text-[#1F7A63] bg-[#DCEEE7]/50 hover:bg-[#DCEEE7] px-2.5 py-1 rounded-lg"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(contact._id)}
                        className="tap text-xs font-semibold text-[#F0784A] bg-[#F0784A]/10 hover:bg-[#F0784A]/25 px-2.5 py-1 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-black/5 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#16302B]/40 mb-1.5">Sharing preferences</p>
                    <div className="flex flex-wrap gap-1.5">
                      {contact.sharingSettings?.missedMedicines && (
                        <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                          💊 Reminders
                        </span>
                      )}
                      {contact.sharingSettings?.dailyCompletion && (
                        <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                          💧 Daily Goals
                        </span>
                      )}
                      {contact.sharingSettings?.weeklySummary && (
                        <span className="text-[10px] bg-sky-50 border border-sky-200 text-sky-800 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                          📊 Weekly Stats
                        </span>
                      )}
                      {contact.sharingSettings?.emergencyAlerts && (
                        <span className="text-[10px] bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                          🚨 Emergencies
                        </span>
                      )}
                      {!contact.optIn && (
                        <span className="text-[10px] bg-gray-50 border border-gray-200 text-gray-400 px-2 py-0.5 rounded-md font-medium">
                          🚫 Sharing Paused (Opted Out)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSaveContact} className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 space-y-4">
          <h2 className="text-sm font-bold text-[#16302B]">{editingId ? 'Edit Contact' : 'Add Care Circle Contact'}</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#16302B]/75 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#16302B]/75 mb-1">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
              >
                <option value="Family Member">Family Member</option>
                <option value="Spouse">Spouse</option>
                <option value="Partner">Partner</option>
                <option value="Parent">Parent</option>
                <option value="Caregiver">Caregiver</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-[#16302B]/75 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#16302B]/75 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
                />
              </div>
            </div>

            <div className="border-t border-black/5 pt-3 mt-3">
              <label className="block text-xs font-bold text-[#16302B]/75 mb-2">What alerts should Jane receive?</label>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#16302B]/80">
                  <input
                    type="checkbox"
                    checked={missedMeds}
                    onChange={(e) => setMissedMeds(e.target.checked)}
                    className="rounded text-[#1F7A63] focus:ring-[#1F7A63]"
                  />
                  <span>Missed medicine reminders (Escalates if still missed)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#16302B]/80">
                  <input
                    type="checkbox"
                    checked={dailyComplete}
                    onChange={(e) => setDailyComplete(e.target.checked)}
                    className="rounded text-[#1F7A63] focus:ring-[#1F7A63]"
                  />
                  <span>Daily goal completions (Water & medicines logged)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#16302B]/80">
                  <input
                    type="checkbox"
                    checked={weeklySum}
                    onChange={(e) => setWeeklySum(e.target.checked)}
                    className="rounded text-[#1F7A63] focus:ring-[#1F7A63]"
                  />
                  <span>Weekly adherence summaries</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#16302B]/80">
                  <input
                    type="checkbox"
                    checked={emergencyAlerts}
                    onChange={(e) => setEmergencyAlerts(e.target.checked)}
                    className="rounded text-[#1F7A63] focus:ring-[#1F7A63]"
                  />
                  <span className="text-[#F0784A] font-semibold">Emergency Alerts (Immediate notification on coach emergency detection)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="tap flex-1 bg-[#16302B] text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-60"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Contact' : 'Save Contact'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(false);
              }}
              className="tap flex-1 bg-black/5 text-[#16302B]/80 text-xs font-semibold py-2.5 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Hackathon Simulation Panel */}
      <div className="bg-[#DCEEE7] rounded-3xl p-5 border border-[#1F7A63]/25 shadow-sm space-y-4">
        <div>
          <h2 className="font-display text-lg italic text-[#14543F]">Judge Demo Sandbox</h2>
          <p className="text-[11px] text-[#14543F]/80 leading-relaxed mt-0.5">
            Test the 3-step reminder escalation flow immediately. Clicking below will simulate consecutive user missed alerts, then notify your configured contact.
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleRunSimulation}
            disabled={submitting}
            className="tap flex-1 bg-[#1F7A63] text-white text-xs font-bold py-2.5 rounded-xl shadow-sm disabled:opacity-50"
          >
            Run Reminder Simulation
          </button>
          <button
            onClick={handleClearLogs}
            className="tap bg-white border border-[#1F7A63]/30 text-[#14543F] text-xs font-semibold px-4 py-2.5 rounded-xl"
          >
            Clear History
          </button>
        </div>

        {/* History Log */}
        <div className="space-y-2 border-t border-[#1F7A63]/20 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#14543F]/65">Simulated Alerts Dispatch Log</p>
          {logs.length === 0 ? (
            <p className="text-[10px] italic text-[#14543F]/55 py-2">No alerts generated yet. Trigger a simulation or chat with Coach about an emergency!</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2 chat-box pr-1">
              {logs.map((log, index) => (
                <div key={log._id || index} className="bg-white/80 border border-white/40 rounded-xl p-2.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                      log.type === 'Emergency Alert' ? 'bg-rose-100 text-rose-800' :
                      log.type === 'Daily Completion' ? 'bg-emerald-100 text-emerald-800 font-semibold' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {log.type}
                    </span>
                    <span className="text-[#16302B]/40 font-medium">
                      {new Date(log.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[#16302B] font-medium leading-relaxed">{log.message}</p>
                  <div className="text-[9px] text-[#16302B]/50 flex justify-between font-semibold">
                    <span>Recipient: {log.recipientName} ({log.recipientType})</span>
                    <span>{log.channel === 'SMS' ? '📱 SMS' : '📧 Email'}: {log.destination}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
