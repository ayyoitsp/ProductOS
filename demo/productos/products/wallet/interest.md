---
id: wallet/interest
title: Interest
status: shipped
description: |
  Kid balances earn interest on selected days of the week. The parent toggles
  interest on, picks days (default Sunday), and sets a percentage rate
  (unbounded — small numbers feel realistic, large numbers feel rewarding).
  Interest auto-applies when the app first opens after midnight on a
  scheduled day, and **catches up on missed scheduled days** if the app
  hasn't been opened for a while — each missed day credits in chronological
  order, compounding on the then-current balance.
affected_by: []
surfaces:
  - id: settings-interest
    title: Interest settings (on the Settings tab)
    path: /settings
    sketch: |
      ┌──────────────────────────────────┐
      │  INTEREST                        │
      │ ┌──────────────────────────────┐ │
      │ │  Apply interest        [✓]   │ │
      │ └──────────────────────────────┘ │
      │   ┌────────────────────────────┐ │
      │   │ Days of week               │ │
      │   │ [Sun][Mon][Tue][Wed]…      │ │
      │   │ Last applied: 2026-06-22   │ │
      │   └────────────────────────────┘ │
      │   ┌────────────────────────────┐ │
      │   │ Rate (%)                   │ │
      │   │ [ 5                      ] │ │
      │   │ Your kids would earn:      │ │
      │   │   Mia    $12.50   +$0.63   │ │
      │   │   Leo     $4.00   +$0.20   │ │
      │   │ Sample balances:           │ │
      │   │   $1.00   +$0.05           │ │
      │   │   $5.00   +$0.25  …        │ │
      │   └────────────────────────────┘ │
      │   [ Apply interest now ]         │
      │ ───────────────────────────────  │
      │           [ Save ]               │
      └──────────────────────────────────┘
    sketch_html: |
      <div style="background:#fffbf5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;min-height:520px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.2px;font-weight:600;margin-bottom:10px;">Interest</div>
        <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
          <div style="flex:1;">
            <div style="font-size:16px;font-weight:600;">Apply interest</div>
            <div style="font-size:12px;color:#78716c;margin-top:4px;">Kid balances earn interest on selected days of the week.</div>
          </div>
          <div style="width:48px;height:28px;border-radius:14px;background:#f97316;display:flex;align-items:center;justify-content:flex-end;padding:0 3px;"><div style="width:22px;height:22px;border-radius:11px;background:#fff;"></div></div>
        </div>
        <div style="margin-left:24px;display:flex;flex-direction:column;gap:12px;">
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;">
            <div style="font-size:16px;font-weight:600;">Days of week</div>
            <div style="font-size:12px;color:#78716c;margin-top:4px;">Interest is applied on these days, on the first time the app is opened after midnight. Missed days catch up.</div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
              <div style="border:1px solid #fed7aa;border-radius:999px;padding:6px 12px;background:#fffbf5;color:#1c1917;font-weight:600;font-size:13px;">Sun</div>
              <div style="border:1px solid #f97316;border-radius:999px;padding:6px 12px;background:#f97316;color:#fff;font-weight:600;font-size:13px;">Mon</div>
              <div style="border:1px solid #fed7aa;border-radius:999px;padding:6px 12px;background:#fffbf5;color:#1c1917;font-weight:600;font-size:13px;">Tue</div>
              <div style="border:1px solid #fed7aa;border-radius:999px;padding:6px 12px;background:#fffbf5;color:#1c1917;font-weight:600;font-size:13px;">Wed</div>
              <div style="border:1px solid #fed7aa;border-radius:999px;padding:6px 12px;background:#fffbf5;color:#1c1917;font-weight:600;font-size:13px;">Thu</div>
              <div style="border:1px solid #fed7aa;border-radius:999px;padding:6px 12px;background:#fffbf5;color:#1c1917;font-weight:600;font-size:13px;">Fri</div>
              <div style="border:1px solid #fed7aa;border-radius:999px;padding:6px 12px;background:#fffbf5;color:#1c1917;font-weight:600;font-size:13px;">Sat</div>
            </div>
            <div style="font-size:12px;color:#78716c;margin-top:12px;">Last applied: 2026-06-22</div>
          </div>
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;">
            <div style="font-size:16px;font-weight:600;">Rate (%)</div>
            <div style="font-size:12px;color:#78716c;margin-top:4px;">Percent of current balance, applied each interest day. Unbounded — use a big number to make small balances feel exciting.</div>
            <input style="width:100%;margin-top:8px;padding:10px 12px;font-size:18px;border:1px solid #fed7aa;border-radius:10px;background:#fffbf5;color:#1c1917;box-sizing:border-box;" value="5" />
            <div style="font-size:12px;color:#78716c;margin-top:14px;">Your kids would earn next interest day:</div>
            <div style="margin-top:8px;border:1px solid #fed7aa;border-radius:10px;overflow:hidden;">
              <div style="display:flex;padding:8px 12px;border-bottom:1px solid #fed7aa;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#78716c;"><div style="flex:1;">Kid</div><div style="flex:1;">Balance</div><div style="flex:1;text-align:right;">Earns</div></div>
              <div style="display:flex;padding:10px 12px;border-bottom:1px solid #fed7aa;font-size:15px;"><div style="flex:1;display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:5px;background:#f97316;"></div>Mia</div><div style="flex:1;">$12.50</div><div style="flex:1;text-align:right;color:#16a34a;font-weight:700;">+$0.63</div></div>
              <div style="display:flex;padding:10px 12px;font-size:15px;"><div style="flex:1;display:flex;align-items:center;gap:8px;"><div style="width:10px;height:10px;border-radius:5px;background:#ec4899;"></div>Leo</div><div style="flex:1;">$4.00</div><div style="flex:1;text-align:right;color:#16a34a;font-weight:700;">+$0.20</div></div>
            </div>
          </div>
          <a href="#" title="Apply interest now (manual override)" style="text-align:center;background:#fff;border:1px solid #fed7aa;color:#1c1917;font-weight:600;font-size:16px;padding:14px;border-radius:12px;text-decoration:none;display:block;">Apply interest now</a>
        </div>
        <div style="position:relative;margin-top:14px;padding-top:12px;border-top:1px solid #fed7aa;">
          <div style="background:#f97316;color:#fff;font-weight:700;font-size:16px;padding:14px;border-radius:12px;text-align:center;">Save</div>
        </div>
      </div>
    elements:
      - id: enable-switch
        kind: toggle
        label: Apply interest
        notes: Top-level switch. When off, the dependent settings group is greyed out and non-interactive.
      - id: day-chip
        kind: toggle
        label: Day chip
        notes: One per day-of-week (Sun..Sat). Tapping toggles whether interest fires on that day. Highlighted when active.
      - id: rate-input
        kind: input
        label: Rate (%)
        notes: Decimal input. Non-numeric characters are stripped before computation. Unbounded — any non-negative number is accepted.
      - id: kids-preview-row
        kind: list-item
        label: Kid preview row
        notes: One row per kid showing name → current balance → interest-at-rate. Negative balances show "—".
      - id: sample-balance-row
        kind: list-item
        label: Sample balance row
        notes: Fixed sample balances ($1, $5, $20, $50, $100, $200). Always shown, regardless of whether kids exist.
      - id: apply-now-button
        kind: button
        label: Apply interest now
        notes: Manual override — credits all kids with positive balance immediately, without checking days/today or touching last_applied. Useful for testing or out-of-schedule applies.
      - id: save-button
        kind: button
        label: Save
        notes: Floating bottom bar. Disabled until a setting has been changed (dirty state).
      - id: last-applied-text
        kind: text
        label: Last applied
        notes: |
          "Last applied: YYYY-MM-DD" line inside the Days panel, visible
          once interest has applied at least once.

  - id: interest-applying-overlay
    title: Interest-applying overlay
    sketch: |
      ┌──────────────────────────────────┐
      │   ◌  Applying interest…          │
      └──────────────────────────────────┘
    sketch_html: |
      <div style="background:#fffbf5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;min-height:120px;">
        <div style="display:flex;justify-content:center;padding-top:8px;">
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:999px;padding:12px 16px;display:flex;align-items:center;gap:10px;">
            <div style="width:14px;height:14px;border:2px solid #f97316;border-top-color:transparent;border-radius:7px;display:inline-block;"></div>
            <div style="font-weight:600;">Applying interest…</div>
          </div>
        </div>
      </div>
    elements:
      - id: spinner-pill
        kind: text
        label: Applying interest…
        notes: Briefly visible at the top of the screen while applyInterestIfDue is running. Auto-dismisses when the apply completes.

