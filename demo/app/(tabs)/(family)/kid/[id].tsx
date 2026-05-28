import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Surface, Text, View } from "@/components/Themed";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import Colors from "@/constants/Colors";
import { avatarSource } from "@/constants/Avatars";
import { useColorScheme } from "@/components/useColorScheme";
import { formatMoney } from "@/db";
import { emitDataChange } from "@/db/events";
import {
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
  const [confirmingTx, setConfirmingTx] = useState<Transaction | null>(null);

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

  async function doDeleteTx() {
    if (!confirmingTx) return;
    const id = confirmingTx.id;
    setConfirmingTx(null);
    await deleteTransaction(id);
    emitDataChange();
    await load();
  }

  if (!kid) return null;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: kid.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/add-kid?id=${kid.id}`)}
              hitSlop={10}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 16 }}
            >
              <FontAwesome name="pencil" size={18} color={Colors[cs].tint} />
              <Text style={{ color: Colors[cs].tint, fontWeight: "600" }}>Edit</Text>
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
            <View style={styles.balanceTop}>
              <View style={[styles.avatarBubble, { backgroundColor: kid.color }]}>
                {avatarSource(kid.avatar) ? (
                  <Image source={avatarSource(kid.avatar)!} style={styles.avatarImage} resizeMode="contain" />
                ) : (
                  <FontAwesome name="user" size={36} color="#fff" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.balanceLabel, { color: Colors[cs].muted }]}>Current balance</Text>
                <Text style={styles.balance}>{formatMoney(balance)}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push(`/adjust/${kid.id}?direction=credit`)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: Colors[cs].credit, borderColor: Colors[cs].credit },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>+ Earn</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/adjust/${kid.id}?direction=debit`)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: Colors[cs].debit, borderColor: Colors[cs].debit },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>− Spend</Text>
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
          <Surface style={styles.txRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txReason}>{item.reason}</Text>
              <Text style={[styles.txMeta, { color: Colors[cs].muted }]}>
                {fmtDate(item.created_at)}
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
            <Pressable
              onPress={() => setConfirmingTx(item)}
              hitSlop={8}
              style={styles.txDeleteBtn}
            >
              <FontAwesome name="trash-o" size={16} color={Colors[cs].muted} />
            </Pressable>
          </Surface>
        )}
      />

      <ConfirmDialog
        visible={confirmingTx !== null}
        title="Delete transaction?"
        message={
          confirmingTx
            ? `${confirmingTx.reason} (${confirmingTx.amount_cents >= 0 ? "+" : ""}${formatMoney(confirmingTx.amount_cents)})`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={doDeleteTx}
        onCancel={() => setConfirmingTx(null)}
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
  balanceTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 64, height: 64 },
  balanceLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  balance: { fontSize: 42, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  txRow: { flexDirection: "row", alignItems: "center" },
  txReason: { fontSize: 15, fontWeight: "600" },
  txMeta: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 17, fontWeight: "700" },
  txDeleteBtn: { paddingLeft: 14, paddingVertical: 8 },
});
