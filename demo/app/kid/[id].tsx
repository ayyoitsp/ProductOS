import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Surface, Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { formatMoney } from "@/db";
import {
  deleteKid,
  deleteTransaction,
  getBalance,
  getKid,
  listTransactions,
} from "@/db/operations";
import { Kid, Transaction } from "@/db/schema";

export default function KidScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const kidId = Number(id);

  const [kid, setKid] = useState<Kid | null>(null);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(kidId)) return;
    const [k, b, list] = await Promise.all([
      getKid(kidId),
      getBalance(kidId),
      listTransactions(kidId),
    ]);
    setKid(k);
    setBalance(b);
    setTxs(list);
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleDeleteKid() {
    Alert.alert(
      "Delete kid?",
      `This removes ${kid?.name ?? "this kid"} and all their transactions. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteKid(kidId);
            router.back();
          },
        },
      ]
    );
  }

  function handleDeleteTx(tx: Transaction) {
    Alert.alert(
      "Delete transaction?",
      `${tx.reason} (${formatMoney(tx.amount_cents)})`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTransaction(tx.id);
            await load();
          },
        },
      ]
    );
  }

  if (!kid) return null;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: kid.name,
          headerRight: () => (
            <Pressable onPress={handleDeleteKid} hitSlop={10}>
              <FontAwesome name="trash" size={20} color={Colors[cs].debit} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        contentContainerStyle={styles.list}
        data={txs}
        keyExtractor={(t) => String(t.id)}
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
        ListHeaderComponent={
          <Surface style={[styles.balanceCard, { borderLeftColor: kid.color, borderLeftWidth: 6 }]}>
            <Text style={[styles.balanceLabel, { color: Colors[cs].muted }]}>Current balance</Text>
            <Text style={styles.balance}>{formatMoney(balance)}</Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push(`/adjust/${kid.id}`)}
                style={[styles.actionBtn, { borderColor: Colors[cs].border }]}
              >
                <Text style={{ color: Colors[cs].text, fontWeight: "600" }}>+ / − Adjust</Text>
              </Pressable>
            </View>
          </Surface>
        }
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ color: Colors[cs].muted }}>No transactions yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => handleDeleteTx(item)}>
            <Surface style={styles.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txReason}>{item.reason}</Text>
                <Text style={[styles.txMeta, { color: Colors[cs].muted }]}>
                  {fmtDate(item.created_at)} · {item.type}
                </Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: item.amount_cents >= 0 ? Colors[cs].credit : Colors[cs].debit },
                ]}
              >
                {item.amount_cents >= 0 ? "+" : ""}
                {formatMoney(item.amount_cents)}
              </Text>
            </Surface>
          </Pressable>
        )}
      />
    </View>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("default", { month: "short" });
  const day = d.getDate();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${month} ${day} · ${hh}:${m} ${ampm}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 10 },
  balanceCard: { gap: 6 },
  balanceLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  balance: { fontSize: 42, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  txRow: { flexDirection: "row", alignItems: "center" },
  txReason: { fontSize: 15, fontWeight: "600" },
  txMeta: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 17, fontWeight: "700" },
});
