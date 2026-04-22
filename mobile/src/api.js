import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const BASE =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.backendUrl ||
  "https://auto-implement-2.preview.emergentagent.com";

export const api = axios.create({ baseURL: `${BASE}/api`, timeout: 60000 });

export async function setToken(tok) {
  if (tok) {
    await AsyncStorage.setItem("eros_token", tok);
    api.defaults.headers.common["Authorization"] = `Bearer ${tok}`;
  } else {
    await AsyncStorage.removeItem("eros_token");
    delete api.defaults.headers.common["Authorization"];
  }
}

export async function loadToken() {
  const t = await AsyncStorage.getItem("eros_token");
  if (t) api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
  return t;
}

export { BASE };
