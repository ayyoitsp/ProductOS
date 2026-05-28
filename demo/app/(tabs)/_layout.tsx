import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

function TabIcon(props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const cs = useColorScheme() ?? "light";
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[cs].tint,
        tabBarStyle: { backgroundColor: Colors[cs].surface, borderTopColor: Colors[cs].border },
        headerStyle: { backgroundColor: Colors[cs].surface },
        headerTitleStyle: { color: Colors[cs].text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Family", tabBarIcon: ({ color }) => <TabIcon name="users" color={color} /> }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: "Tasks", tabBarIcon: ({ color }) => <TabIcon name="check-square-o" color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color }) => <TabIcon name="cog" color={color} /> }}
      />
    </Tabs>
  );
}
