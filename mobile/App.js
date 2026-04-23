import React, { useEffect } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import * as ScreenCapture from "expo-screen-capture";
import { Text } from "react-native";
import "./src/i18n";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import DiscoverScreen from "./src/screens/DiscoverScreen";
import MatchesScreen from "./src/screens/MatchesScreen";
import AccountScreen from "./src/screens/AccountScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ChatScreen from "./src/screens/ChatScreen";
import AlbumsScreen from "./src/screens/AlbumsScreen";
import AlbumDetailScreen from "./src/screens/AlbumDetailScreen";
import EventsScreen from "./src/screens/EventsScreen";
import EventDetailScreen from "./src/screens/EventDetailScreen";
import BlogScreen from "./src/screens/BlogScreen";
import BlogPostScreen from "./src/screens/BlogPostScreen";
import VisitorsScreen from "./src/screens/VisitorsScreen";
import MenuScreen from "./src/screens/MenuScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import PersonaBScreen from "./src/screens/PersonaBScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import VideosScreen from "./src/screens/VideosScreen";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { colors } from "./src/theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.card,
    primary: colors.accent,
    notification: colors.accent,
  },
};

const tabIcon = (label) => ({ color }) => (
  <Text style={{ color, fontSize: 10, letterSpacing: 1, fontWeight: "700" }}>{label}</Text>
);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.card },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
      }}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ tabBarIcon: tabIcon("ENTDECKEN"), title: "Eros · Discover" }} />
      <Tab.Screen name="Matches" component={MatchesScreen} options={{ tabBarIcon: tabIcon("MATCHES") }} />
      <Tab.Screen name="Events" component={EventsScreen} options={{ tabBarIcon: tabIcon("EVENTS") }} />
      <Tab.Screen name="Menu" component={MenuScreen} options={{ tabBarIcon: tabIcon("MEHR"), title: "Mehr" }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarIcon: tabIcon("KONTO") }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, ready } = useAuth();
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => { ScreenCapture.allowScreenCaptureAsync().catch(() => {}); };
  }, []);
  if (!ready) return null;
  return (
    <NavigationContainer theme={NavTheme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Registrieren" }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profil" }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Chat" }} />
            <Stack.Screen name="Albums" component={AlbumsScreen} options={{ title: "Alben" }} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} options={({ route }) => ({ title: route.params?.title || "Album" })} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={({ route }) => ({ title: route.params?.title || "Event" })} />
            <Stack.Screen name="Blog" component={BlogScreen} options={{ title: "Blog" }} />
            <Stack.Screen name="BlogPost" component={BlogPostScreen} options={({ route }) => ({ title: route.params?.title || "Beitrag" })} />
            <Stack.Screen name="Visitors" component={VisitorsScreen} options={{ title: "Besucher:innen" }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Profil bearbeiten" }} />
            <Stack.Screen name="PersonaB" component={PersonaBScreen} options={{ title: "Person B" }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Einstellungen" }} />
            <Stack.Screen name="Videos" component={VideosScreen} options={{ title: "Meine Videos" }} />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
