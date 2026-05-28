import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Surface, Text, View } from "@/components/Themed";
import Colors, { KID_COLORS } from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { createKid } from "@/db/operations";

export default function AddKidScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(KID_COLORS[0]!);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createKid(trimmed, color);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ada"
          placeholderTextColor={Colors[cs].muted}
          autoFocus
        />
      </Surface>

      <Surface>
        <Text style={styles.label}>Color</Text>
        <View style={styles.swatchRow}>
          {KID_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: c, borderColor: c === color ? Colors[cs].text : "transparent" },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </Surface>

      <Pressable
        onPress={save}
        style={[
          styles.button,
          { backgroundColor: name.trim() ? Colors[cs].tint : Colors[cs].surfaceMuted },
        ]}
        disabled={!name.trim()}
      >
        <Text style={{ color: name.trim() ? "#fff" : Colors[cs].muted, fontWeight: "700", fontSize: 16 }}>
          Add kid
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
    fontSize: 18,
  },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  button: { padding: 14, borderRadius: 12, alignItems: "center" },
});
