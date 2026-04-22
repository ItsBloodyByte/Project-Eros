import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL || "";

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 60000,
});

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

export function wsChatUrl(matchId, token) {
  const base = BASE.replace(/^http/, "ws");
  return `${base}/api/ws/chat/${matchId}?token=${encodeURIComponent(token)}`;
}
