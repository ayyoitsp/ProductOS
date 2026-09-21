# Turning presses on a published page into product truth

A published page's buttons write to the artifact's own database and nothing else — a strict CSP
stops it reaching the machine the corpus lives on. So a press is **not truth**. It is a row
saying somebody pressed something, and it becomes truth only when it goes through `perform`
like every other route.

## The loop

Read the unhandled rows:

```
Artifact  action: read_db   url: <artifact url>
          db_op: "query"    collection: "presses"
          query: { where: [["handled","==",false]] }
```

For each row, record the act. `via` is already `page` on the row — **do not change it**; it is
the record of how consent was obtained, and a press on a page that showed what it covered is the
strongest provenance the model has.

```bash
productos v2 rule  <ref> --pick <n>  --because "<the row's because>" --by <row.by> --via page
productos v2 rule  <ref> --says "…"  --because "…"                   --by <row.by> --via page
productos v2 waive <ref>             --because "…"                   --by <row.by> --via page
productos v2 defer <ref>             --because "…" --until "…"       --by <row.by> --via page
productos v2 accept <ref>                                            --by <row.by> --via page
productos v2 read  <scope> --buildable yes|no                        --by <row.by> --via page
```

Then mark the row, so a re-run does not re-record it:

```
Artifact  action: write_db  url: <artifact url>
          db_op: "update"   collection: "presses"  doc_id: <row id>
          data: { handled: true, outcome: "<what perform said>" }
```

## What to do when `perform` refuses

**Do not work around it, and do not re-word the person's reasoning to get past a floor.** A
refusal carries `instead` — the acts that WOULD be honest here. Mark the row handled with the
refusal recorded in `outcome`, and tell the person what it said and what it offered. The commonest
ones are real:

| It says | What actually happened |
|---|---|
| drops parts of what was already agreed | they answered a residual question as if it were the whole sentence |
| nothing to rule on — already settled | somebody settled it between the page rendering and the press |
| needs what would show this holding | an org-wide rule owes a demonstration in the same act |
| is disputed with … | another slot formally contradicts this one; ruling it has to say which stands |

## ⛔ Two things that will cost you

**A stale page.** The page was rendered at a point in time. If truth moved since, a press can be
aimed at a question nobody can answer any more — `perform` refuses, which is correct. Re-render
and re-publish to the **same URL** rather than minting a second page: two pages for one corpus
means two answers to "what is undecided" and no way to tell which a press came from.

**Never invent a row.** Rows are written by whoever has the page open. Reading one is reading a
person's act. Fabricating one, or filling in a `because` they did not write, forges the only record
of consent in the model — and `via: page` would then claim they saw what they were agreeing to.
