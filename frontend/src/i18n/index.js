import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import de from "./de.json";
import en from "./en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    // German is the primary language; fall back to German explicitly.
    lng: typeof window !== "undefined" ? (window.localStorage.getItem("eros_lang") || "de") : "de",
    fallbackLng: "de",
    supportedLngs: ["de", "en"],
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "eros_lang",
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
