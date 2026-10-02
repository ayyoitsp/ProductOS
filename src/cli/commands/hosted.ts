/**
 * Operating a hosted instance: accounts, projects, tokens, and getting a corpus in and out.
 *
 * ⛔ THIS TALKS TO THE STORE, NOT TO THE HTTP API, AND THAT IS DELIBERATE.
 *
 * Every route on the instance requires a credential, and a credential is a row in the store — so an
 * operator tool that had to authenticate in order to create the first account could never create
 * it. Provisioning is the one job that legitimately sits below the auth boundary, which is also why
 * it needs `DATABASE_URL` and not a token: holding the connection string IS the authorization, and
 * anybody who has it already owns the data.
 *
 * ⛔ IT CANNOT RECORD A VERDICT AND HAS NO PATH TO ONE. Nothing in here calls `perform`, and the
 * absence is the point: a provisioning tool that could stamp agreement would be a way to mint human
 * consent from a shell, which is the one thing the whole design refuses.
 *
 * Without this, `docker compose up` leaves an instance with no accounts, no projects, and no way to
 * make either except a hand-written script — which is not a local setup, it is a demo somebody
 * performed once.
 */
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { storeFor, isRefusal, type Db } from "../../v2/store/access.js";
import { accountFor, issueToken, revokeToken, singleAccount } from "../../v2/store/identity.js";
import { createProject, projectBySlug } from "../../v2/store/instance.js";
import { exportToDisk, importFromDisk, loadFromStore } from "../../v2/store/corpus.js";
import { migrateStore, openStore, rowsOf } from "../../v2/store/server.js";
import { projects, tokens } from "../../v2/store/schema.js";
import { eq, sql } from "drizzle-orm";

interface Opened {
  db: Db;
  close: () => Promise<void>;
}

/**
 * ⛔ REFUSES RATHER THAN GUESSING A CONNECTION STRING. A default would point an operator at a local
 * Postgres while they believed they were editing production, or the reverse — and both are
 * discovered after the write.
 */
function open(opts: { db?: string }): Opened {
  const url = opts.db ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "no store to talk to. Pass --db <url> or set DATABASE_URL.\n" +
        "  ⛔ There is no default on purpose: a guessed connection string is how somebody edits the " +
        "wrong instance and finds out afterwards.\n" +
        "  For the compose stack: --db postgres://productos:productos@localhost:5432/productos",
    );
  }
  return openStore(url);
}

const randomId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

/** ⛔ Every command runs through here, so none of them can forget to close the pool. */
async function withStore<T>(opts: { db?: string }, work: (db: Db) => Promise<T>): Promise<T> {
  const { db, close } = open(opts);
  try {
    return await work(db);
  } finally {
    await close();
  }
}

const die = (e: unknown): never => {
  console.error(pc.red("✗"), (e as Error).message);
  process.exit(1);
};

