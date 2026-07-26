import api from './api.js';

const register = async (credentials) => {
  const { data } = await api.post('/auth/register', credentials);
  return data;
};

const login = async (credentials) => {
  const { data } = await api.post('/auth/login', credentials);
  return data;
};

export default { register, login };
