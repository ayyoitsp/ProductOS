import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Surface, Text, View } from "@/components/Themed";
import { useToast } from "@/components/Toast";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { formatMoney } from "@/db";
import {
  getAllBalances,
  getInterestConfig,
  listKids,
  setInterestConfig,
} from "@/db/operations";
import { ALL_DAYS, applyInterestNow, dayLabel } from "@/db/interest";
import { emitDataChange } from "@/db/events";
import { Kid } from "@/db/schema";

const PREVIEW_BALANCES_CENTS = [100, 500, 2000, 5000, 10000, 20000];

export default function SettingsScreen() {
  const cs = useColorScheme() ?? "light";
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [rateText, setRateText] = useState("5");
  const [days, setDays] = useState<number[]>([0]);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [kids, setKids] = useState<Kid[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    const [cfg, k, b] = await Promise.all([
      getInterestConfig(),
      listKids(),
      getAllBalances(),
    ]);
    setEnabled(cfg.enabled);
    setRateText(String(cfg.rate_pct));
    setDays(cfg.days);
    setLastApplied(cfg.last_applied);
    setKids(k);
    setBalances(b);
    setDirty(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function toggleDay(d: number) {
    if (!enabled) return;
    setDirty(true);
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function save() {
    const rate = Number(rateText.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(rate) || rate < 0) {
      Alert.alert("Invalid rate", "Rate must be a non-negative number.");
      return;
    }
    await setInterestConfig({ enabled, rate_pct: rate, days });
    setDirty(false);
    toast.show("Settings saved");
  }

  async function applyNow() {
    const r = await applyInterestNow();
    emitDataChange();
    await load();
    toast.show(
      r.credited > 0
        ? `Interest applied — ${r.credited} kid${r.credited === 1 ? "" : "s"} credited`
        : "No kids had a positive balance",
      r.credited > 0 ? "success" : "info"
    );
  }

  const rate = Number(rateText.replace(/[^0-9.]/g, ""));
  const validRate = Number.isFinite(rate) && rate >= 0;
  const calc = (cents: number) => (validRate ? Math.round((cents * rate) / 100) : 0);

  // Greyed-out wrapper for the dependent settings group.
  const groupOpacity = enabled ? 1 : 0.45;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.section}>Interest</Text>

        <Surface>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Apply interest</Text>
              <Text style={[styles.help, { color: Colors[cs].muted }]}>
                Kid balances earn interest on selected days of the week.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={(v) => {
                setEnabled(v);
                setDirty(true);
              }}
            />
          </View>
        </Surface>

        <View
          style={[styles.group, { opacity: groupOpacity }]}
          pointerEvents={enabled ? "auto" : "none"}
        >
          <Surface>
            <Text style={styles.label}>Days of week</Text>
            <Text style={[styles.help, { color: Colors[cs].muted }]}>
              Interest is applied once on these days, on the first time the app is opened after midnight.
            </Text>
            <View style={styles.dayRow}>
              {ALL_DAYS.map((d) => {
                const on = days.includes(d);
                return (
                  <Pressable key={d} onPress={() => toggleDay(d)}>
                    <View
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: on ? Colors[cs].tint : Colors[cs].surfaceMuted,
                          borderColor: on ? Colors[cs].tint : Colors[cs].border,
                        },
                      ]}
                    >
                      <Text style={{ color: on ? "#fff" : Colors[cs].text, fontWeight: "600" }}>
                        {dayLabel(d)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {lastApplied && (
              <Text style={[styles.help, { color: Colors[cs].muted, marginTop: 12 }]}>
                Last applied: {lastApplied}
              </Text>
            )}
          </Surface>

          <Surface>
            <Text style={styles.label}>Rate (%)</Text>
            <Text style={[styles.help, { color: Colors[cs].muted }]}>
              Percent of current balance, applied each interest day. Unbounded — use a big number to make small balances feel exciting.
            </Text>
            <TextInput
              style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
              value={rateText}
              onChangeText={(t) => {
                setRateText(t);
                setDirty(true);
              }}
              inputMode="decimal"
              placeholder="5"
              placeholderTextColor={Colors[cs].muted}
              editable={enabled}
            />

            {kids.length > 0 && (
              <>
                <Text style={[styles.help, { color: Colors[cs].muted, marginTop: 14 }]}>
                  Your kids would earn next interest day:
                </Text>
                <View style={[styles.table, { borderColor: Colors[cs].border }]}>
                  <View style={[styles.tableHeader, { borderBottomColor: Colors[cs].border }]}>
                    <Text style={[styles.tableCellHeader, { color: Colors[cs].muted }]}>Kid</Text>
                    <Text style={[styles.tableCellHeaderMid, { color: Colors[cs].muted }]}>Balance</Text>
                    <Text style={[styles.tableCellHeaderRight, { color: Colors[cs].muted }]}>Earns</Text>
                  </View>
                  {kids.map((k, i) => {
                    const bal = balances[k.id] ?? 0;
                    const interest = bal > 0 ? calc(bal) : 0;
                    const last = i === kids.length - 1;
                    return (
                      <View
                        key={k.id}
                        style={[
                          styles.tableRow,
                          !last && { borderBottomColor: Colors[cs].border, borderBottomWidth: StyleSheet.hairlineWidth },
                        ]}
                      >
                        <View style={[styles.tableCell, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.color }} />
                          <Text style={{ color: Colors[cs].text, fontSize: 15 }}>{k.name}</Text>
                        </View>
                        <Text style={[styles.tableCellMid, { color: Colors[cs].text }]}>
                          {formatMoney(bal)}
                        </Text>
                        <Text style={[styles.tableCellRight, { color: validRate && interest > 0 ? Colors[cs].credit : Colors[cs].muted }]}>
                          {validRate && interest > 0 ? `+${formatMoney(interest)}` : "—"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={[styles.help, { color: Colors[cs].muted, marginTop: 14 }]}>
              Sample balances at this rate:
            </Text>
            <View style={[styles.table, { borderColor: Colors[cs].border }]}>
              <View style={[styles.tableHeader, { borderBottomColor: Colors[cs].border }]}>
                <Text style={[styles.tableCellHeader, { color: Colors[cs].muted }]}>Balance</Text>
                <Text style={[styles.tableCellHeaderRight, { color: Colors[cs].muted }]}>Earns</Text>
              </View>
              {PREVIEW_BALANCES_CENTS.map((cents, i) => {
                const interest = calc(cents);
                const last = i === PREVIEW_BALANCES_CENTS.length - 1;
                return (
                  <View
                    key={cents}
                    style={[
                      styles.tableRow,
                      !last && { borderBottomColor: Colors[cs].border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <Text style={[styles.tableCell, { color: Colors[cs].text }]}>
                      {formatMoney(cents)}
                    </Text>
                    <Text style={[styles.tableCellRight, { color: validRate && interest > 0 ? Colors[cs].credit : Colors[cs].muted }]}>
                      {validRate ? `+${formatMoney(interest)}` : "—"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Surface>

          <Pressable
            onPress={applyNow}
            style={[styles.secondaryButton, { backgroundColor: Colors[cs].surface, borderColor: Colors[cs].border }]}
          >
            <Text style={{ color: Colors[cs].text, fontWeight: "600", fontSize: 16 }}>
              Apply interest now
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={[
          styles.floatingBar,
          { backgroundColor: Colors[cs].background, borderTopColor: Colors[cs].border },
        ]}
      >
        <Pressable
          onPress={save}
          disabled={!dirty}
          style={[
            styles.button,
            { backgroundColor: dirty ? Colors[cs].tint : Colors[cs].surfaceMuted },
          ]}
        >
          <Text style={{ color: dirty ? "#fff" : Colors[cs].muted, fontWeight: "700", fontSize: 16 }}>
            Save
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, gap: 12, paddingBottom: 96 },
  section: { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: "600" },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontSize: 16, fontWeight: "600" },
  help: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
  group: { gap: 12, marginLeft: 24 },
  dayRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  dayChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  button: { padding: 14, borderRadius: 12, alignItems: "center" },
  secondaryButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    marginTop: 4,
  },
  floatingBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableCell: { flex: 1, fontSize: 15, fontVariant: ["tabular-nums"] },
  tableCellMid: { flex: 1, fontSize: 15, fontVariant: ["tabular-nums"] },
  tableCellRight: { flex: 1, fontSize: 15, fontWeight: "700", textAlign: "right", fontVariant: ["tabular-nums"] },
  tableCellHeader: { flex: 1, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  tableCellHeaderMid: { flex: 1, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  tableCellHeaderRight: { flex: 1, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" },
});
