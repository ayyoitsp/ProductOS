import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Surface, Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { parseMoney } from "@/db";
import { addTransaction } from "@/db/operations";

export default function AdjustScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
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

  async function save() {
    const cents = parseMoney(amount);
    if (cents == null || cents <= 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    const signed = isEarn ? cents : -cents;
    const r = reason.trim() || (isEarn ? "Earned" : "Spent");
    const type = isEarn ? "earn" : "spend";
    await addTransaction(kidId, signed, r, type);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
          { backgroundColor: amount ? accent : Colors[cs].surfaceMuted },
        ]}
        disabled={!amount}
      >
        <Text style={{ color: amount ? "#fff" : Colors[cs].muted, fontWeight: "700", fontSize: 16 }}>
          {isEarn ? "Add money" : "Spend money"}
        </Text>
      </Pressable>
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
});
