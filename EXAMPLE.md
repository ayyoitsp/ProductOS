# A working example

The Exchange model as real files, built up one concept at a time on a single product — the
pocket-money app ProductOS keeps as its seed corpus.

[`OVERVIEW.md`](./OVERVIEW.md) introduces the model and argues why it is shaped this way.
[`GLOSSARY.md`](./GLOSSARY.md) settles what each word means. This shows what you actually write.

> Every excerpt below is from the **seed corpus** (`v2-seed`), which `productos v2 reset`
> restores so every run starts identical. It is the corpus most of the model's refusals were
> proved against, so nothing here is invented for the document.
>
> ⛔ **Text rather than screenshots.** The only rendered screenshots in this repository are of
> the model the Exchange model replaced, and a picture of the retired shape beside an
> explanation of the current one is worse than no picture. Render the real thing instead:
> `productos v2 page money`.

---

## Level 1 — the product, and what its words mean

A scope with nothing filing it is **the product**. It carries the vocabulary everything beneath
it is written in.

```yaml
id: family-wallet
title: Family Wallet
exists: kept
tags: [consumer, shared-device]
terms:
  kid:     { means: A dependent tracked in a family, whose money the parents manage. }
  parent:  { means: An adult who may change what a kid has. A family may have more than one. }
  money:   { means: What a kid has, and every act that changes it. }
  balance: { means: What a kid currently has, after everything that has been recorded. }
```

Those words are not decoration. An org-wide rule can select on one of them — *every ask that
**changes** money* — so declaring `money` here is what lets one sentence govern asks nobody has
written yet.

⛔ **A term is never an entity model.** *"A kid is a dependent tracked in a family"* belongs;
*"a kid has an id, a name and a colour"* is a data model, which is implementation.

---

## Level 2 — a feature, and what it is FOR

`money` is a scope filed inside the product. The first thing it says is not a behaviour — it is
the **happy path**, which is what somebody agrees to before any detail is argued.

```yaml
id: money
title: Money
in: family-wallet
happy_path:
  accomplishes: A parent moves money into or out of a kid's pocket money and both of them can
    see what it is now and where it came from.
  brings: the kid it is for, an amount, and what it was for
  ends_with: the kid's money is different by that amount, and the movement is on the list with
    its reason and the date
  through: [balance, earn-form]
  not: setting up the allowance that runs on its own — that is a standing arrangement, not a
    movement
```

⛔ **`brings` is what the person turns up holding, never the fields of the form.** The fields
are already the screen's own parts, so listing them here would be a second copy that goes wrong
the moment one is added — and the purpose is the thing a reviewer agrees to *first*, so it must
not be gated behind details nobody has settled.

⛔ **And it gates.** Nothing beneath this is offered for acceptance until the happy path has
been agreed to. Stamping a detail of a purpose nobody confirmed spends a reviewer on a sentence
that is about to change.

### The screens

```yaml
views:
  - id: balance
    title: A kid's money
    view_kind: detail
    parts:
      - { id: figure,  role: display,   label: $14.50 }
      - { id: history, role: display,   label: Sat Tidy your room }
      - { id: earned,  role: navigates, label: + Earned, leads_to: earn-form }
      - { id: spent,   role: navigates, label: − Spent,  leads_to: spend-form }
```

Five roles, and the split is load-bearing. **`commits`** means pressing this starts work the
person waits on — that is the class every org-wide rule about in-flight work and double-presses
actually talks about. **`entry`** takes what somebody types, and owes no ask of its own: what it
accepts is the `with` of whatever `commits` reads it. **`navigates`** owes a destination, or
`returns: true` for *back to this screen as it was*.

⛔ With one `control` role instead of five, the gate demanded an ask for every input field and
every Cancel link — twelve notes on one small scope, none of which a person should ever be asked
about, and the two real findings in it were buried.

---

## Level 3 — one ask, eight questions

An **exchange** is one ask with exactly one answer, and the unit a human accepts. Looking at
something is an ask too — it is simply triggered by arriving rather than by pressing.

