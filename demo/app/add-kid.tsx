import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Surface, Text, View } from "@/components/Themed";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import Colors, { KID_COLORS } from "@/constants/Colors";
import { AVATARS, AvatarId, avatarSource } from "@/constants/Avatars";
import { useColorScheme } from "@/components/useColorScheme";
import { createKid, deleteKid, getKid, updateKid } from "@/db/operations";

export default function AddKidScreen() {
  const cs = useColorScheme() ?? "light";
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const isEdit = editingId !== null && Number.isFinite(editingId);

  const [name, setName] = useState("");
  const [color, setColor] = useState(KID_COLORS[0]!);
  const [avatar, setAvatar] = useState<AvatarId | null>(null);
  const [loaded, setLoaded] = useState(!isEdit);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const k = await getKid(editingId!);
      if (k) {
        setName(k.name);
        setColor(k.color);
        setAvatar((k.avatar as AvatarId) ?? null);
      }
      setLoaded(true);
    })();
  }, [isEdit, editingId]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isEdit) {
      await updateKid(editingId!, { name: trimmed, color, avatar });
    } else {
      await createKid(trimmed, color, avatar);
    }
    router.back();
  }

  async function doDelete() {
    if (!isEdit) return;
    setConfirmDelete(false);
    await deleteKid(editingId!);
    router.dismissAll();
    router.replace("/");
  }

  if (!loaded) return null;

  const selectedSource = avatarSource(avatar);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: isEdit ? "Edit kid" : "Add a kid",
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
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, { color: Colors[cs].text, borderColor: Colors[cs].border }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ada"
          placeholderTextColor={Colors[cs].muted}
          autoFocus={!isEdit}
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

      <Surface>
        <Text style={styles.label}>Avatar</Text>
        <View style={styles.avatarRow}>
          <Pressable onPress={() => setAvatar(null)}>
            <View
              style={[
                styles.avatarBubble,
                {
                  backgroundColor: color,
                  borderColor: avatar === null ? Colors[cs].text : "transparent",
                },
              ]}
            >
              <FontAwesome name="user" size={28} color="#fff" />
            </View>
          </Pressable>
          {AVATARS.map((a) => {
            const on = avatar === a.id;
            return (
              <Pressable key={a.id} onPress={() => setAvatar(a.id)}>
                <View
                  style={[
                    styles.avatarBubble,
                    {
                      backgroundColor: color,
                      borderColor: on ? Colors[cs].text : "transparent",
                    },
                  ]}
                >
                  <Image source={a.source} style={styles.avatarImage} resizeMode="contain" />
                </View>
              </Pressable>
            );
          })}
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
          {isEdit ? "Save changes" : "Add kid"}
        </Text>
      </Pressable>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete kid?"
        message={`This removes ${name || "this kid"} and all their transactions. This cannot be undone.`}
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
  avatarRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  avatarBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 56, height: 56 },
  button: { padding: 14, borderRadius: 12, alignItems: "center" },
});
