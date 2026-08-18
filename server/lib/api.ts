// src/lib/api.ts
import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE,
  withCredentials: true, // send cookies with every request
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