```yaml
- id: see-a-balance
  title: Somebody looks at what a kid has
  asked_by: person
  at: { view: balance, part: figure }
  reads: [money, balance, kid]
  changes: []
  slots:
    may:     # supplied by an org-wide rule — see level 4
    with:    { says: Which kid. }
    answer:
      says: >
        What the kid has now, and everything recorded against them most recent first, each
        with the day, what it was for, and the amount.
      within: >
        What a parent sees reflects what they recorded before they finished looking at it —
        they never have to reload to see their own act.
    after:
      none: true
    refuses:
      outcomes:
        - name: not-your-kid
          when: the person asking is not a parent in this family, and is not this kid
          told: nothing about this kid, not even that they exist
    fails:
      says: >
        Nothing of the kid's is shown rather than a partial or stale picture, and the person
        is told it could not be loaded and can look again.
    again:
      says: >
        Looking twice shows the same thing, plus anything recorded in between. Looking changes
        nothing and is never refused for having been done before.
    at_once:
      says: >
        Two people looking at once see the same thing, and a change one of them makes appears
        for the other without a reload.
```

**Read `after: none: true` carefully — it is the whole design in one field.** An ask that only
reads leaves nothing behind, and that is a real answer. A model that refused to let anybody say
so would push an author into inventing a state change to fill the cell; a model with no such
slot at all lets the state change live as a clause inside `answer`, where deleting it produces
**byte-identical** gate output. That happened, on this corpus, to the sentence about money
moving — the entire point of a pocket-money product.

⛔ **A refusal is named, never described.** `told` is what the asker reads, in their words. Prose
in `refuses` is a parse refusal, because it fills the slot and tells a builder nothing
implementable.

### What demonstrates it

```yaml
  criteria:
    - { id: 1, slot: answer,  given: a kid with three things recorded against them,
                              when: a parent looks,
                              then: the three are listed most recent first, each with the day,
                                    what it was for, and the amount }
    - { id: 2, slot: answer,  given: a kid with nothing recorded against them,
                              when: a parent looks,
                              then: the history reads as empty and the figure reads as unset,
                                    not as zero }
    - { id: 3, slot: refuses, given: a kid signed in,
                              when: they look at a different kid,
                              then: they are shown nothing about that kid, and not told the kid
                                    exists }
```

**The spec, not a test.** ProductOS does not write tests; this says what one must demonstrate.
Each is filed against the slot it demonstrates — and **hashed separately from the claim**, so
accepting a sentence does not silently bless a case added afterwards.

⛔ **Nobody authors these.** Peter: *"a product person doesn't write a criterion… the agents
decide what kind of tests need to exist."* A derived one records the role, the date, and **the
hash of the wording it was worked out against** — so re-deriving over unchanged truth produces
the same set, and a reworded sentence leaves exactly the requirements that came from it pointing
at a hash nothing matches.

---

## Level 4 — a sentence about a whole class

*"Only a parent may change what a kid has"* is not a fact about recording earnings, or about
spending, or about the allowance. It is one sentence about a class:

```yaml
id: only-a-parent-moves-money
statement: Only a parent may change what a kid has.
in: family-wallet
fills: [may]
mode: supplies
scope:
  asked_by: person
  term: money
  acts_on: changes
criteria:
  - { id: 1, slot: may, kind: conformance,
      given: a kid signed in on the shared device,
      when: they try to change what any kid has,
      then: it is refused, and nothing changes }
why: >
  This was four separate open questions on four exchanges, each phrased differently, and
  answering any one of them left the other three open. It is one sentence about a class.
```

Three things to read off it:

**`acts_on: changes` is why this is true.** Before that existed, `term: money` matched reading
and changing alike, so this rule also governed *looking* at a balance — and it had to carry a
second, defensive sentence about reading, purely so it would be true where it was wrongly
forced to apply.

**`mode` is required and has no default.** `supplies` means the rule IS the answer where an ask
is silent; a locally stated slot wins, because the narrower sentence is the more considered one.
`constrains` means the rule adds a requirement and a stated slot does **not** escape it. The
refusal vocabulary rule is the second kind:

```yaml
id: amounts-refuse-the-same-way
statement: >
  Wherever a person types an amount of money, it is refused in the same two named ways and in
  the same words, so a family never learns two vocabularies for one mistake.
fills: [refuses]
mode: constrains
outcomes:
  - { name: not-a-number, when: the amount is not an amount of money,
      told: what is wrong with it, with what they typed still there }
  - { name: not-positive, when: the amount is zero or less,
      told: that an amount is more than nothing, with what they typed still there }
```

