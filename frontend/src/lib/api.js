import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL || "";

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 60000,
});

// Auto-attach persisted token at module init so requests during app boot carry auth.
const BOOT_TOKEN = typeof window !== "undefined" ? window.localStorage.getItem("eros_token") : null;
if (BOOT_TOKEN) {
  api.defaults.headers.common["Authorization"] = `Bearer ${BOOT_TOKEN}`;
}

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("eros_token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("eros_token");
  }
}

export function getStoredToken() {
  return localStorage.getItem("eros_token");
}

// Global 401 handler: clear stale token and redirect to /login (once).
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem("eros_token");
        delete api.defaults.headers.common["Authorization"];
      } catch (e) {}
      if (typeof window !== "undefined" && !/^\/(login|register)/.test(window.location.pathname)) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export function wsChatUrl(matchId, token) {
  const base = BASE.replace(/^http/, "ws");
  return `${base}/api/ws/chat/${matchId}?token=${encodeURIComponent(token)}`;
}
