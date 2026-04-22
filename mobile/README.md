# Eros Mobile (Expo / React Native)

This is a skeleton React Native (Expo) project that reuses the Eros FastAPI backend. It demonstrates login, discovery, profile view and chat in a native-first shell and layers two features that the web cannot offer:

- **Expo Screen Capture blocking** (`expo-screen-capture`) to hard-prevent screenshots on iOS/Android while the app is foregrounded.
- **Expo Localization** with i18next, using the same German/English JSON bundles as the web app.

## Run locally

```bash
cd /app/mobile
npm install
# point to backend (same one the web app uses)
export EXPO_PUBLIC_BACKEND_URL=https://auto-implement-2.preview.emergentagent.com
npx expo start
```

Open the QR code in Expo Go on your phone or in an iOS/Android simulator.

## Status
This is a working skeleton, NOT a feature-complete native port. It proves the backend can be reused as-is from a native client. A full feature parity release (albums, events, admin, premium, video, MFA) is the roadmap item and intentionally out of scope here.

## Files
- `App.js` — navigation + i18n boot + screen-capture blocking
- `src/api.js` — axios client with JWT persistence (AsyncStorage)
- `src/i18n.js` — reuses `../frontend/src/i18n/*.json`
- `src/screens/LoginScreen.js`
- `src/screens/DiscoverScreen.js`
- `src/screens/ProfileScreen.js`
- `src/screens/ChatScreen.js`
