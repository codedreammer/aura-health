import api from './api.js';

const getContacts = async () => {
  const { data } = await api.get('/care-circle');
  return data;
};

const createContact = async (contact) => {
  const { data } = await api.post('/care-circle', contact);
  return data;
};

const updateContact = async (id, contact) => {
  const { data } = await api.put(`/care-circle/${id}`, contact);
  return data;
};

const deleteContact = async (id) => {
  const { data } = await api.delete(`/care-circle/${id}`);
  return data;
};

const getNotificationLogs = async () => {
  const { data } = await api.get('/care-circle/notifications');
  return data;
};

const clearNotificationLogs = async () => {
  const { data } = await api.delete('/care-circle/notifications');
  return data;
};

const simulateReminderFlow = async () => {
  const { data } = await api.post('/care-circle/simulate');
  return data;
};

export default {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  getNotificationLogs,
  clearNotificationLogs,
  simulateReminderFlow,
};