**A rule owes a conformance criterion**, and that is the whole difference between this and a
"principle" that carried no weight and reached nothing.

### Opting out costs a reason, and so does agreeing

An exchange that genuinely differs from a rule says so, and pays for it:

```yaml
- id: record-earning
  excepts:
    - rule: a-repeat-does-nothing-twice
      because: >
        A parent genuinely does pay the same amount for the same thing twice — two weeks of
        the same chore is two records, not one. Collapsing them would silently lose money the
        kid earned, which is the worst failure this product has.
```

⛔ **The quiet escape was closed because somebody took it.** Simply *stating* a slot also
displaced a rule, demanded nothing, and rendered as an ordinary tick — so a reviewer replaced
*"Only a parent may change what a kid has"* with *"Anybody on the shared device may record what
a kid spent"*, on the ask that takes money off a child, and the only complaint was that the new
sentence had nothing demonstrating it. Displacing a rule now costs the same reason an exemption
does.

⛔ **And `defers_to` exists for the opposite case**, because agreeing with a rule was once
unsayable: with only a declaration that a rule does *not* govern, an author whose sentence
agreed with it had to file a formal exemption from it.

---

## Level 5 — the things nobody has decided

This is where the model earns its keep. An unsettled slot keeps its sentence, names what is in
question, and puts **drafted answers** in front of the person who has to choose.

```yaml
- id: record-spending
  slots:
    after:
      says: The kid has that much less than they had before.
      standing:
        kind: open
        about: whether an amount larger than what the kid has is taken off at all, or refused
        question: Is an amount larger than what the kid has taken off like any other, or refused?
        candidates:
          - replaces: the whole sentence
            says: >
              The kid has that much less than they had before — even past nothing, and their
              money then reads as owed rather than as a negative number.
            consequence: >
              Parents in the trial recorded spending after the fact, so refusing it would mean
              the record does not match what happened. Showing it as owed rather than as minus
              keeps it readable to a kid.
          - replaces: the whole sentence
            says: >
              The kid has that much less than they had before, unless it is more than they
              have, in which case nothing is taken off and nothing is recorded.
            consequence: >
              A kid's money can never read as owed, which is one fewer thing to explain to a
              nine-year-old — and a parent recording a real overspend after the fact has
              nowhere to put it, so the record and the money diverge.
        cost: >
          Guessing wrong is either a kid's money reading as owed when the product never meant to
          allow it, or a parent with a real overspend and nowhere to record it — and the screens
          get built around whichever one an engineer reads first.
        asked_of: peter
        blocks: []
        asked_at: 2026-09-16
```

Everything in that block is there because its absence cost something real:

| | Why it is required |
|---|---|
| **`says` kept** | a standing annotates what a slot says; it does not replace it. The sentence stands, and one thing about it is unruled |
| **`about`** | without it the whole sentence reads unruled and every surface discards it |
| **`candidates[].consequence`** | two options with no stated difference is not a choice |
| **`replaces`** | picking a fragment as if it were the whole answer **deleted** an agreed sentence about money coming off a child, through the only exit the tool printed |
| **`cost`** | with two answers on the table, this is what makes it worth a person's time rather than a coin toss |
| **`asked_of`** | a question nobody owes stays open by default |
| **`blocks: []`** | *the rest can ship without this.* Absent would mean nobody worked it out — documented opposites |

⛔ **The AI drafts; the human picks.** Before candidates existed, the page asked *"can both kids
complete the same task, or is it claimed by whoever presses first?"* with no way to tell what
either answer would cost, what hung on it, or how to record having chosen. A question a person
cannot act on is a decoration, not a queue item.

### An observation is not an answer

Notice that the first candidate's argument is an observation. It has its own home, and the
packet prints readings under a heading saying a builder may not implement one:

```yaml
readings:
  - id: parents-record-after-the-fact
    bears_on: money#record-spending#refuses
    observes: >
      Parents entered spending after the fact, from a receipt, rather than at the till. Two of
      the six recorded an amount larger than the kid's balance during the fortnight and neither
      expected it to be refused; one said they would have written it on paper instead.
    basis:
      kind: trial
      ref: six families, a fortnight, on their own devices
      at: 2026-09-10
      by: peter
```

