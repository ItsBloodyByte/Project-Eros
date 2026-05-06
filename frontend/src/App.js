import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { useTheme } from "./lib/theme";
import { useLocationHeartbeat } from "./lib/useLocationHeartbeat";
import { BroadcastBanner } from "./components/BroadcastBanner";
import { MobileBottomNav } from "./components/MobileBottomNav";
import "./App.css";

// Eager-loaded pages — these are the user's most likely entry points and
// keeping them in the main bundle avoids a flash of loader on first paint.
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LandingPage from "./pages/LandingPage";
import DiscoverPage from "./pages/DiscoverPage";

// Lazy-loaded pages — split out of the main bundle to keep TTI fast.
// React.lazy + Suspense gives us route-level code splitting; webpack
// emits one chunk per dynamic import.
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const ProfileViewPage = lazy(() => import("./pages/ProfileViewPage"));
const MyProfilePage = lazy(() => import("./pages/MyProfilePage"));
const MatchesPage = lazy(() => import("./pages/MatchesPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const AlbumsPage = lazy(() => import("./pages/AlbumsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const BlogListPage = lazy(() => import("./pages/BlogListPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const PremiumPreviewPage = lazy(() => import("./pages/PremiumPreviewPage"));
const VisitorsPage = lazy(() => import("./pages/VisitorsPage"));
const PaypalReturnPage = lazy(() => import("./pages/PaypalReturnPage"));
const SparksLedgerPage = lazy(() => import("./pages/SparksLedgerPage"));
const TransparentPage = lazy(() => import("./pages/TransparentPage"));
const KlarnaCheckoutPage = lazy(() => import("./pages/KlarnaCheckoutPage"));

/** Reusable fallback while a lazy route is being fetched. Matches the
 *  `Protected` loader so transitions feel consistent. */
function RouteFallback() {
  return (
    <div className="min-h-screen grid place-items-center app-shell-bg">
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
        <span>Lädt…</span>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

/**
 * Root route handler: shows the public LandingPage to guests and redirects
 * authenticated users straight to /discover. While auth state is still
 * resolving we show a small loader to avoid flicker and prevent the landing
 * page from briefly appearing for already-logged-in users.
 */
function HomeOrLanding() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) return <Navigate to="/discover" replace />;
  return <LandingPage />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/legal/:key" element={<LegalPage />} />
        {/* Blog is public (no auth required) */}
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        {/* Premium feature preview – marketing page, no auth required */}
        <Route path="/premium" element={<PremiumPreviewPage />} />
        {/* Public transparency page (Kapitel 15.5) */}
        <Route path="/transparent" element={<TransparentPage />} />
        <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
        {/* Public landing page for guests; authenticated users are redirected
         *  to /discover by HomeOrLanding.
         */}
        <Route path="/" element={<HomeOrLanding />} />
        <Route path="/discover" element={<Protected><DiscoverPage /></Protected>} />
        <Route path="/profile/:id" element={<Protected><ProfileViewPage /></Protected>} />
        <Route path="/me" element={<Protected><MyProfilePage /></Protected>} />
        <Route path="/matches" element={<Protected><MatchesPage /></Protected>} />
        <Route path="/chat/:matchId" element={<Protected><ChatPage /></Protected>} />
        <Route path="/albums" element={<Protected><AlbumsPage /></Protected>} />
        <Route path="/events" element={<Protected><EventsPage /></Protected>} />
        <Route path="/account" element={<Protected><AccountPage /></Protected>} />
        <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
        <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
        <Route path="/visitors" element={<Protected><VisitorsPage /></Protected>} />
        <Route path="/sparks" element={<Protected><SparksLedgerPage /></Protected>} />
        <Route path="/payments/paypal/return" element={<Protected><PaypalReturnPage /></Protected>} />
        <Route path="/payments/paypal/cancel" element={<Protected><PaypalReturnPage /></Protected>} />
        <Route path="/payments/klarna/checkout" element={<Protected><KlarnaCheckoutPage /></Protected>} />
        <Route path="/payments/klarna/return" element={<Protected><KlarnaCheckoutPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function ThemedApp() {
  useTheme();
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
