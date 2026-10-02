import NfcManager, { Ndef, NfcTech, type NdefRecord } from "react-native-nfc-manager";

// Accepts two- or three-slash variants. Two-slash (familywallet://kid/3) is
// what we've been writing to cards; three-slash (familywallet:///kid/3) is
// safer for OS-level URL dispatch because "kid" isn't parsed as a host.
const NFC_URL_PATTERN = /^familywallet:\/\/\/?kid\/(\d+)$/;

let started = false;

async function ensureStarted(): Promise<boolean> {
  if (started) return true;
  try {
    const supported = await NfcManager.isSupported();
    if (!supported) return false;
    await NfcManager.start();
    started = true;
    return true;
  } catch {
    return false;
  }
}

export async function isNfcSupported(): Promise<boolean> {
  return ensureStarted();
}

export function nfcUrlForKid(kidId: number): string {
  return `familywallet://kid/${kidId}`;
}

export function parseKidUrl(url: string): number | null {
  const m = NFC_URL_PATTERN.exec(url);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

export type ReadResult =
  | { kind: "match"; kidId: number }
  | { kind: "unrecognized" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

export async function readKidIdOnce(): Promise<ReadResult> {
  const ok = await ensureStarted();
  if (!ok) return { kind: "error", message: "NFC not available" };

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const records: NdefRecord[] = tag?.ndefMessage ?? [];
    for (const rec of records) {
      const url = decodeUri(rec);
      if (!url) continue;
      const id = parseKidUrl(url);
      if (id != null) return { kind: "match", kidId: id };
    }
    return { kind: "unrecognized" };
  } catch (e: unknown) {
    if (isUserCancelError(e)) return { kind: "cancelled" };
    return { kind: "error", message: errMsg(e) };
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // session already closed
    }
  }
}

export async function cancelRead(): Promise<void> {
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    // no active session
  }
}

function decodeUri(rec: NdefRecord): string | null {
  try {
    return Ndef.uri.decodePayload(rec.payload as unknown as Uint8Array);
  } catch {
    return null;
  }
}

function isUserCancelError(e: unknown): boolean {
  return /cancel|user/i.test(errMsg(e));
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
