import api from './api.js';

const chat = async (message) => {
  const { data } = await api.post('/ai/chat', { message });
  return data;
};

export default { chat };
