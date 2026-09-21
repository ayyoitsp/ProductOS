# The foil — a corpus that must never pass

⛔ **Every file here is deliberately wrong, and `productos v2 check --at v2-foil` must refuse
it.** `test/v2-check.test.mjs` asserts which findings fire, so a detector cannot be deleted
or quietly narrowed without a test going red.

That test exists because it happened. Twice in one session a block of `check.ts` was spliced
out while restructuring something next to it, and both times the only symptom was the note
count dropping — which reads like progress. A framework whose whole claim is that it refuses
things needs its refusals pinned by something other than a person noticing a smaller number.

Each case below names the attack that produced it. They came from reviewers who were given
the corpus and told to make it lie; none of them had to try hard.
