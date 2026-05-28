import { ThemeProvider, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { useColorScheme } from "@/components/useColorScheme";
import { getDb } from "@/db";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("DB init failed:", e);
        setDbReady(true);
      });
  }, []);

  if (!dbReady) return null;

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="kid/[id]" options={{ title: "" }} />
        <Stack.Screen
          name="add-kid"
          options={{ presentation: "modal", title: "Add a kid" }}
        />
        <Stack.Screen
          name="add-task"
          options={{ presentation: "modal", title: "New task" }}
        />
        <Stack.Screen
          name="adjust/[id]"
          options={{ presentation: "modal", title: "Manual adjustment" }}
        />
      </Stack>
    </ThemeProvider>
  );
}
