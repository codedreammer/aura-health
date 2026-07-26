import api from './api.js';

const addMedicine = async (medicine) => {
  const { data } = await api.post('/medicines', medicine);
  return data;
};

const getMedicines = async () => {
  const { data } = await api.get('/medicines');
  return data;
};

const getMedicineById = async (id) => {
  const { data } = await api.get(`/medicines/${id}`);
  return data;
};

const updateMedicine = async (id, medicine) => {
  const { data } = await api.put(`/medicines/${id}`, medicine);
  return data;
};

const deleteMedicine = async (id) => {
  const { data } = await api.delete(`/medicines/${id}`);
  return data;
};

export default { addMedicine, getMedicines, getMedicineById, updateMedicine, deleteMedicine };
