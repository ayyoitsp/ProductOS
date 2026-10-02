---
id: reaches-nothing
statement: >
  A rule whose selector matches no exchange in this corpus, so it governs nothing while
  appearing in the rule list as though it did.
in: foil
fills: [answer]
mode: supplies
scope:
  asked_by: person
  tag: a-tag-nothing-carries
criteria:
  - id: 1
    slot: answer
    kind: conformance
    given: nothing
    then: nothing, and it is retried three times within ninety seconds via Twilio
why: >
  Two defects at once: the selector reaches zero exchanges, and the criterion pins a vendor
  and a duration at the highest-leverage place in the schema.
---

# Reaches nothing
