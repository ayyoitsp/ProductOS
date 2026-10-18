/**
 * ⛔ WHERE AN AUTHOR'S WORK LANDS — ONE HOME, GENERATED INTO EVERY AUTHOR'S BRIEF.
 *
 * Peter: *"there should be no 'local corpus'... always hosted server"*.
 *
 * Every author's brief described writing `truth/<scope>.md` into a corpus directory, and the only
 * documented way from a directory into a hosted project was `productos hosted import`, an operator
 * command that needs the database address. An author session holds the hosted MCP server and a
 * token and nothing else — so it did its work, wrote it to disk, and the product never saw it.
 *
 * The door already took a whole document. What was missing was every author being told so, and
 * being handed the door at all (`write-corpus` mapped to `Write` and `Edit` only).
 *
 * ⛔ GENERATED, NOT PASTED INTO NINE PROMPTS. Nine hand copies of one paragraph cannot all be kept
 * right, so they are kept right for none. This is the paragraph; `productos v2 agents --presets`
 * writes it between markers into every member of `AUTHORS`, and a test fails when one drifts or a
 * new author arrives without it. The intents it lists are read off `INTENTS`, so a new small write
 * reaches every author without anybody remembering to tell them.
 */
import { INTENTS } from "../v2/intents.js";

export const DOOR_OPEN = "<!-- productos:where-you-write -->";
export const DOOR_CLOSE = "<!-- /productos:where-you-write -->";

/** The door's own words for a field, so this section cannot describe a field differently from it. */
const fieldOf = (intent: string, field: string): string =>
  INTENTS.find((i) => i.name === intent)?.takes.find((f) => f.name === field)?.says ?? "";

export function whereAnAuthorWrites(): string {
  const doc = INTENTS.find((i) => i.name === "document");
  if (!doc) throw new Error("the door no longer takes a whole document — an author has nowhere to land its work");
  /** ⛔ Every other write an author's authority reaches, so a one-sentence change is not a whole document. */
  const small = INTENTS.filter((i) => i.gate === "author" && i.name !== "document");
  /** ⛔ And what it may never send, named, because "nothing you write is agreed" is checkable only by name. */
  const consent = INTENTS.filter((i) => i.gate === "consent").map((i) => `\`${i.name}\``);

  const out: string[] = [DOOR_OPEN];
  out.push("## ⛔ Where your work lands — the hosted project, through one door");
  out.push("");
  out.push("> Generated — do not edit between the markers. `productos v2 agents --presets` rewrites it, and a test fails if it drifts.");
  out.push("");
  out.push(
    "**There is no local corpus.** The truth lives in the hosted project, and you reach it through " +
      "ProductOS's MCP server. Every document you write goes there, straight, one call per document:"
  );
  out.push("");
  out.push("```");
  out.push('productos_in { intent: "document", fields: { key: "truth/<scope>.md", says: "<the whole document>" } }');
  out.push("```");
  out.push("");
  out.push(
    `- **\`key\`** — ${fieldOf("document", "key")}. Root-level \`.yaml\` documents (\`prototypes.yaml\`, ` +
      `\`style.yaml\`, \`framework-gaps.yaml\`) are keys too. The paths in this brief are keys, not places on disk.`
  );
  out.push(
    `- **\`says\`** — ${fieldOf("document", "says")}. Send all of it: a partial document deletes the rest.`
  );
  out.push(
    "- **Then read it back.** `productos_exchange_check` says what the project now refuses. A refusal is " +
      "yours to fix with another `document` call — never work around one, and never report work landed " +
      "that the check refuses."
  );
  out.push(
    "- **Never keep a local copy as the truth.** A file you draft on disk is scratch: it is not in the " +
      "product until the door answered `ok`, and once it has, the hosted one is the only one. Do not hand " +
      "anybody a directory to import — importing is an operator's command, and it needs a database " +
      "address no author holds."
  );
  out.push(
    "- **A generator pushes the same way.** Where a command draws for you, point it at the instance: " +
      "`productos v2 draw --all --into <project url> --token $PRODUCTOS_TOKEN`."
  );
  out.push("");
  out.push("**A small change is a small write.** One sentence or one question is not a whole document:");
  out.push("");
  for (const i of small)
    out.push(
      `- \`productos_in { intent: "${i.name}" }\` — ${i.does}. Takes ${i.takes
        .map((f) => (f.required ? `\`${f.name}\`` : `\`${f.name}\`?`))
        .join(", ")}.`
    );
  out.push("");
  out.push(
    "Call `productos_intents` when a field is unclear — it is generated from the same registry as the door. " +
      "⛔ **Nothing you write is agreed.** Your token carries an author's authority: your own words, claiming " +
      `nothing about what anybody agreed to. ${consent.join(", ")} are a person's acts: your token cannot record one as a person's, and one recorded \`via: agent\` counts as nobody's agreement.`
  );
  out.push(DOOR_CLOSE);
  return out.join("\n");
}

/**
 * A brief with its section current.
 *
 * ⛔ BETWEEN MARKERS, NEVER THE WHOLE FILE — the rest of a brief is hand-authored. Where no markers
 * exist yet it goes directly before the first `##` heading, so an author meets where its work lands
 * before it meets what the work is.
 */
export function withWhereAnAuthorWrites(body: string): string {
  const block = whereAnAuthorWrites();
  const open = body.indexOf(DOOR_OPEN);
  if (open !== -1) {
    const close = body.indexOf(DOOR_CLOSE, open);
    if (close === -1) throw new Error("the brief's where-you-write block was opened and never closed");
    return body.slice(0, open) + block + body.slice(close + DOOR_CLOSE.length);
  }
  const heading = /^## /m.exec(body);
  if (!heading) return `${body.trimEnd()}\n\n${block}\n`;
  return `${body.slice(0, heading.index)}${block}\n\n${body.slice(heading.index)}`;
}
