import { Modal, Pressable, StyleSheet } from "react-native";
import { Surface, Text, View } from "./Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "./useColorScheme";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  const cs = useColorScheme() ?? "light";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 420 }}>
          <Surface style={{ gap: 12 }}>
            <Text style={styles.title}>{title}</Text>
            {message ? (
              <Text style={{ color: Colors[cs].muted }}>{message}</Text>
            ) : null}
            <View style={styles.btnRow}>
              <Pressable
                onPress={onCancel}
                style={[styles.cancelBtn, { borderColor: Colors[cs].border }]}
              >
                <Text style={{ color: Colors[cs].muted, fontWeight: "600" }}>
                  {cancelLabel}
                </Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: destructive ? Colors[cs].debit : Colors[cs].tint },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>{confirmLabel}</Text>
              </Pressable>
            </View>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  title: { fontSize: 18, fontWeight: "700" },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
});
