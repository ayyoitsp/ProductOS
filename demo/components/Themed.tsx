import {
  Text as DefaultText,
  View as DefaultView,
  StyleSheet,
} from "react-native";
import Colors from "@/constants/Colors";
import { useColorScheme } from "./useColorScheme";

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & DefaultView["props"];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? "light";
  const colorFromProps = props[theme];
  if (colorFromProps) return colorFromProps;
  return Colors[theme][colorName];
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...other } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  return <DefaultText style={[{ color }, style]} {...other} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...other } = props;
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    "background"
  );
  return <DefaultView style={[{ backgroundColor }, style]} {...other} />;
}

export function Surface(props: ViewProps) {
  const { style, ...other } = props;
  const backgroundColor = useThemeColor({}, "surface");
  const borderColor = useThemeColor({}, "border");
  return (
    <DefaultView
      style={[styles.surface, { backgroundColor, borderColor }, style]}
      {...other}
    />
  );
}

export function Divider() {
  const borderColor = useThemeColor({}, "border");
  return <DefaultView style={[styles.divider, { backgroundColor: borderColor }]} />;
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
});
