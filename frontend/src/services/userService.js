import api from './api.js';

const getProfile = async () => {
  const { data } = await api.get('/users/profile');
  return data;
};

const updateProfile = async (profile) => {
  const { data } = await api.put('/users/profile', profile);
  return data;
};

export default { getProfile, updateProfile };