behaviors:
  - id: interest-off-by-default
    claim: Interest is disabled by default on a fresh install. The auto-apply path is a no-op and no transactions are recorded until the parent toggles it on.
    surface: settings-interest
    element: enable-switch
    interaction: view
    test_cases:
      - id: 1
        level: unit
        description: Default config has interest disabled
        given: a fresh install
        when: the interest config is loaded
        then: enabled is false, rate_pct is 5.0, days is [0] (Sunday), last_applied is null
      - id: 2
        level: integration
        description: Auto-apply on app open does nothing when disabled
        given: a kid with $10.00 and interest disabled
        when: the app opens
        then: no interest transaction is recorded and last_applied remains null

  - id: dependent-group-disabled-when-off
    claim: When the enable switch is off, the days chips, rate input, and "Apply interest now" button are greyed out and non-interactive. Toggling the switch on makes them interactive at full opacity.
    surface: settings-interest
    element: enable-switch
    interaction: toggle
    test_cases:
      - id: 1
        level: e2e
        description: Group greys out when interest is off
        given: the Settings tab is open and the Apply interest switch is off
        when: the parent inspects the days/rate/apply-now group
        then: the group is rendered at ~45% opacity and tapping a day chip or the rate input does nothing
      - id: 2
        level: e2e
        description: Toggling the switch on enables the group
        given: the switch is off
        when: the parent flips it on
        then: the group reaches full opacity and the day chips, rate input, and Apply interest now button respond to taps

  - id: day-chips-toggleable
    claim: Each day-of-week chip can be added to or removed from the active schedule by tapping it. The active set is sorted in day order before save.
    surface: settings-interest
    element: day-chip
    interaction: tap
    test_cases:
      - id: 1
        level: e2e
        description: Tapping an inactive chip adds it to the schedule
        given: the days schedule is [0] (Sunday) and interest is enabled
        when: the parent taps the "Wed" chip
        then: the active set becomes [0, 3] and Wed is rendered as highlighted
      - id: 2
        level: e2e
        description: Tapping an active chip removes it from the schedule
        given: the days schedule is [0, 3] and interest is enabled
        when: the parent taps the "Sun" chip
        then: the active set becomes [3] and Sun is rendered as inactive
      - id: 3
        level: unit
        description: Saved day list is sorted ascending
        given: the parent taps days in order Wed, Mon, Sat starting from an empty schedule
        when: the schedule is saved
        then: the persisted interest_days value is [1, 3, 6]

  - id: rate-is-unbounded-and-decimal
    claim: The rate input accepts any non-negative decimal value. There is no upper cap — a parent can set "1000" to make small balances feel large. Non-numeric characters in the input are stripped before computation.
    surface: settings-interest
    element: rate-input
    interaction: input
    test_cases:
      - id: 1
        level: integration
        description: A four-digit rate is accepted
        given: the rate input is set to "1000" and interest is enabled
        when: the parent taps Save
        then: rate_pct is persisted as 1000 and no validation error is shown
      - id: 2
        level: unit
        description: Non-numeric characters are stripped before computing previews
        given: the rate input reads "5x.5%"
        when: the rate is parsed
        then: the effective rate is 5.5

  - id: negative-rate-rejected
    claim: Saving with a rate that parses to a negative number shows an "Invalid rate" alert and does not persist the change.
    surface: settings-interest
    element: save-button
    interaction: submit
    test_cases:
      - id: 1
        level: e2e
        description: Negative rate is rejected on save
        given: the rate input reads "-1" and interest is enabled
        when: the parent taps Save
        then: an "Invalid rate" alert appears, the previously-saved rate is unchanged, and the form stays open

  - id: previews-reflect-current-rate
    claim: The Settings screen shows two preview tables — one per real kid showing interest-at-current-balance, one with fixed sample balances. Both recompute live as the rate input changes. Kids with non-positive balances render their earned column as "—".
    surface: settings-interest
    element: kids-preview-row
    interaction: view
    test_cases:
      - id: 1
        level: e2e
        description: Kid preview updates as the rate is typed
        given: Mia has $10.00 and the rate input reads "5"
        when: the parent changes the rate input to "10"
        then: Mia's row updates from "+$0.50" to "+$1.00" without a save
      - id: 2
        level: e2e
        description: Negative-balance kid shows "—" in earned column
        given: a kid Ada with balance −$1.25
        when: the kid preview row renders
        then: Ada's earned column shows "—"
      - id: 3
        level: e2e
        description: Sample balances always render
        given: zero kids in the system
        when: the settings screen renders
        then: the sample-balances table still shows rows for $1, $5, $20, $50, $100, $200

  - id: save-disabled-until-dirty
    claim: The floating Save button is disabled until the parent changes a setting (enable switch, day chips, or rate). On successful save a toast confirms.
    surface: settings-interest
    element: save-button
    interaction: view
    test_cases:
      - id: 1
        level: e2e
        description: Save starts disabled after the settings load
        given: the Settings tab just opened
        when: the parent inspects Save
        then: it is visibly disabled and tapping does nothing
      - id: 2
        level: e2e
        description: Save enables once any field changes
        given: the form is clean
        when: the parent taps a day chip (or types in rate, or toggles enable)
        then: Save becomes enabled

  - id: auto-apply-on-app-open
    claim: On every app boot AND every transition from background to foreground, the app runs applyInterestIfDue. A spinner overlay reads "Applying interest…" until the apply completes. A toast confirms when interest was credited.
    surface: interest-applying-overlay
    element: spinner-pill
    interaction: view
    notes: |
      The boot/foreground hook is in app/_layout.tsx via AppState. Without
      this trigger, interest would never apply on its own.
    test_cases:
      - id: 1
        level: integration
        description: Spinner shows during apply, then disappears
        given: interest is enabled and today is a scheduled day
        when: the app opens
        then: the "Applying interest…" pill is visible during the apply and removes itself when complete
      - id: 2
        level: integration
        description: Successful apply shows a toast naming how many kids were credited
        given: two kids with positive balances and a scheduled apply
        when: the apply finishes
        then: a toast reads "Interest applied — 2 kids credited"
      - id: 3
        level: integration
        description: Background→active also triggers a check
        given: the app is backgrounded on a non-scheduled day, then a scheduled day arrives, then the app returns to foreground
        when: the AppState changes to active
        then: applyInterestIfDue runs and (assuming positive balances) credits interest

  - id: apply-skipped-when-already-applied-today
    claim: Once interest has applied on a given calendar day, no further auto-apply fires that day no matter how many times the app is reopened. interest_last_applied = today guards this.
    test_cases:
      - id: 1
        level: integration
        description: Reopening the app on the same scheduled day does not double-credit
        given: interest already applied today, kid balance is $10.50
        when: the app is backgrounded and reopened later the same day
        then: no new interest transaction is recorded and the balance stays at $10.50

  - id: catches-up-missed-scheduled-days
    claim: When the app opens after one or more scheduled days have passed since last_applied, the app credits interest for **each missed scheduled day in chronological order**, compounding on the then-current balance. Missing two scheduled days produces two interest transactions per kid, the second computed on the post-first-credit balance.
    notes: |
      THE BUG FIX. Today the apply skips entirely if today's day-of-week
      isn't scheduled, so any scheduled day the app missed is silently lost.
      Catch-up iterates from last_applied + 1 day through today inclusive,
      applies for each date whose day-of-week is in cfg.days, and stamps
      interest_last_applied = today at the end. Each credit's reason
      includes its scheduled date — e.g. "Interest (5%) for 2026-06-22" —
      so the parent can read off catch-up vs same-day credits in the
      transaction log.
    test_cases:
      - id: 1
        level: integration
        description: Missing one scheduled day → exactly one credit on next open, on the missed day's balance
        given: interest schedule is [Monday], rate 5%, Mia's balance is $10.00, last_applied is the previous Monday, and the parent does NOT open the app on Monday
        when: the parent opens the app on Tuesday
        then: one +$0.50 interest transaction is recorded for Mia, the balance becomes $10.50, and last_applied is set to that Tuesday
      - id: 2
        level: integration
        description: Missing two scheduled days → two credits, compounded
        given: interest schedule is [Monday, Wednesday], rate 10%, Mia's balance is $10.00, last_applied is the previous Saturday, and the parent does NOT open the app on Monday or Wednesday
        when: the parent opens the app on Thursday
        then: two interest transactions are recorded for Mia — first +$1.00 (10% of $10.00), then +$1.10 (10% of $11.00) — and the balance becomes $12.10
      - id: 3
        level: integration
        description: Today is also a scheduled day → catch-up plus today's credit, all compounded
        given: interest schedule is [Monday, Wednesday], rate 10%, Mia's balance is $10.00, last_applied is the previous Saturday, the parent does NOT open the app on Monday, and the app opens on Wednesday
        when: the apply runs
        then: two transactions are recorded — first +$1.00 (Monday's catch-up), then +$1.10 (Wednesday's same-day credit, compounded on $11.00) — and last_applied is that Wednesday
      - id: 4
        level: integration
        description: No scheduled days were missed → no transactions
        given: interest schedule is [Monday], last_applied is the most recent Monday, today is Thursday
        when: the app opens
        then: no interest transaction is recorded and last_applied is unchanged
      - id: 5
        level: integration
        description: Catch-up only fires for scheduled days, not every day in the window
        given: interest schedule is [Sunday], last_applied was three Sundays ago, the parent opens the app today (also Sunday)
        when: the apply runs
        then: exactly three interest transactions are recorded per kid (one per intervening Sunday plus today), each compounded on the prior

  - id: positive-balance-only
    claim: Interest is credited only to kids whose current balance is greater than zero. A kid with a zero or negative balance receives no interest transaction.
    test_cases:
      - id: 1
        level: integration
        description: Zero-balance kid receives no transaction
        given: Mia $0.00 and Leo $5.00, rate 10%, today is scheduled
        when: the apply runs
        then: only Leo gets an interest transaction; Mia receives nothing
      - id: 2
        level: integration
        description: Negative-balance kid receives no transaction
        given: Ada with balance −$1.25, rate 100%, today is scheduled
        when: the apply runs
        then: Ada receives no interest transaction

  - id: recorded-as-interest-type
    claim: Each credit is recorded as a transaction of type "interest" with a reason that names the rate (e.g. "Interest (5%)" for same-day credits, "Interest (5%) for 2026-06-22" for catch-up credits).
    notes: |
      The type lets the transaction history filter / style interest rows
      distinctly from earn/spend/task. Including the date on catch-up
      credits keeps the ledger readable when multiple credits land at once.
    test_cases:
      - id: 1
        level: integration
        description: Same-day credit reason names just the rate
        given: a same-day apply at rate 5%
        when: an interest transaction is recorded
        then: the type is "interest" and the reason is "Interest (5%)"
      - id: 2
        level: integration
        description: Catch-up credit reason includes the missed date
        given: a catch-up apply for 2026-06-22 at rate 5%
        when: the catch-up interest transaction is recorded
        then: the reason is "Interest (5%) for 2026-06-22"

  - id: rounds-to-whole-cent
    claim: All interest amounts are integer cents, rounded to the nearest cent (half-up via Math.round). No fractional cents are ever recorded or displayed.
    test_cases:
      - id: 1
        level: unit
        description: Rounds up at the half
        given: a balance of 100 cents and rate 5.5%
        when: the interest is computed
        then: the result is 6 cents (5.5 rounds to 6)
      - id: 2
        level: unit
        description: Rounds down below the half
        given: a balance of 100 cents and rate 5.4%
        when: the interest is computed
        then: the result is 5 cents

  - id: apply-now-bypasses-schedule
    claim: The "Apply interest now" button immediately credits all kids with positive balance at the current rate, regardless of today's day or last_applied. It does NOT modify last_applied — the regular schedule continues uninterrupted.
    surface: settings-interest
    element: apply-now-button
    interaction: tap
    notes: |
      Manual override for testing or out-of-schedule applies. Because it
      doesn't touch last_applied, the next scheduled day still fires
      normally — including potentially crediting again the same day if the
      schedule lands.
    test_cases:
      - id: 1
        level: integration
        description: Credits all positive-balance kids at the rate
        given: kids Mia $10.00, Leo $5.00, Ada $0.00, rate 10%
        when: the parent taps Apply interest now
        then: Mia gets +$1.00, Leo gets +$0.50, Ada gets nothing, and a toast reads "Interest applied — 2 kids credited"
      - id: 2
        level: integration
        description: Apply-now does not modify last_applied
        given: last_applied is "2026-06-21" and today is "2026-06-25" (not a scheduled day)
        when: the parent taps Apply interest now
        then: last_applied remains "2026-06-21" after the apply completes
      - id: 3
        level: integration
        description: Apply-now with no positive-balance kids shows an info toast
        given: zero kids with positive balance
        when: the parent taps Apply interest now
        then: no transactions are recorded and a toast reads "No kids had a positive balance"

  - id: last-applied-shown-and-stamped
    claim: |
      After a successful auto-apply, interest_last_applied is set to today's
      date (YYYY-MM-DD, local time). The Days panel displays this date as
      "Last applied: YYYY-MM-DD" so the parent can confirm when interest
      last ran.
    surface: settings-interest
    element: last-applied-text
    interaction: view
    test_cases:
      - id: 1
        level: integration
        description: Successful auto-apply stamps today's local date
        given: a scheduled apply on 2026-06-22 in local time
        when: the apply completes
        then: interest_last_applied is "2026-06-22"
      - id: 2
        level: e2e
        description: Days panel shows the last-applied date
        given: interest_last_applied is "2026-06-22"
        when: the Settings tab renders
        then: 'the Days panel includes "Last applied: 2026-06-22"'
---

# Interest

Interest is the slow drumbeat under the family ledger. The parent picks a rate, picks the days it fires, and the app handles the rest — auto-apply on first open after midnight on a scheduled day, with catch-up for days the app wasn't opened.

The catch-up rule is the load-bearing piece: families don't open the app every day, so an "only-fires-if-the-app-is-open-on-the-right-day" rule silently loses interest the kid was promised. Catch-up means the schedule, not the open-event, is the source of truth.