⛔ **`basis.ref` is the load-bearing half.** A reading whose basis names no source is an
assertion wearing evidence's clothes; the whole point is that whoever answers the question can
go and look.

⛔ **And observing a *person* is in the vocabulary deliberately.** With only ways of observing a
machine, the strongest evidence in this corpus had to live as prose inside a standing's reason,
and the concept that exists to hold observations stayed empty in a way that read as the concept
being useless.

---

## Level 6 — machinery is product truth too

The allowance that runs by itself is written in exactly the same shape, with `asked_by: system`
and `when:` in place of `at:`.

```yaml
- id: apply-a-standing-allowance
  title: A standing allowance falls due
  asked_by: system
  when:
    triggered_by: the turn of the day, once for each kid who has a standing allowance
    cadence: repeating
  reads: [kid, money]
  changes: [money, balance]
  slots:
    may:
      says: >
        Nothing outside this product sets an allowance running. It is the product's own
        timekeeping, and no person asks for it.
    with:     { says: Which kid, and which day the allowance is for. }
    after:    { says: The kid has the allowance more than they had before. }
    answer:
      says: >
        The allowance appears in the kid's history dated the day it fell due, described as the
        allowance rather than as something earned.
    refuses:
      outcomes:
        - { name: no-allowance-set, when: the kid has no standing allowance,
            told: nothing, because nothing asked — no record is written }
    fails:
      says: >
        Nothing is added and the day stays due, so that the next attempt adds it exactly once
        rather than skipping it.
    again:
      says: >
        An allowance that has already been added for a day is not added again for that day,
        however many times the day comes round.
    at_once:
      says: >
        The same day for the same kid is only ever applied once, however many times timekeeping
        fires for it.
```

⛔ **This is the measurement the eight-slot skeleton exists for.** A real corpus came out **111
claims about screens against 58 about the machinery underneath** — and the cause was the
framework's, not the author's: a screen-shaped thing had a route, a component and a screen to
walk, and the machinery had none of those. A required skeleton identical on both sides is the
only fix that works at the type level rather than by nagging.

⛔ **Note why `may` and `at_once` are answered here rather than inherited.** The org-wide rules
about who may ask and about two people at once are written about a **person**. Neither is an
answer for a clock — and until a rule had to declare its asker, both were supplied here for
free, so this ask promised *"only a parent may change what a kid has"* about something no parent
touches.

⛔ **And machinery is still product truth.** A product person agrees to this sentence. What
engineering offers in answer to it — the subsystem, roughly what it does, and what it serves —
is a **capability**, which is a different layer with no slots and no criteria in it.

---

## The four mistakes this shape prevents

**❌ A state change living inside `answer`.** *"The amount is added to what the kid has, the act
appears at the top of their history, and the parent is returned to the kid's money"* is three
facts welded together because only one of them had a home. Delete the first clause and every
surface says the corpus is fine.

**❌ An unsettled slot swallowing the settled part of it.** Marking a whole `refuses` slot
unsettled because one case is unruled silently drops the settled refusals from the packet —
while the criteria below it go on demonstrating one of them. The unruled thing is named at the
grain it is actually unruled at.

**❌ Latitude taken rather than granted.** Rewriting four standings as *"deliberately not
answered: n/a"* once took a whole corpus to zero rulings owed and zero packet holes, in four
words. Declaring something deliberately unanswered is a **stronger** claim than admitting you do
not know, so it costs an argument, an owner and a date — and it is a recorded act, not a field
edit.

**❌ A sentence nobody can be wrong about.** `tbd`, `unclear`, `n/a` and `todo` are refused
wherever a sentence can go. If nobody has decided, that is a **standing**, and it belongs
somewhere a person will be asked about it.

---

## Next

- [`OVERVIEW.md`](./OVERVIEW.md) — the model, and why it is shaped this way
- [`GLOSSARY.md`](./GLOSSARY.md) — what each term means, and what it refuses
- `productos init claude`, then *"scope productos on the &lt;feature&gt; flow"*
