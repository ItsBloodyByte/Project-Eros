import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { useTheme } from "./lib/theme";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import DiscoverPage from "./pages/DiscoverPage";
import ProfileViewPage from "./pages/ProfileViewPage";
import MyProfilePage from "./pages/MyProfilePage";
import MatchesPage from "./pages/MatchesPage";
import ChatPage from "./pages/ChatPage";
import AlbumsPage from "./pages/AlbumsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import AccountPage from "./pages/AccountPage";
import EventsPage from "./pages/EventsPage";
import "./App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
      <Route path="/" element={<Protected><DiscoverPage /></Protected>} />
      <Route path="/profile/:id" element={<Protected><ProfileViewPage /></Protected>} />
      <Route path="/me" element={<Protected><MyProfilePage /></Protected>} />
      <Route path="/matches" element={<Protected><MatchesPage /></Protected>} />
      <Route path="/chat/:matchId" element={<Protected><ChatPage /></Protected>} />
      <Route path="/albums" element={<Protected><AlbumsPage /></Protected>} />
      <Route path="/events" element={<Protected><EventsPage /></Protected>} />
      <Route path="/account" element={<Protected><AccountPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ThemedApp() {
  useTheme();
  return <AppRoutes />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemedApp />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
