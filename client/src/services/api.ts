import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || window.location.origin,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Adicionar token em todas as requisições se existir
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;