import { ThemeProvider, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { Text } from "@/components/Themed";
import { ToastProvider, useToast } from "@/components/Toast";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { emitDataChange } from "@/db/events";
import { applyInterestIfDue } from "@/db/interest";
import { initStore } from "@/store";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initStore()
      .then(() => setDbReady(true))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("Store init failed:", e);
        setDbReady(true);
      });
  }, []);

  if (!dbReady) return null;

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <ToastProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-kid"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="add-task"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="adjust/[id]"
            options={{ presentation: "modal" }}
          />
        </Stack>
        <InterestApplyRunner />
      </ToastProvider>
    </ThemeProvider>
  );
}

/**
 * Runs applyInterestIfDue at boot and on every AppState→active transition.
 * Shows a spinner overlay during the apply and a toast on a successful credit.
 */
function InterestApplyRunner() {
  const cs = useColorScheme() ?? "light";
  const toast = useToast();
  const [applying, setApplying] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      setApplying(true);
      try {
        const r = await applyInterestIfDue();
        if (r.applied) {
          emitDataChange();
          if (r.credited > 0) {
            toast.show(
              `Interest applied — ${r.credited} kid${r.credited === 1 ? "" : "s"} credited`
            );
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("applyInterestIfDue failed:", e);
      } finally {
        setApplying(false);
        runningRef.current = false;
      }
    };
    run();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => sub.remove();
  }, [toast]);

  if (!applying) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={[styles.spinner, { backgroundColor: Colors[cs].surface, borderColor: Colors[cs].border }]}>
        <ActivityIndicator color={Colors[cs].tint} />
        <Text style={{ color: Colors[cs].text, fontWeight: "600" }}>Applying interest…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 60,
  },
  spinner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
});
