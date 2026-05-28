import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Surface, Text, View } from "@/components/Themed";
import { formatMoney } from "@/db";
import { getAllBalances, listKids } from "@/db/operations";
import { onDataChange } from "@/db/events";
import { Kid } from "@/db/schema";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function FamilyScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const [kids, setKids] = useState<Kid[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [k, b] = await Promise.all([listKids(), getAllBalances()]);
    setKids(k);
    setBalances(b);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    return onDataChange(() => {
      load();
    });
  }, [load]);

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.list}
        data={kids}
        keyExtractor={(k) => String(k.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={Colors[cs].tint}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No kids yet.</Text>
            <Text style={{ color: Colors[cs].muted, marginTop: 4 }}>
              Tap “Add a kid” below to start tracking allowances.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/kid/${item.id}`} asChild>
            <Pressable>
              <Surface style={[styles.card, { borderLeftColor: item.color, borderLeftWidth: 6 }]}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={[styles.balanceLabel, { color: Colors[cs].muted }]}>Balance</Text>
                </View>
                <Text style={styles.balance}>{formatMoney(balances[item.id] ?? 0)}</Text>
              </Surface>
            </Pressable>
          </Link>
        )}
        ListFooterComponent={
          <Pressable onPress={() => router.push("/add-kid")} style={styles.addBtn}>
            <FontAwesome name="plus-circle" size={20} color={Colors[cs].tint} />
            <Text style={[styles.addBtnText, { color: Colors[cs].tint }]}>Add a kid</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: { flexDirection: "row", alignItems: "center", gap: 14 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { fontSize: 18, fontWeight: "600" },
  balanceLabel: { fontSize: 12, marginTop: 2 },
  balance: { fontSize: 22, fontWeight: "700" },
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
