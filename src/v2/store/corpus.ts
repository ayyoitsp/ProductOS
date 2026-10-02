/**
 * Moving a corpus between a directory and the store, and reading one out of it.
 *
 * ⛔ THE PARSER IS NOT IN HERE. `loadFromStore` fetches bytes and hands them to `loadCorpus`
 * through `memoryStore` — the same path the remote client already takes. PT-0001 is emphatic that
 * the parser stays the only model: a store that parsed for itself would be a second implementation
 * of it, with its own refusals, and the two would disagree about what a corpus says while both
 * reported themselves healthy.
 *
 * ⛔ WHICH ALSO MAKES EXPORT EXACT BY CONSTRUCTION. A row holds the bytes it was given, so writing
 * every row's `source` to its `path` reproduces the corpus byte-for-byte. That is PT-0001's third
 * "done when" — asserted in `test/v2-store.test.mjs`, not hoped for.
 */
import fs from "node:fs";
import path from "node:path";
import { type Corpus, corpusFiles, loadCorpus, memoryStore } from "../load.js";
import type { ProjectStore } from "./access.js";

/**
 * Read a whole corpus out of the store.
 *
 * `root` only labels the paths in `broken` messages and in `Corpus.paths` — ⛔ nothing in here
 * touches a filesystem, so it is a name rather than a location. Defaulting it to the project id
 * means a malformed document reports which project it came from, which is what somebody reading an
 * instance's logs actually needs.
 */
export async function loadFromStore(store: ProjectStore, root = store.projectId): Promise<Corpus> {
  const files = await store.documents();
  return loadCorpus(root, memoryStore(root, files));
}

/**
 * Put a directory's corpus into the store.
 *
 * ⛔ `corpusFiles` DECIDES WHAT A CORPUS IS MADE OF, NOT THIS FUNCTION. It is already the
 * counterpart of `memoryStore` and `load.ts` says they must stay that way — a directory this
 * enumerated for itself is a directory the store silently would not have.
 */
export async function importFromDisk(
  store: ProjectStore,
  root: string,
): Promise<{ imported: string[] }> {
  const files = corpusFiles(root);
  const imported: string[] = [];
  for (const key of Object.keys(files).sort()) {
    await store.put(key, files[key]!);
    imported.push(key);
  }
  return { imported };
}

/**
 * Write the store's corpus out as a directory.
 *
 * ⛔ WRITES `source` VERBATIM — no reformatting, no re-serialising from a parsed model. Round-trip
 * is only byte-identical if nothing on this path has an opinion about how a document should look.
 */
export async function exportToDisk(
  store: ProjectStore,
  root: string,
): Promise<{ written: string[] }> {
  const files = await store.documents();
  const written: string[] = [];
  for (const key of Object.keys(files).sort()) {
    const target = path.join(root, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, files[key]!, "utf-8");
    written.push(key);
  }
  return { written };
}
