import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Text } from "./Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "./useColorScheme";

export type ToastKind = "success" | "info" | "error";

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
};

type ToastApi = {
  show: (message: string, kind?: ToastKind) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

const TOAST_DURATION_MS = 2200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const cs = useColorScheme() ?? "light";
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, kind }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <View pointerEvents="box-none" style={styles.overlay}>
        {toasts.map((t) => {
          const bg =
            t.kind === "error"
              ? Colors[cs].debit
              : t.kind === "info"
              ? Colors[cs].tint
              : Colors[cs].credit;
          const icon =
            t.kind === "error" ? "exclamation-circle" : t.kind === "info" ? "info-circle" : "check-circle";
          return (
            <Pressable key={t.id} onPress={() => dismiss(t.id)}>
              <View style={[styles.toast, { backgroundColor: bg, borderColor: bg }]}>
                <FontAwesome name={icon} size={16} color="#fff" />
                <Text style={styles.text}>{t.message}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Soft fallback so callers don't have to null-guard during boot.
    return { show: () => {} };
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { color: "#fff", fontWeight: "600" },
});
