---
id: family-wallet
title: Family Wallet
exists: kept
tags: [consumer, shared-device]
terms:
  kid:
    means: A dependent tracked in a family, whose money the parents manage.
  parent:
    means: An adult who may change what a kid has. A family may have more than one.
  money:
    means: What a kid has, and every act that changes it.
  balance:
    means: What a kid currently has, after everything that has been recorded.
  task:
    means: A piece of work a parent offers, with an amount attached.
  completion:
    means: A kid's assertion that a task is done, which a parent has not yet approved.
    # ⛔ The third answer to `nothing-reads-what-this-sets`, which had no field until now —
    # so the finding could never be cleared honestly and could not be parked either.
    read_outside:
      because: a parent reads waiting completions on the approvals screen, which is not scoped yet
      by: peter
      at: 2026-09-19
  standing allowance:
    means: An amount a kid is given on a repeating day, set once and applied without anyone asking.
---

Parents manage allowances for their kids on a shared device in the kitchen. A parent
records what a kid has earned or spent; the kid sees what they have and what work is on
offer.

The thing that makes it delicate is that money is involved and the device is shared: a
parent tapping twice must not pay twice, and a kid must never be able to credit themselves.
Both of those are org-wide rules here rather than anything a single screen says.
