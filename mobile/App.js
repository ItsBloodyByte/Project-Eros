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
  <Text style={{ color, fontSize: 11, letterSpacing: 1, fontWeight: "700" }}>{label}</Text>
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