export function hostedCommand(): Command {
  const hosted = new Command("hosted")
    .description("Operate a hosted instance: accounts, projects, tokens, and corpus in/out")
    .addHelpText(
      "after",
      `
${pc.bold("Against the compose stack")}
  export DATABASE_URL=postgres://productos:productos@localhost:5432/productos
  productos hosted doctor
  productos hosted project new wallet --as me@localhost
  productos hosted import ./v2 --into <project-id>
  open http://localhost:4100/p/<project-id>/

${pc.dim("⛔ Needs DATABASE_URL, not a token: creating the first credential cannot require one.")}
`,
    );

  const db = (c: Command): Command => c.option("--db <url>", "store connection string (default $DATABASE_URL)");

  // -------------------------------------------------------------------------

  db(
    hosted
      .command("doctor")
      .description("Can the store be reached, is the schema current, and what is in it")
      .action(async (opts: { db?: string }) => {
        try {
          await withStore(opts, async (d) => {
            const migrated = await migrateStore(d);
            console.log(pc.green("✓"), "store reachable");
            console.log(
              "  migrations:",
              migrated.applied.length
                ? pc.yellow(`applied ${migrated.applied.join(", ")}`)
                : pc.dim(`up to date (${migrated.skipped.length})`),
            );

            const counts = await Promise.all(
              ["accounts", "projects", "tokens", "documents", "events"].map(async (t) => {
                const rows = rowsOf<{ n: string }>(await d.execute(sql.raw(`select count(*) as n from ${t}`)));
                return `${t}: ${rows[0]?.n ?? "?"}`;
              }),
            );
            console.log(" ", counts.join("  ·  "));
          });
        } catch (e) {
          die(e);
        }
      }),
  );

  db(
    hosted
      .command("projects")
      .description("Every project in the store, with its owner and how much it holds")
      .action(async (opts: { db?: string }) => {
        try {
          await withStore(opts, async (d) => {
            const rows = await d
              .select({ id: projects.id, slug: projects.slug, name: projects.name, owner: projects.ownerId })
              .from(projects);
            if (!rows.length) {
              console.log(pc.dim("no projects yet —"), "productos hosted project new <slug> --as <email>");
              return;
            }
            for (const r of rows) {
              const store = await storeFor(d, { kind: "browser", account: r.owner, reach: [] }).project(r.id);
              const docs = isRefusal(store) ? 0 : Object.keys(await store.documents()).length;
              console.log(`${pc.bold(r.id)}  ${r.slug}  ${pc.dim(r.name)}`);
              console.log(`  owner ${r.owner} · ${docs} documents`);
            }
          });
        } catch (e) {
          die(e);
        }
      }),
  );

  const project = hosted.command("project").description("Create or inspect one project");

  db(
    project
      .command("new <slug>")
      .description("Create a project owned by an account, creating the account if it is new")
      .requiredOption("--as <email>", "the account that will own it")
      .option("--name <name>", "human name (defaults to the slug)")
      .option("--repo <label>", "⛔ a label only — ProductOS holds no repo token and clones nothing")
      .action(
        async (
          slug: string,
          opts: { as: string; name?: string; repo?: string; db?: string },
        ) => {
          try {
            await withStore(opts, async (d) => {
              const owner = await accountFor(d, opts.as);
              /** ⛔ Slug is unique per owner, so this is the one collision worth catching early. */
              if (await projectBySlug(d, owner, slug)) {
                throw new Error(`${opts.as} already has a project slugged "${slug}" — slugs are unique per owner`);
              }
              const id = randomId("prj");
              await createProject(d, { id, owner, slug, name: opts.name ?? slug, repoLabel: opts.repo });
              console.log(pc.green("✓"), `project ${pc.bold(id)} (${slug}) owned by ${opts.as}`);
              console.log(pc.dim("  address it as"), `/p/${id}/`);
              console.log(pc.dim("  ⛔ the id is the address; the slug is a human alias and can change"));
            });
          } catch (e) {
            die(e);
          }
        },
      ),
  );

  const token = hosted.command("token").description("Issue or revoke what something automated holds");

  db(
    token
      .command("new")
      .description("Issue a token. ⛔ Printed once and stored only as a hash")
      .requiredOption("--as <email>", "the account it acts for")
      .option("--actor <name>", "what the audit trail calls it", "a session")
      .option("--scopes <list>", "comma-separated: read,author,relay", "read,author,relay")
      .option("--for <projectIds>", "comma-separated project ids. ⛔ Narrows; it can never widen")
      .action(
        async (opts: { as: string; actor: string; scopes: string; for?: string; db?: string }) => {
          try {
            await withStore(opts, async (d) => {
              const account = await accountFor(d, opts.as);
              const scopes = opts.scopes.split(",").map((s) => s.trim()).filter(Boolean);
              const reach = opts.for?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
              const issued = await issueToken(d, { account, actor: opts.actor, scopes, reach });

              console.log(pc.green("✓"), `token ${issued.id} for ${opts.as} as "${opts.actor}"`);
              console.log();
              console.log(`  ${pc.bold(issued.token)}`);
              console.log();
              console.log(pc.yellow("  ⛔ Shown once. The store keeps only a hash of it."));
              console.log(pc.dim("  scopes:"), scopes.join(" · ") || pc.red("none — it can do nothing"));
              if (reach.length) console.log(pc.dim("  reach:"), reach.join(" · "));
              console.log(
                pc.dim("  ⛔ No scope here can record agreement — a person has to press. See identity.ts"),
              );
            });
          } catch (e) {
            die(e);
          }
        },
      ),
  );

  db(
    token
      .command("list")
      .description("Tokens the store honours, and when each was last used")
      .action(async (opts: { db?: string }) => {
        try {
          await withStore(opts, async (d) => {
            const rows = await d
              .select({
                id: tokens.id,
                actor: tokens.actor,
                account: tokens.accountId,
                scopes: tokens.scopes,
                reach: tokens.reach,
                lastUsedAt: tokens.lastUsedAt,
                revokedAt: tokens.revokedAt,
              })
              .from(tokens);
            if (!rows.length) return console.log(pc.dim("no tokens issued"));
            for (const r of rows) {
              const state = r.revokedAt ? pc.red("revoked") : pc.green("live");
              /** ⛔ So a forgotten token is visible rather than merely still valid. */
              const used = r.lastUsedAt ? `last used ${r.lastUsedAt.toISOString()}` : pc.yellow("never used");
              console.log(`${pc.bold(r.id)}  ${state}  "${r.actor}"  ${r.account}`);
              console.log(`  ${(r.scopes ?? []).join(" · ")} · ${used}${r.reach?.length ? ` · reach ${r.reach.join(",")}` : ""}`);
            }
          });
        } catch (e) {
          die(e);
        }
      }),
  );

  db(
    token
      .command("revoke <id>")
      .description("Stop honouring a token. The row stays, so the audit trail does too")
      .action(async (id: string, opts: { db?: string }) => {
        try {
          await withStore(opts, async (d) => {
            const [existing] = await d.select({ id: tokens.id }).from(tokens).where(eq(tokens.id, id));
            if (!existing) throw new Error(`no token ${id}`);
            await revokeToken(d, id);
            console.log(pc.green("✓"), `${id} revoked`);
          });
        } catch (e) {
          die(e);
        }
      }),
  );

  db(
    hosted
      .command("import <dir>")
      .description("Put a corpus directory into a project")
      .requiredOption("--into <projectId>", "the project to import into")
      .action(async (dir: string, opts: { into: string; db?: string }) => {
        try {
          await withStore(opts, async (d) => {
            if (!fs.existsSync(dir)) throw new Error(`no directory at ${path.resolve(dir)}`);
            const store = await reach(d, opts.into);
            const { imported } = await importFromDisk(store, dir);
            const corpus = await loadFromStore(store);
            console.log(pc.green("✓"), `${imported.length} documents into ${opts.into}`);
            console.log(
              " ",
              `${corpus.scopes.length} scopes · ${corpus.rules.length} rules · ${corpus.verdicts.length} verdicts`,
            );
            /** ⛔ A corpus that would not parse must say so here, not on somebody's first page load. */
            if (corpus.broken.length) {
              console.log(pc.yellow(`  ⚠ ${corpus.broken.length} document(s) would not parse:`));
              for (const b of corpus.broken.slice(0, 5)) console.log(`    ${b.file} — ${b.why.split("\n")[0]}`);
            }
          });
        } catch (e) {
          die(e);
        }
      }),
  );

  db(
    hosted
      .command("export <projectId>")
      .description("Write a project's corpus out as a directory. ⛔ Byte-identical to what went in")
      .requiredOption("--to <dir>", "where to write it")
      .action(async (projectId: string, opts: { to: string; db?: string }) => {
        try {
          await withStore(opts, async (d) => {
            const store = await reach(d, projectId);
            const { written } = await exportToDisk(store, opts.to);
            console.log(pc.green("✓"), `${written.length} documents to ${path.resolve(opts.to)}`);
          });
        } catch (e) {
          die(e);
        }
      }),
  );

  db(
    hosted
      .command("session")
      .description("A browser session for one account — what single-account mode uses locally")
      .requiredOption("--as <email>", "the account")
      .action(async (opts: { as: string; db?: string }) => {
        try {
          await withStore(opts, async (d) => {
            const { session, account } = await singleAccount(d, opts.as);
            console.log(pc.green("✓"), `session for ${opts.as} (${account})`);
            console.log(`  ${pc.bold(session)}`);
            console.log(pc.dim("  curl -b"), `productos_session=${session}`, pc.dim("http://localhost:4100/p/<id>/"));
            console.log(
              pc.dim("  ⛔ This is what makes `via: page` provable — a token can never stand in for it."),
            );
          });
        } catch (e) {
          die(e);
        }
      }),
  );

  return hosted;
}

/**
 * The project accessor, or a readable failure.
 *
 * ⛔ GOES THROUGH `storeFor` LIKE EVERY OTHER CALLER. An operator tool is exactly where somebody
 * would be tempted to reach past the isolation seam "just for provisioning", and then the one place
 * documents can be touched without naming a project is the place nobody tests.
 */
async function reach(d: Db, projectId: string) {
  const [row] = await d.select({ owner: projects.ownerId }).from(projects).where(eq(projects.id, projectId));
  if (!row) throw new Error(`no project ${projectId} — productos hosted projects`);
  const store = await storeFor(d, { kind: "browser", account: row.owner, reach: [] }).project(projectId);
  if (isRefusal(store)) throw new Error(store.why);
  return store;
}
