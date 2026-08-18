
// scuml-frontend/src/utils/api.ts
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // important — sends cookies
});

// Fetch a CSRF token and set it on the axios instance
export async function bootstrapCsrf() {
  const res = await api.get('/api/csrf-token'); // returns { csrfToken }
  api.defaults.headers.common['X-CSRF-Token'] = res.data.csrfToken;
  return res.data.csrfToken;
}

export default api;
