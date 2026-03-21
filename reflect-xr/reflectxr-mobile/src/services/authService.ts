import api from './api';

export const login = async (email: string, password: string) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
};

export const register = async (email: string, password: string, displayName: string) => {
  const res = await api.post('/auth/register', { email, password, display_name: displayName });
  return res.data;
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};
