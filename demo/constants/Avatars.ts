/**
 * Bundled avatar PNGs (transparent backgrounds). Keep the id stable — we
 * persist it in the kids.avatar column.
 */

export type AvatarId =
  | "curly-kid"
  | "pigtail-girl"
  | "blonde-kid"
  | "explorer"
  | "piggy-bank"
  | "robot"
  | "coin"
  | "purple-glasses"
  | "cat"
  | "owl"
  | "fox"
  | "wizard"
  | "compass"
  | "wallet-buddy"
  | "sun"
  | "moon"
  | "winged-key"
  | "star-kid"
  | "yellow-shirt-kid";

export const AVATARS: { id: AvatarId; source: number }[] = [
  { id: "curly-kid", source: require("../assets/avatars/curly-kid.png") },
  { id: "pigtail-girl", source: require("../assets/avatars/pigtail-girl.png") },
  { id: "blonde-kid", source: require("../assets/avatars/blonde-kid.png") },
  { id: "star-kid", source: require("../assets/avatars/star-kid.png") },
  { id: "yellow-shirt-kid", source: require("../assets/avatars/yellow-shirt-kid.png") },
  { id: "explorer", source: require("../assets/avatars/explorer.png") },
  { id: "wizard", source: require("../assets/avatars/wizard.png") },
  { id: "purple-glasses", source: require("../assets/avatars/purple-glasses.png") },
  { id: "robot", source: require("../assets/avatars/robot.png") },
  { id: "owl", source: require("../assets/avatars/owl.png") },
  { id: "fox", source: require("../assets/avatars/fox.png") },
  { id: "cat", source: require("../assets/avatars/cat.png") },
  { id: "sun", source: require("../assets/avatars/sun.png") },
  { id: "moon", source: require("../assets/avatars/moon.png") },
  { id: "piggy-bank", source: require("../assets/avatars/piggy-bank.png") },
  { id: "coin", source: require("../assets/avatars/coin.png") },
  { id: "wallet-buddy", source: require("../assets/avatars/wallet-buddy.png") },
  { id: "compass", source: require("../assets/avatars/compass.png") },
  { id: "winged-key", source: require("../assets/avatars/winged-key.png") },
];

const lookup: Partial<Record<AvatarId, number>> = Object.fromEntries(
  AVATARS.map((a) => [a.id, a.source])
);

export function avatarSource(id: string | null | undefined): number | null {
  if (!id) return null;
  return lookup[id as AvatarId] ?? null;
}
