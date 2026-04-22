import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getStoredToken, setAuthToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/me");
      setUser(data);
      return data;
    } catch (e) {
      setUser(null);
      setAuthToken(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const tok = getStoredToken();
    if (tok) {
      setAuthToken(tok);
      // keep loading=true until /me resolves to avoid flicker
      refresh().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setAuthToken(data.access_token);
    await refresh();
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setAuthToken(data.access_token);
    await refresh();
    return data.user;
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
