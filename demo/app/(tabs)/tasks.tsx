import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Surface, Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { formatMoney, parseMoney } from "@/db";
import {
  completeTask,
  listActiveTasks,
  listKids,
} from "@/db/operations";
import { Kid, Task } from "@/db/schema";

export default function TasksScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [confirming, setConfirming] = useState<Task | null>(null);
  const [confirmKidId, setConfirmKidId] = useState<number | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [confirmAmount, setConfirmAmount] = useState("");
  const [confirmComment, setConfirmComment] = useState("");

  const load = useCallback(async () => {
    const [t, k] = await Promise.all([listActiveTasks(), listKids()]);
    setTasks(t);
    setKids(k);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openConfirm(task: Task) {
    if (kids.length === 0) {
      Alert.alert("No kids yet", "Add a kid first.");
      return;
    }
    setConfirming(task);
    setConfirmKidId(kids.length === 1 ? kids[0]!.id : null);
    setConfirmName(task.name);
    setConfirmAmount(formatMoney(task.amount_cents).replace("$", ""));
    setConfirmComment("");
  }

  function closeConfirm() {
    setConfirming(null);
  }

  async function submitConfirm() {
    if (!confirming) return;
    if (confirmKidId == null) {
      Alert.alert("Pick a kid", "Choose who gets credit.");
      return;
    }
    const name = confirmName.trim();
    if (!name) {
      Alert.alert("Name required", "Give the task a name.");
      return;
    }
    const cents = parseMoney(confirmAmount);
    if (cents == null || cents <= 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    const taskId = confirming.id;
    closeConfirm();
    await completeTask(taskId, confirmKidId, {
      amount_cents: cents,
      name,
      comment: confirmComment.trim() || undefined,
    });
    await load();
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.list}
        data={tasks}
        keyExtractor={(t) => String(t.id)}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No tasks yet.</Text>
            <Text style={{ color: Colors[cs].muted, marginTop: 4 }}>
              Add a task below — like “unload the dishwasher: $0.75”.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Surface style={styles.row}>
            <Pressable onPress={() => openConfirm(item)} style={styles.rowMain}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={[styles.sub, { color: Colors[cs].muted }]}>
                  {item.recurring ? "recurring" : "one-time"}
                </Text>
              </View>
              <Text style={[styles.amount, { color: Colors[cs].credit }]}>
                {formatMoney(item.amount_cents)}
              </Text>
              <FontAwesome name="check-circle-o" size={28} color={Colors[cs].tint} style={{ marginLeft: 10 }} />
            </Pressable>
            <Pressable
              onPress={() => router.push(`/add-task?id=${item.id}`)}
              hitSlop={6}
              style={styles.editBtn}
            >
              <FontAwesome name="pencil" size={16} color={Colors[cs].muted} />
            </Pressable>
          </Surface>
        )}
        ListFooterComponent={
          <Pressable onPress={() => router.push("/add-task")} style={styles.addBtn}>
            <FontAwesome name="plus-circle" size={20} color={Colors[cs].tint} />
            <Text style={[styles.addBtnText, { color: Colors[cs].tint }]}>Add a task</Text>
          </Pressable>
        }
      />

      <Modal
        visible={confirming !== null}
        transparent
        animationType="fade"
        onRequestClose={closeConfirm}
      >
        <Pressable style={styles.backdrop} onPress={closeConfirm}>
          <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 480 }}>
            <Surface style={styles.sheet}>
              <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>Complete task</Text>

                <View>
                  <Text style={styles.fieldLabel}>Task</Text>
                  <TextInput
                    style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
                    value={confirmName}
                    onChangeText={setConfirmName}
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Amount</Text>
                  <TextInput
                    style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
                    value={confirmAmount}
                    onChangeText={setConfirmAmount}
                    inputMode="decimal"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Comment (optional)</Text>
                  <TextInput
                    style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
                    value={confirmComment}
                    onChangeText={setConfirmComment}
                    placeholder=""
                    placeholderTextColor={Colors[cs].muted}
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Who did this?</Text>
                  <View style={styles.kidRow}>
                    {kids.map((k) => {
                      const on = confirmKidId === k.id;
                      return (
                        <Pressable key={k.id} onPress={() => setConfirmKidId(k.id)}>
                          <View
                            style={[
                              styles.kidChip,
                              {
                                backgroundColor: on ? k.color : Colors[cs].surfaceMuted,
                                borderColor: on ? k.color : Colors[cs].border,
                              },
                            ]}
                          >
                            <Text style={{ color: on ? "#fff" : Colors[cs].text, fontWeight: "600" }}>
                              {k.name}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.btnRow}>
                  <Pressable
                    onPress={closeConfirm}
                    style={[styles.cancelBtn, { borderColor: Colors[cs].border }]}
                  >
                    <Text style={{ color: Colors[cs].muted, fontWeight: "600" }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={submitConfirm}
                    style={[styles.confirmBtn, { backgroundColor: Colors[cs].credit }]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Confirm</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Surface>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  editBtn: { paddingLeft: 14, paddingRight: 4, paddingVertical: 12 },
  name: { fontSize: 16, fontWeight: "600" },
  sub: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: "700" },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  addBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    justifyContent: "center",
  },
  addBtnText: { fontSize: 16, fontWeight: "600" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  sheet: { gap: 4, maxHeight: "100%" },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  kidRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kidChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
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
