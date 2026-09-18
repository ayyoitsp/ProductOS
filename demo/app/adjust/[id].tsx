import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Surface, Text, View } from "@/components/Themed";
import { useToast } from "@/components/Toast";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { formatMoney, parseMoney } from "@/db";
import { addTransaction, getKid } from "@/db/operations";
import { cancelRead, isNfcSupported, readKidIdOnce } from "@/lib/nfc";

type ScanState =
  | { kind: "idle" }
  | { kind: "waiting" }
  | { kind: "error"; message: string };

export default function AdjustScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { id, direction: rawDir } = useLocalSearchParams<{
    id: string;
    direction?: string;
  }>();
  const kidId = Number(id);
  const direction: "credit" | "debit" = rawDir === "debit" ? "debit" : "credit";
  const isEarn = direction === "credit";
  const accent = isEarn ? Colors[cs].credit : Colors[cs].debit;

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [kidName, setKidName] = useState("");
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({ kind: "idle" });
  const scanIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Number.isFinite(kidId)) {
        const k = await getKid(kidId);
        if (!cancelled && k) setKidName(k.name);
      }
      if (!isEarn) {
        const supported = await isNfcSupported();
        if (!cancelled) setNfcAvailable(supported);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kidId, isEarn]);

  const enteredCents = parseMoney(amount);
  const canSubmit = enteredCents != null && enteredCents > 0;
  const modalOpen = scanState.kind !== "idle";

  async function save() {
    if (!canSubmit || enteredCents == null) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    const signed = isEarn ? enteredCents : -enteredCents;
    const r = reason.trim() || (isEarn ? "Earned" : "Spent");
    const type = isEarn ? "earn" : "spend";
    await addTransaction(kidId, signed, r, type);
    router.back();
    toast.show(`${isEarn ? "+" : "−"}${formatMoney(enteredCents)} · ${r}`);
  }

  async function startScan() {
    if (!canSubmit || enteredCents == null) return;
    const myId = ++scanIdRef.current;
    setScanState({ kind: "waiting" });
    const result = await readKidIdOnce();
    if (myId !== scanIdRef.current) return; // user cancelled or restarted

    if (result.kind === "match") {
      if (result.kidId === kidId) {
        setScanState({ kind: "idle" });
        const r = reason.trim() || "Card tap";
        await addTransaction(kidId, -enteredCents, r, "spend");
        router.back();
        toast.show(`−${formatMoney(enteredCents)} · ${r}`);
        return;
      }
      const other = await getKid(result.kidId);
      if (myId !== scanIdRef.current) return;
      const otherName = other?.name ?? "that";
      setScanState({
        kind: "error",
        message: `That's ${otherName}'s card, not ${kidName}'s`,
      });
      return;
    }
    if (result.kind === "cancelled") {
      setScanState({ kind: "idle" });
      return;
    }
    setScanState({ kind: "error", message: "Card not recognized" });
  }

  function cancelScan() {
    scanIdRef.current++; // invalidate any in-flight scan
    cancelRead();
    setScanState({ kind: "idle" });
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <Stack.Screen options={{ title: isEarn ? "Add money" : "Spend money" }} />

      <Surface>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
          value={amount}
          onChangeText={setAmount}
          placeholder="$0.00"
          placeholderTextColor={Colors[cs].muted}
          inputMode="decimal"
          autoFocus
        />
      </Surface>

      <Surface>
        <Text style={styles.label}>Reason (optional)</Text>
        <TextInput
          style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
          value={reason}
          onChangeText={setReason}
          placeholder={isEarn ? "e.g. Birthday gift" : "e.g. Movie ticket"}
          placeholderTextColor={Colors[cs].muted}
        />
      </Surface>

      <Pressable
        onPress={save}
        style={[
          styles.button,
          { backgroundColor: canSubmit ? accent : Colors[cs].surfaceMuted },
        ]}
        disabled={!canSubmit}
      >
        <Text style={{ color: canSubmit ? "#fff" : Colors[cs].muted, fontWeight: "700", fontSize: 16 }}>
          {isEarn ? "Add money" : "Spend money"}
        </Text>
      </Pressable>

      {!isEarn && nfcAvailable ? (
        <Pressable
          onPress={startScan}
          style={[
            styles.button,
            styles.secondaryButton,
            { borderColor: canSubmit ? accent : Colors[cs].border },
          ]}
          disabled={!canSubmit}
        >
          <Text style={{ color: canSubmit ? accent : Colors[cs].muted, fontWeight: "700", fontSize: 16 }}>
            Tap a card
          </Text>
        </Pressable>
      ) : null}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={cancelScan}>
        <View style={styles.modalBackdrop} lightColor="rgba(28,25,23,0.45)" darkColor="rgba(0,0,0,0.6)">
          <Surface style={styles.modalCard}>
            <Text style={[styles.modalEyebrow, { color: Colors[cs].muted }]}>Tap to charge</Text>
            <Text style={styles.modalTitle}>
              Tap {kidName ? `${kidName}'s` : "the"} card
            </Text>
            {enteredCents != null ? (
              <Text style={[styles.modalSub, { color: Colors[cs].muted }]}>
                to charge {formatMoney(enteredCents)}
              </Text>
            ) : null}

            <View style={styles.modalBody}>
              {scanState.kind === "waiting" ? (
                <>
                  <ActivityIndicator size="large" color={accent} />
                  <Text style={[styles.modalHint, { color: Colors[cs].muted }]}>Waiting…</Text>
                </>
              ) : null}
              {scanState.kind === "error" ? (
                <Text style={[styles.modalError, { color: Colors[cs].debit }]}>
                  {scanState.message}
                </Text>
              ) : null}
            </View>

            <View style={styles.modalActions}>
              {scanState.kind === "error" ? (
                <Pressable
                  onPress={startScan}
                  style={[styles.modalBtn, { backgroundColor: accent }]}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Try again</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={cancelScan}
                style={[styles.modalBtn, styles.modalBtnGhost, { borderColor: Colors[cs].border }]}
              >
                <Text style={{ color: Colors[cs].muted, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
            </View>
          </Surface>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  label: { fontSize: 16, fontWeight: "600" },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 22,
  },
  button: { padding: 14, borderRadius: 12, alignItems: "center" },
  secondaryButton: { borderWidth: 1, backgroundColor: "transparent" },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: { width: "100%", maxWidth: 340, gap: 6 },
  modalEyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, textAlign: "center" },
  modalTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  modalSub: { fontSize: 14, textAlign: "center" },
  modalBody: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
    minHeight: 110,
  },
  modalHint: { fontSize: 13, letterSpacing: 0.5 },
  modalError: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 4 },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnGhost: { borderWidth: 1 },
});
