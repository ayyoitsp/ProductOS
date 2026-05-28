import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Surface, Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { parseMoney } from "@/db";
import { addTransaction } from "@/db/operations";

export default function AdjustScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const kidId = Number(id);

  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  async function save() {
    const cents = parseMoney(amount);
    if (cents == null || cents <= 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    const signed = direction === "credit" ? cents : -cents;
    const r = reason.trim() || (direction === "credit" ? "Adjustment (credit)" : "Spend");
    const type = direction === "debit" ? "spend" : "adjustment";
    await addTransaction(kidId, signed, r, type);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface>
        <Text style={styles.label}>Direction</Text>
        <View style={styles.row}>
          {(["credit", "debit"] as const).map((d) => {
            const on = direction === d;
            const color = d === "credit" ? Colors[cs].credit : Colors[cs].debit;
            return (
              <Pressable key={d} onPress={() => setDirection(d)} style={{ flex: 1 }}>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: on ? color : Colors[cs].surfaceMuted,
                      borderColor: on ? color : Colors[cs].border,
                      alignItems: "center",
                    },
                  ]}
                >
                  <Text style={{ color: on ? "#fff" : Colors[cs].text, fontWeight: "700" }}>
                    {d === "credit" ? "+ Add money" : "− Spend"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Surface>

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
          placeholder={direction === "credit" ? "e.g. Birthday gift" : "e.g. Movie ticket"}
          placeholderTextColor={Colors[cs].muted}
        />
      </Surface>

      <Pressable
        onPress={save}
        style={[
          styles.button,
          { backgroundColor: amount ? Colors[cs].tint : Colors[cs].surfaceMuted },
        ]}
        disabled={!amount}
      >
        <Text style={{ color: amount ? "#fff" : Colors[cs].muted, fontWeight: "700", fontSize: 16 }}>
          Save
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  label: { fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 22,
  },
  button: { padding: 14, borderRadius: 12, alignItems: "center" },
});
