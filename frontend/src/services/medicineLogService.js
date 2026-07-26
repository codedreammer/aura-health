import api from './api.js';

const createMedicineLog = async (medicineLog) => {
  const { data } = await api.post('/medicine-logs', medicineLog);
  return data;
};

const getTodayMedicineLogs = async () => {
  const { data } = await api.get('/medicine-logs/today');
  return data;
};

const getMedicineHistory = async () => {
  const { data } = await api.get('/medicine-logs/history');
  return data;
};

const markMedicineTaken = async (id) => {
  const { data } = await api.patch(`/medicine-logs/${id}/taken`);
  return data;
};

const markMedicineSkipped = async (id) => {
  const { data } = await api.patch(`/medicine-logs/${id}/skipped`);
  return data;
};

export default {
  createMedicineLog,
  getTodayMedicineLogs,
  getMedicineHistory,
  markMedicineTaken,
  markMedicineSkipped,
};
