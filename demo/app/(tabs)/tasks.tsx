import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Surface, Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { formatMoney } from "@/db";
import {
  completeTask,
  deleteTask,
  listActiveTasks,
  listKids,
} from "@/db/operations";
import { Kid, Task } from "@/db/schema";

export default function TasksScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);

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

  function findKid(id: number | null): Kid | null {
    if (id == null) return null;
    return kids.find((k) => k.id === id) ?? null;
  }

  function handleComplete(task: Task) {
    const assigned = findKid(task.assigned_to_kid_id);
    if (assigned) {
      doComplete(task, assigned.id);
      return;
    }
    if (kids.length === 0) {
      Alert.alert("No kids yet", "Add a kid first.");
      return;
    }
    Alert.alert(
      "Who did this?",
      `Credit ${formatMoney(task.amount_cents)} to which kid?`,
      [
        { text: "Cancel", style: "cancel" },
        ...kids.map((k) => ({ text: k.name, onPress: () => doComplete(task, k.id) })),
      ]
    );
  }

  async function doComplete(task: Task, kidId: number) {
    await completeTask(task.id, kidId);
    await load();
  }

  function handleLongPress(task: Task) {
    Alert.alert(task.name, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTask(task.id);
          await load();
        },
      },
    ]);
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
        renderItem={({ item }) => {
          const assigned = findKid(item.assigned_to_kid_id);
          return (
            <Pressable onLongPress={() => handleLongPress(item)} onPress={() => handleComplete(item)}>
              <Surface style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={[styles.sub, { color: Colors[cs].muted }]}>
                    {assigned ? `for ${assigned.name}` : "anyone"}
                    {item.recurring ? "  ·  recurring" : "  ·  one-time"}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: Colors[cs].credit }]}>
                  {formatMoney(item.amount_cents)}
                </Text>
                <FontAwesome name="check-circle-o" size={28} color={Colors[cs].tint} style={{ marginLeft: 10 }} />
              </Surface>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable onPress={() => router.push("/add-task")} style={styles.addBtn}>
            <FontAwesome name="plus-circle" size={20} color={Colors[cs].tint} />
            <Text style={[styles.addBtnText, { color: Colors[cs].tint }]}>Add a task</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center" },
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
});
