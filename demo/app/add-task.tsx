import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Surface, Text, View } from "@/components/Themed";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { formatMoney, parseMoney } from "@/db";
import {
  createTask,
  deleteTask,
  updateTask,
} from "@/db/operations";
import { Task } from "@/db/schema";
import { getDb } from "@/db";

export default function AddTaskScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const isEdit = editingId !== null && Number.isFinite(editingId);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState(true);
  const [loaded, setLoaded] = useState(!isEdit);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const db = await getDb();
      const t = await db.getFirstAsync<Task>(
        "SELECT * FROM tasks WHERE id = ?",
        [editingId]
      );
      if (t) {
        setName(t.name);
        setAmount(formatMoney(t.amount_cents).replace("$", ""));
        setRecurring(t.recurring === 1);
      }
      setLoaded(true);
    })();
  }, [isEdit, editingId]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const cents = parseMoney(amount);
    if (cents == null || cents <= 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    if (isEdit) {
      await updateTask(editingId!, {
        name: trimmed,
        amount_cents: cents,
        recurring: recurring ? 1 : 0,
      });
    } else {
      await createTask(trimmed, cents, recurring);
    }
    router.back();
  }

  async function doDelete() {
    if (!isEdit) return;
    setConfirmDelete(false);
    await deleteTask(editingId!);
    router.back();
  }

  if (!loaded) return null;

  const valid = name.trim().length > 0 && !!amount;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: isEdit ? "Edit task" : "New task",
          headerRight: isEdit
            ? () => (
                <Pressable
                  onPress={() => setConfirmDelete(true)}
                  hitSlop={10}
                  style={{ paddingRight: 16 }}
                >
                  <FontAwesome name="trash" size={20} color={Colors[cs].debit} />
                </Pressable>
              )
            : undefined,
        }}
      />

      <Surface>
        <Text style={styles.label}>Task</Text>
        <TextInput
          style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Unload the dishwasher"
          placeholderTextColor={Colors[cs].muted}
          autoFocus={!isEdit}
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
          { backgroundColor: valid ? Colors[cs].tint : Colors[cs].surfaceMuted },
        ]}
        disabled={!valid}
      >
        <Text
          style={{
            color: valid ? "#fff" : Colors[cs].muted,
            fontWeight: "700",
            fontSize: 16,
          }}
        >
          {isEdit ? "Save changes" : "Add task"}
        </Text>
      </Pressable>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete task?"
        message={`Remove "${name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
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
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: { padding: 14, borderRadius: 12, alignItems: "center" },
});
