import { ThemeProvider, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { getDb } from "@/db";
import { emitDataChange } from "@/db/events";
import { applyInterestIfDue } from "@/db/interest";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const cs = colorScheme ?? "light";
  const [dbReady, setDbReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appliedToast, setAppliedToast] = useState<{ credited: number; key: number } | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("DB init failed:", e);
        setDbReady(true);
      });
  }, []);

  useEffect(() => {
    if (!dbReady) return;

    const run = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      setApplying(true);
      try {
        const r = await applyInterestIfDue();
        if (r.applied) {
          emitDataChange();
          if (r.credited > 0) {
            setAppliedToast({ credited: r.credited, key: Date.now() });
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
  }, [dbReady]);

  useEffect(() => {
    if (!appliedToast) return;
    const t = setTimeout(() => setAppliedToast(null), 3500);
    return () => clearTimeout(t);
  }, [appliedToast]);

  if (!dbReady) return null;

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
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

      {applying && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={[styles.toast, { backgroundColor: Colors[cs].surface, borderColor: Colors[cs].border }]}>
            <ActivityIndicator color={Colors[cs].tint} />
            <Text style={{ color: Colors[cs].text, fontWeight: "600" }}>Applying interest…</Text>
          </View>
        </View>
      )}

      {!applying && appliedToast && (
        <View style={styles.overlay} pointerEvents="none">
          <View
            style={[
              styles.toast,
              { backgroundColor: Colors[cs].credit, borderColor: Colors[cs].credit },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>✓</Text>
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              Interest applied — {appliedToast.credited} kid
              {appliedToast.credited === 1 ? "" : "s"} credited
            </Text>
          </View>
        </View>
      )}
    </ThemeProvider>
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
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});
