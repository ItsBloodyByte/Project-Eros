import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import de from "../../frontend/src/i18n/de.json";
import en from "../../frontend/src/i18n/en.json";

const fallback = "de";
const deviceLang = Localization.getLocales()[0]?.languageCode || fallback;
const initial = ["de", "en"].includes(deviceLang) ? deviceLang : fallback;

i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: initial,
  fallbackLng: fallback,
  interpolation: { escapeValue: false },
});
export default i18n;
