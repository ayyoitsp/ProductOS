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
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import {
  getInterestConfig,
  setInterestConfig,
} from "@/db/operations";
import { ALL_DAYS, applyInterestIfDue, dayLabel } from "@/db/interest";

export default function SettingsScreen() {
  const cs = useColorScheme() ?? "light";
  const [enabled, setEnabled] = useState(false);
  const [rateText, setRateText] = useState("5");
  const [days, setDays] = useState<number[]>([0]);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const cfg = await getInterestConfig();
    setEnabled(cfg.enabled);
    setRateText(String(cfg.rate_pct));
    setDays(cfg.days);
    setLastApplied(cfg.last_applied);
    setDirty(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function toggleDay(d: number) {
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
    Alert.alert("Saved", "Interest settings updated.");
  }

  async function applyNow() {
    const r = await applyInterestIfDue();
    await load();
    if (r.applied) {
      Alert.alert("Applied", `Credited interest to ${r.credited} kid${r.credited === 1 ? "" : "s"}.`);
    } else {
      Alert.alert(
        "Not applied",
        enabled
          ? lastApplied
            ? "Already applied today, or today isn't an interest day."
            : "Today isn't an interest day."
          : "Interest is disabled."
      );
    }
  }

  return (
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
        />
      </Surface>

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

      <Pressable
        onPress={save}
        style={[
          styles.button,
          { backgroundColor: dirty ? Colors[cs].tint : Colors[cs].surfaceMuted },
        ]}
      >
        <Text style={{ color: dirty ? "#fff" : Colors[cs].muted, fontWeight: "700", fontSize: 16 }}>
          Save
        </Text>
      </Pressable>

      <Pressable
        onPress={applyNow}
        style={[styles.button, { backgroundColor: Colors[cs].surface, borderWidth: 1, borderColor: Colors[cs].border }]}
      >
        <Text style={{ color: Colors[cs].text, fontWeight: "600", fontSize: 16 }}>
          Apply interest now (if due)
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
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
  dayRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  dayChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  button: { padding: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
});
