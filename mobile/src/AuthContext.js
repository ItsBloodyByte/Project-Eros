import React, { createContext, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = async () => {
    try { const { data } = await api.get("/me"); setUser(data); return data; }
    catch { return null; }
  };

  useEffect(() => {
    (async () => {
      const tok = await loadToken();
      if (tok) {
        try { const { data } = await api.get("/me"); setUser(data); } catch {}
      }
      setReady(true);
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    await setToken(data.access_token);
    const { data: me } = await api.get("/me");
    setUser(me);
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    await setToken(data.access_token);
    const { data: me } = await api.get("/me");
    setUser(me);
  };

  const logout = async () => { await setToken(null); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, ready, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }
