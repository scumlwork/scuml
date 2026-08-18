// src/lib/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000",
  withCredentials: true, // ✅ send cookies/session with every request
});

let csrfToken: string | null = null;

// 🔹 Helper: fetch CSRF token from backend
async function fetchCsrfToken() {
  const res = await api.get("/api/csrf-token");
  return res.data.csrfToken as string;
}

// 🔹 Interceptor: attach CSRF token to all requests
api.interceptors.request.use(async (config) => {
  if (!csrfToken) {
    try {
      csrfToken = await fetchCsrfToken();
    } catch (err) {
      console.error("❌ Failed to fetch CSRF token:", err);
    }
  }

  if (csrfToken && config.headers) {
    config.headers["CSRF-Token"] = csrfToken; // ✅ backend expects this
  }

  return config;
});

export default api;
