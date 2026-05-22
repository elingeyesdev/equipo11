import axios from 'axios';
import { clearSession } from '../utils/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const httpClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

httpClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

httpClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearSession();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default httpClient;
