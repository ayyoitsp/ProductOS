import { Stack } from "expo-router";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function FamilyStackLayout() {
  const cs = useColorScheme() ?? "light";
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: Colors[cs].surface },
        headerTitleStyle: { color: Colors[cs].text },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="kid/[id]" options={{ headerShown: true, title: "" }} />
    </Stack>
  );
}
