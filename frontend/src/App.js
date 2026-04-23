import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { useTheme } from "./lib/theme";
import { installScreenshotDeterrents } from "./lib/screenshotGuard";
import { useLocationHeartbeat } from "./lib/useLocationHeartbeat";
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
import LegalPage from "./pages/LegalPage";
import BlogListPage from "./pages/BlogListPage";
import BlogPostPage from "./pages/BlogPostPage";
import VisitorsPage from "./pages/VisitorsPage";
import { BroadcastBanner } from "./components/BroadcastBanner";
import { MobileBottomNav } from "./components/MobileBottomNav";
import "./App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center app-shell-bg">
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
          <span>Lädt…</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/legal/:key" element={<LegalPage />} />
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
      <Route path="/blog" element={<Protected><BlogListPage /></Protected>} />
      <Route path="/blog/:slug" element={<Protected><BlogPostPage /></Protected>} />
      <Route path="/visitors" element={<Protected><VisitorsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ThemedApp() {
  useTheme();
  useEffect(() => { installScreenshotDeterrents(); }, []);
  useLocationHeartbeat();
  return (
    <>
      <BroadcastBanner />
      <AppRoutes />
      <MobileBottomNav />
    </>
  );
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
