import { getDb } from "@/db";
import { RemoteStore } from "./remote";
import { SqliteStore } from "./sqlite";
import { Store } from "./types";

/**
 * Default: remote (backend-driven). Set EXPO_PUBLIC_USE_REMOTE=false (or 0)
 * in the env to fall back to the on-device SQLite store.
 */
function pickMode(): "sqlite" | "remote" {
  const raw = process.env.EXPO_PUBLIC_USE_REMOTE;
  if (raw === undefined) return "remote";
  const v = raw.toLowerCase();
  if (v === "false" || v === "0" || v === "no") return "sqlite";
  return "remote";
}

export const STORE_MODE = pickMode();

let _store: Store | null = null;
export function store(): Store {
  if (_store) return _store;
  _store = STORE_MODE === "remote" ? new RemoteStore() : new SqliteStore();
  return _store;
}

/**
 * Resolves once the store is ready to take queries. Sqlite mode opens + migrates
 * the local DB; remote mode is a no-op.
 */
export async function initStore(): Promise<void> {
  if (STORE_MODE === "sqlite") {
    await getDb();
  }
}

export type { Store } from "./types";
