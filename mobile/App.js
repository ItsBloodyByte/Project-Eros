import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import * as ScreenCapture from "expo-screen-capture";
import "./src/i18n";
import LoginScreen from "./src/screens/LoginScreen";
import DiscoverScreen from "./src/screens/DiscoverScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ChatScreen from "./src/screens/ChatScreen";
import { AuthProvider, useAuth } from "./src/AuthContext";

const Stack = createNativeStackNavigator();

function Root() {
  const { user, ready } = useAuth();
  useEffect(() => {
    // Hard screenshot prevention on iOS/Android.
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => { ScreenCapture.allowScreenCaptureAsync().catch(() => {}); };
  }, []);
  if (!ready) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#0c0f14" }, headerTintColor: "#f4efe7" }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Discover" component={DiscoverScreen} options={{ title: "Eros · Discover" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
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
