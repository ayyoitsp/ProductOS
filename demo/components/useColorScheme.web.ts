// Web has system-color-scheme detection but it's rendered server-side without it.
// Default to light during SSR; pick up the real value on the client.
import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => setHasHydrated(true), []);
  const cs = useRNColorScheme();
  return hasHydrated ? cs : "light";
}
