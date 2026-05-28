import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Surface, Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { parseMoney } from "@/db";
import { createTask, listKids } from "@/db/operations";
import { Kid } from "@/db/schema";

export default function AddTaskScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kids, setKids] = useState<Kid[]>([]);
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [recurring, setRecurring] = useState(true);

  useEffect(() => {
    listKids().then(setKids);
  }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const cents = parseMoney(amount);
    if (cents == null || cents <= 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    await createTask(trimmed, cents, assignedTo, recurring);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface>
        <Text style={styles.label}>Task</Text>
        <TextInput
          style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Unload the dishwasher"
          placeholderTextColor={Colors[cs].muted}
          autoFocus
        />
      </Surface>

      <Surface>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
          value={amount}
          onChangeText={setAmount}
          placeholder="$0.50"
          placeholderTextColor={Colors[cs].muted}
          inputMode="decimal"
        />
      </Surface>

      <Surface>
        <Text style={styles.label}>For</Text>
        <View style={styles.row}>
          <Pressable onPress={() => setAssignedTo(null)}>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: assignedTo == null ? Colors[cs].tint : Colors[cs].surfaceMuted,
                  borderColor: assignedTo == null ? Colors[cs].tint : Colors[cs].border,
                },
              ]}
            >
              <Text style={{ color: assignedTo == null ? "#fff" : Colors[cs].text, fontWeight: "600" }}>Anyone</Text>
            </View>
          </Pressable>
          {kids.map((k) => {
            const on = assignedTo === k.id;
            return (
              <Pressable key={k.id} onPress={() => setAssignedTo(k.id)}>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: on ? k.color : Colors[cs].surfaceMuted,
                      borderColor: on ? k.color : Colors[cs].border,
                    },
                  ]}
                >
                  <Text style={{ color: on ? "#fff" : Colors[cs].text, fontWeight: "600" }}>{k.name}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Surface>

      <Surface>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Recurring</Text>
            <Text style={[styles.help, { color: Colors[cs].muted }]}>
              Off = one-time task (disappears after completion).
            </Text>
          </View>
          <Switch value={recurring} onValueChange={setRecurring} />
        </View>
      </Surface>

      <Pressable
        onPress={save}
        style={[
          styles.button,
          { backgroundColor: name.trim() && amount ? Colors[cs].tint : Colors[cs].surfaceMuted },
        ]}
        disabled={!name.trim() || !amount}
      >
        <Text
          style={{
            color: name.trim() && amount ? "#fff" : Colors[cs].muted,
            fontWeight: "700",
            fontSize: 16,
          }}
        >
          Add task
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  label: { fontSize: 16, fontWeight: "600" },
  help: { fontSize: 12, marginTop: 4 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  button: { padding: 14, borderRadius: 12, alignItems: "center" },
});
