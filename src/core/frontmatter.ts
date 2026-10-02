import matter from "gray-matter";

/**
 * ⛔ PARSE FRONTMATTER HERE, NEVER `matter(raw)` DIRECTLY — ITS CACHE SHARES ONE MUTABLE OBJECT
 * BETWEEN EVERY FILE WITH IDENTICAL CONTENT.
 *
 * `gray-matter` keys a cache on the file's content and, on a hit, returns
 * `Object.assign({}, cached)` — a SHALLOW copy, so `data` is the same object every time
 * (`node_modules/gray-matter/index.js:35-47`). Every write path in this codebase is
 * read-modify-write on `data`, so two files that happen to hold the same bytes share one parsed
 * object and a mutation to either is visible through both.
 *
 * How it surfaced: a ruling applied to one corpus made a second, untouched copy of the same seed
 * report the slot as settled — while the second copy's file on disk still said `open`. So a read
 * could return state that no file anywhere contained. It was found by a test comparing two copies
 * of one corpus, which is exactly the reset-and-compare workflow the review loop depends on, and
 * the same hazard applies to any two identical files inside a single corpus.
 *
 * Passing ANY options object skips both the cache read and the cache write — gray-matter declines
 * to cache when options are present because it would have to key on them too. `{}` therefore means
 * "identical parse, no shared state", which is why it is named rather than inlined.
 */
const NO_CACHE = {};

export function parseFrontmatter(raw: string): matter.GrayMatterFile<string> {
  return matter(raw, NO_CACHE);
}
