import api from './api.js';

const addWaterLog = async (waterLog) => {
  const { data } = await api.post('/water', waterLog);
  return data;
};

const getTodayWaterLogs = async () => {
  const { data } = await api.get('/water/today');
  return data;
};

const getWaterHistory = async () => {
  const { data } = await api.get('/water/history');
  return data;
};

const deleteWaterLog = async (id) => {
  const { data } = await api.delete(`/water/${id}`);
  return data;
};

export default { addWaterLog, getTodayWaterLogs, getWaterHistory, deleteWaterLog };
