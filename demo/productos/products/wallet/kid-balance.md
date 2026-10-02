---
id: wallet/kid-balance
title: Kid balance
status: shipped
description: |
  Each kid has a running balance equal to the sum of their transactions.
  The balance is shown wherever the kid appears — on the family list and
  on the kid detail screen — and is always derived, never stored.
affected_by:
  - tasks/complete-task
  - wallet/interest
  - wallet/nfc-card
surfaces:
  - id: family-list
    title: Family list
    path: /family
    sketch: |
      ┌──────────────────────────────────┐
      │  Family                          │
      ├──────────────────────────────────┤
      │  →  Mia                          │
      │     Balance              $12.50  │
      │                                  │
      │  →  Leo                          │
      │     Balance               $4.00  │
      │                                  │
      │  →  Ada                          │
      │     Balance              -$1.25  │
      │                                  │
      │           [ + Add a kid ]        │
      └──────────────────────────────────┘
    sketch_html: |
      <div style="background:#fffbf5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;min-height:520px;">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <a href="#surface-kid-detail" title="Tap a kid → kid detail" style="text-decoration:none;color:inherit;">
            <div style="background:#fff;border:1px solid #fed7aa;border-left:6px solid #f97316;border-radius:14px;padding:14px;display:flex;align-items:center;gap:14px;cursor:pointer;">
              <div style="width:52px;height:52px;border-radius:26px;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">M</div>
              <div style="flex:1;">
                <div style="font-size:18px;font-weight:600;">Mia</div>
                <div style="font-size:12px;color:#78716c;margin-top:2px;">Balance</div>
              </div>
              <div style="font-size:22px;font-weight:700;">$12.50</div>
            </div>
          </a>
          <a href="#surface-kid-detail" title="Tap a kid → kid detail" style="text-decoration:none;color:inherit;">
            <div style="background:#fff;border:1px solid #fed7aa;border-left:6px solid #ec4899;border-radius:14px;padding:14px;display:flex;align-items:center;gap:14px;cursor:pointer;">
              <div style="width:52px;height:52px;border-radius:26px;background:#ec4899;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">L</div>
              <div style="flex:1;">
                <div style="font-size:18px;font-weight:600;">Leo</div>
                <div style="font-size:12px;color:#78716c;margin-top:2px;">Balance</div>
              </div>
              <div style="font-size:22px;font-weight:700;">$4.00</div>
            </div>
          </a>
          <a href="#surface-kid-detail" title="Tap a kid → kid detail" style="text-decoration:none;color:inherit;">
            <div style="background:#fff;border:1px solid #fed7aa;border-left:6px solid #8b5cf6;border-radius:14px;padding:14px;display:flex;align-items:center;gap:14px;cursor:pointer;">
              <div style="width:52px;height:52px;border-radius:26px;background:#8b5cf6;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">A</div>
              <div style="flex:1;">
                <div style="font-size:18px;font-weight:600;">Ada</div>
                <div style="font-size:12px;color:#78716c;margin-top:2px;">Balance</div>
              </div>
              <div style="font-size:22px;font-weight:700;color:#dc2626;">−$1.25</div>
            </div>
          </a>
          <a href="/wallet/add-kid" title="goes to wallet/add-kid" style="text-decoration:none;color:#f97316;">
            <div style="margin-top:8px;padding:14px;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:600;font-size:16px;cursor:pointer;">
              <span style="width:20px;height:20px;border-radius:10px;border:2px solid #f97316;display:inline-flex;align-items:center;justify-content:center;font-size:14px;line-height:1;">+</span>
              Add a kid
            </div>
          </a>
        </div>
      </div>
    elements:
      - id: kid-card
        kind: card
        label: Kid card
        leads_to: kid-detail
        notes: One per kid; tapping navigates to that kid's detail screen.
      - id: kid-balance-amount
        kind: text
        label: Balance amount
        notes: Per-kid balance shown to the right of the kid's name.
      - id: add-kid-button
        kind: button
        label: Add a kid
        leads_to: add-kid

  - id: kid-detail
    title: Kid detail
    path: /kid/[id]
    sketch: |
      ┌──────────────────────────────────┐
      │  ←  Mia                  [ Edit ]│
      ├──────────────────────────────────┤
      │ ┌──────────────────────────────┐ │
      │ │ →   Current balance          │ │
      │ │              $12.50          │ │
      │ │  [ + Earn ]   [ − Spend ]    │ │
      │ └──────────────────────────────┘ │
      │                                  │
      │  Birthday gift        +$10.00  🗑│
      │  Jun 1 · 3:42 PM                 │
      │  Movie ticket          −$5.00  🗑│
      │  May 30 · 7:10 PM                │
      │  Allowance             +$5.00  🗑│
      │  May 28 · 9:00 AM                │
      └──────────────────────────────────┘
    sketch_html: |
      <div style="background:#fffbf5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;min-height:520px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 12px;">
          <a href="#surface-family-list" title="back to family list" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;">
            <span style="color:#f97316;font-size:20px;">←</span>
            <span style="font-size:17px;font-weight:600;">Mia</span>
          </a>
          <div style="display:flex;align-items:center;gap:6px;color:#f97316;font-weight:600;font-size:15px;">
            ✎ Edit
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="background:#fff;border:1px solid #fed7aa;border-left:6px solid #f97316;border-radius:14px;padding:16px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="width:72px;height:72px;border-radius:36px;background:#f97316;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:32px;">M</div>
              <div style="flex:1;">
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#78716c;">Current balance</div>
                <div style="font-size:42px;font-weight:800;">$12.50</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;">
              <a href="#surface-earn-form" title="goes to earn form" style="text-decoration:none;background:#16a34a;border:1px solid #16a34a;color:#fff;font-weight:700;padding:8px 14px;border-radius:10px;cursor:pointer;">+ Earn</a>
              <a href="#surface-spend-form" title="goes to spend form" style="text-decoration:none;background:#dc2626;border:1px solid #dc2626;color:#fff;font-weight:700;padding:8px 14px;border-radius:10px;cursor:pointer;">− Spend</a>
            </div>
          </div>
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;">
            <div style="flex:1;">
              <div style="font-size:15px;font-weight:600;">Birthday gift</div>
              <div style="font-size:11px;color:#78716c;margin-top:2px;">Jun 1 · 3:42 PM</div>
            </div>
            <div style="font-size:17px;font-weight:700;color:#16a34a;">+$10.00</div>
            <a href="/wallet/delete-transaction" title="goes to wallet/delete-transaction" style="padding-left:14px;color:#78716c;text-decoration:none;">🗑</a>
          </div>
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;">
            <div style="flex:1;">
              <div style="font-size:15px;font-weight:600;">Movie ticket</div>
              <div style="font-size:11px;color:#78716c;margin-top:2px;">May 30 · 7:10 PM</div>
            </div>
            <div style="font-size:17px;font-weight:700;color:#dc2626;">−$5.00</div>
            <a href="/wallet/delete-transaction" title="goes to wallet/delete-transaction" style="padding-left:14px;color:#78716c;text-decoration:none;">🗑</a>
          </div>
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;">
            <div style="flex:1;">
              <div style="font-size:15px;font-weight:600;">Allowance</div>
              <div style="font-size:11px;color:#78716c;margin-top:2px;">May 28 · 9:00 AM</div>
            </div>
            <div style="font-size:17px;font-weight:700;color:#16a34a;">+$5.00</div>
            <a href="/wallet/delete-transaction" title="goes to wallet/delete-transaction" style="padding-left:14px;color:#78716c;text-decoration:none;">🗑</a>
          </div>
        </div>
      </div>
    elements:
      - id: balance-card
        kind: panel
        label: Balance card
        notes: Top card on the screen — anchors the balance number and the Earn/Spend actions.
      - id: balance-amount
        kind: text
        label: Current balance
        notes: The big balance number for this kid.
      - id: earn-button
        kind: button
        label: + Earn
        leads_to: earn-form
        notes: Opens the Earn form, pre-scoped to this kid.
      - id: spend-button
        kind: button
        label: − Spend
        leads_to: spend-form
        notes: Opens the Spend form, pre-scoped to this kid.
      - id: transaction-row
        kind: list-item
        label: Transaction row
        notes: One per transaction; shows reason, timestamp, signed amount.
      - id: transaction-delete
        kind: button
        label: Delete transaction
        leads_to: wallet/delete-transaction
        notes: Trash icon on each row; opens a confirm dialog before removing.

  - id: earn-form
    title: Earn form
    path: /adjust/[id]?direction=credit
    sketch: |
      ┌──────────────────────────────────┐
      │  ←  Add money                    │
      ├──────────────────────────────────┤
      │  Amount                          │
      │  [ $0.00                       ] │
      │                                  │
      │  Reason (optional)               │
      │  [ e.g. Birthday gift          ] │
      │                                  │
      │         [ Add money ]            │
      └──────────────────────────────────┘
    sketch_html: |
      <div style="background:#fffbf5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;min-height:520px;">
        <a href="#surface-kid-detail" title="back to kid detail" style="display:flex;align-items:center;gap:8px;padding:0 0 16px;text-decoration:none;color:inherit;">
          <span style="color:#f97316;font-size:20px;">←</span>
          <span style="font-size:17px;font-weight:600;">Add money</span>
        </a>
        <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="display:block;font-size:13px;font-weight:600;color:#78716c;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Amount</label>
            <input style="width:100%;padding:14px;font-size:22px;font-weight:600;border:1px solid #fed7aa;border-radius:10px;background:#fffbf5;color:#1c1917;box-sizing:border-box;" placeholder="$0.00" />
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:600;color:#78716c;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Reason <span style="text-transform:none;letter-spacing:0;color:#a8a29e;font-weight:400;">(optional)</span></label>
            <input style="width:100%;padding:12px;font-size:15px;border:1px solid #fed7aa;border-radius:10px;background:#fffbf5;color:#1c1917;box-sizing:border-box;" placeholder="e.g. Birthday gift" />
          </div>
          <a href="#surface-kid-detail" title="returns to kid detail on submit" style="margin-top:8px;padding:14px;background:#fed7aa;border:none;border-radius:12px;color:#fff;font-weight:700;font-size:17px;text-align:center;text-decoration:none;display:block;">Add money</a>
          <div style="font-size:12px;color:#a8a29e;text-align:center;margin-top:-8px;">Disabled until amount &gt; 0 · returns to kid detail on submit</div>
        </div>
      </div>
    elements:
      - id: amount-input
        kind: input
        label: Amount
        notes: Decimal input; autofocuses when the form opens.
      - id: reason-input
        kind: input
        label: Reason
        notes: Optional free-text label that ends up on the transaction row.
      - id: submit-button
        kind: button
        label: Add money
        leads_to: kid-detail
        notes: Disabled until a positive amount is entered; on submit, returns to kid-detail.

  - id: spend-form
    title: Spend form
    path: /adjust/[id]?direction=debit
    sketch: |
      ┌──────────────────────────────────┐
      │  ←  Spend money                  │
      ├──────────────────────────────────┤
      │  Amount                          │
      │  [ $0.00                       ] │
      │                                  │
      │  Reason (optional)               │
      │  [ e.g. Movie ticket           ] │
      │                                  │
      │        [ Spend money ]           │
      └──────────────────────────────────┘
    sketch_html: |
      <div style="background:#fffbf5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;min-height:520px;">
        <a href="#surface-kid-detail" title="back to kid detail" style="display:flex;align-items:center;gap:8px;padding:0 0 16px;text-decoration:none;color:inherit;">
          <span style="color:#f97316;font-size:20px;">←</span>
          <span style="font-size:17px;font-weight:600;">Spend money</span>
        </a>
        <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="display:block;font-size:13px;font-weight:600;color:#78716c;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Amount</label>
            <input style="width:100%;padding:14px;font-size:22px;font-weight:600;border:1px solid #fed7aa;border-radius:10px;background:#fffbf5;color:#1c1917;box-sizing:border-box;" placeholder="$0.00" />
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:600;color:#78716c;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Reason <span style="text-transform:none;letter-spacing:0;color:#a8a29e;font-weight:400;">(optional)</span></label>
            <input style="width:100%;padding:12px;font-size:15px;border:1px solid #fed7aa;border-radius:10px;background:#fffbf5;color:#1c1917;box-sizing:border-box;" placeholder="e.g. Movie ticket" />
          </div>
          <a href="#surface-kid-detail" title="returns to kid detail on submit" style="margin-top:8px;padding:14px;background:#fed7aa;border:none;border-radius:12px;color:#fff;font-weight:700;font-size:17px;text-align:center;text-decoration:none;display:block;">Spend money</a>
          <div style="font-size:12px;color:#a8a29e;text-align:center;margin-top:-8px;">Disabled until amount &gt; 0 · returns to kid detail on submit</div>
        </div>
      </div>
    elements:
      - id: amount-input
        kind: input
        label: Amount
        notes: Decimal input; autofocuses when the form opens.
      - id: reason-input
        kind: input
        label: Reason
        notes: Optional free-text label that ends up on the transaction row.
      - id: submit-button
        kind: button
        label: Spend money
        leads_to: kid-detail
        notes: Disabled until a positive amount is entered; on submit, returns to kid-detail.

behaviors:
  - id: balance-on-family-list
    claim: On the family list, each kid's row shows their current balance, and the number stays in sync when transactions are recorded elsewhere in the app.
    surface: family-list
    element: kid-balance-amount
    interaction: view
    test_cases:
      - id: 1
        level: e2e
        description: Each kid row shows that kid's balance
        given: kids Mia ($12.50) and Leo ($4.00)
        when: the family list renders
        then: Mia's row shows "$12.50" and Leo's row shows "$4.00"
      - id: 2
        level: e2e
        description: Balance refreshes after a transaction is recorded elsewhere
        given: the family list is open with Mia at $0.00
        when: a +$5.00 transaction is recorded for Mia on another screen
        then: Mia's row on the family list shows "$5.00" without a manual reload

  - id: balance-on-kid-detail
    claim: On the kid detail screen, the kid's current balance is displayed prominently at the top of the screen, above the transaction history.
    surface: kid-detail
    element: balance-amount
    interaction: view
    test_cases:
      - id: 1
        level: e2e
        description: Balance card renders at the top of the screen with the current amount
        given: Mia has a balance of $12.50
        when: the kid detail screen for Mia opens
        then: the balance card shows "$12.50" with the label "Current balance"
      - id: 2
        level: e2e
        description: Balance updates after returning from Earn or Spend
        given: Mia's detail screen shows $12.50
        when: an Earn of $5.00 is submitted and the user returns to the detail screen
        then: the balance card shows "$17.50"

  - id: earn-flow
    claim: From a kid's detail screen, tapping + Earn opens a form scoped to that kid; submitting a positive amount records a credit against that kid and returns to the kid's detail screen with the new balance shown.
    surface: earn-form
    element: submit-button
    interaction: submit
    notes: |
      The form is opened from kid-detail's earn-button (no separate launcher
      surface). The kid context is carried through the route — the form
      cannot be opened in the abstract; it is always for a specific kid.
    test_cases:
      - id: 1
        level: e2e
        description: Tapping + Earn from a kid's detail opens the Earn form for that kid
        given: Mia's detail screen is open with balance $5.00
        when: the parent taps + Earn
        then: the Earn form opens with the amount input focused, scoped to Mia
      - id: 2
        level: integration
        description: Submitting a valid amount records a positive transaction and returns to the kid's detail
        given: the Earn form is open for Mia with amount $5.00 and reason "Birthday gift"
        when: the parent taps Add money
        then: a +$5.00 transaction is recorded for Mia, the form closes, and Mia's detail shows the new balance $10.00
      - id: 3
        level: integration
        description: Submitting with a zero or empty amount is blocked
        given: the Earn form is open with amount $0.00
        when: the parent taps Add money
        then: no transaction is recorded and the form stays open

  - id: spend-flow
    claim: From a kid's detail screen, tapping − Spend opens a form scoped to that kid; submitting a positive amount records a debit against that kid and returns to the kid's detail screen with the new balance shown.
    surface: spend-form
    element: submit-button
    interaction: submit
    notes: |
      Mirror of earn-flow with the opposite sign. The form does not block
      overdraws — see negative-balances-allowed.
    test_cases:
      - id: 1
        level: e2e
        description: Tapping − Spend from a kid's detail opens the Spend form for that kid
        given: Mia's detail screen is open with balance $10.00
        when: the parent taps − Spend
        then: the Spend form opens with the amount input focused, scoped to Mia
      - id: 2
        level: integration
        description: Submitting a valid amount records a negative transaction and returns to the kid's detail
        given: the Spend form is open for Mia with amount $3.00 and reason "Movie ticket"
        when: the parent taps Spend money
        then: a −$3.00 transaction is recorded for Mia, the form closes, and Mia's detail shows the new balance $7.00

  - id: submit-disabled-until-amount-positive
    claim: On the Earn form, the Add money button is disabled until a positive amount has been entered. Editing the amount toggles the button's enabled state in real time.
    surface: earn-form
    element: submit-button
    interaction: view
    test_cases:
      - id: 1
        level: e2e
        description: Add money button starts disabled when the form opens
        given: the Earn form has just opened with an empty amount
        when: the parent inspects the Add money button
        then: the button is visibly disabled and tapping it does nothing
      - id: 2
        level: e2e
        description: Entering a positive amount enables the button
        given: the Earn form is open with the button disabled
        when: the parent types "$3.00" into the amount field
        then: the Add money button becomes enabled
      - id: 3
        level: e2e
        description: Clearing the amount disables the button again
        given: the Earn form is open with amount "$3.00" and the button enabled
        when: the parent clears the amount field back to empty
        then: the Add money button becomes disabled again

  - id: submit-failure-keeps-form-open
    claim: If recording the transaction fails, the Earn form stays open with the entered amount and reason intact and shows a retry-able error; no transaction is recorded.
    surface: earn-form
    element: submit-button
    interaction: submit
    notes: |
      Covers network and server errors. The form does not auto-retry — the
      parent re-taps Add money once they're ready. A successful retry must
      record exactly one transaction (no duplicates from the failed attempt).
    test_cases:
      - id: 1
        level: integration
        description: Network failure during submit leaves the form open with values intact
        given: the Earn form is open for Mia with amount "$5.00" and reason "Birthday gift", and the network is offline
        when: the parent taps Add money
        then: the form stays open, the amount still shows "$5.00", the reason still shows "Birthday gift", an error is shown, and no transaction is recorded for Mia
      - id: 2
        level: integration
        description: Retrying after a failure records exactly one transaction
        given: an Earn submit just failed and the form is still open with the values intact
        when: the network recovers and the parent taps Add money again
        then: exactly one +$5.00 transaction is recorded for Mia and the form closes

  - id: back-cancels-without-recording
    claim: Tapping the back arrow on the Earn form returns to the kid's detail screen without recording any transaction, even if an amount and reason have been entered.
    surface: earn-form
    interaction: tap-back
    notes: |
      The back arrow appears in the form sketch (top-left) but is not listed
      as a discrete element — convention here is that back navigation is
      implicit on every modal-style form.
    test_cases:
      - id: 1
        level: e2e
        description: Back from an empty form records nothing
        given: the Earn form is open for Mia with no amount entered
        when: the parent taps the back arrow
        then: the kid-detail screen for Mia is shown and no transaction has been recorded
      - id: 2
        level: e2e
        description: Back from a partially-filled form discards the inputs without recording
        given: the Earn form is open for Mia with amount "$5.00" and reason "Birthday gift"
        when: the parent taps the back arrow
        then: the kid-detail screen for Mia is shown, no transaction has been recorded, and re-opening the Earn form shows the amount cleared

  - id: negative-balances-allowed
    claim: A kid's balance can go below zero — there is no spend or adjust path that refuses to overdraw.
    notes: |
      A negative balance represents money the kid has "borrowed" against
      future earnings. Tracking it as a real number is more accurate (and
      more honest with the kid) than blocking the spend. Displayed with a
      leading minus sign — e.g. "−$1.25".
    test_cases:
      - id: 1
        level: integration
        description: Spending more than the current balance still succeeds and produces a negative balance
        given: a kid with balance $2.00
        when: a Spend transaction of $5.00 is submitted for that kid
        then: the transaction is recorded and the new balance is −$3.00
      - id: 2
        level: unit
        description: Negative balances format with a leading minus sign
        given: a balance of −125 cents
        when: the balance is formatted for display
        then: the rendered text is "−$1.25"

  - id: one-kid-per-transaction
    claim: Every transaction belongs to exactly one kid. There is no shared family pool — to credit or debit two kids, the parent records two separate transactions.
    notes: |
      Rules out any "family allowance" or pooled-balance concept. The Earn
      and Spend forms always carry kid context through the route; the forms
      cannot be opened in the abstract.
    test_cases:
      - id: 1
        level: integration
        description: Earning for one kid does not change another kid's balance
        given: kids Mia ($5.00) and Leo ($5.00)
        when: a +$3.00 Earn transaction is submitted for Mia
        then: Mia's balance is $8.00 and Leo's balance is unchanged at $5.00
      - id: 2
        level: e2e
        description: Earn and Spend forms always open in the context of a specific kid
        given: a parent viewing the family list
        when: they attempt to reach the Earn or Spend form
        then: they must first open a kid's detail; there is no path to a global Earn or Spend

  - id: earn-and-spend-are-inverses
    claim: An Earn of $X and a Spend of $X on the same kid net to zero. The two forms share identical input behavior — amount required, reason optional — and differ only in the sign applied to the recorded transaction.
    notes: |
      Tests the parent's mental model. If Earn and Spend ever diverge in
      validation, defaults, or completion behavior, this rule is broken.
    test_cases:
      - id: 1
        level: integration
        description: Earn followed by Spend of the same amount returns the kid to the original balance
        given: a kid with balance $5.00
        when: a +$3.00 Earn and then a −$3.00 Spend are submitted
        then: the kid's balance is $5.00
      - id: 2
        level: integration
        description: Both forms reject a zero or empty amount
        given: either the Earn or Spend form is open with amount $0.00
        when: the parent taps the submit button
        then: no transaction is recorded and the form stays open

  - id: whole-cent-precision
    claim: All balances and transaction amounts are whole cents. Amounts entered with sub-cent precision are rounded to the nearest cent on entry; the UI never shows fractional cents.
    notes: |
      Money is integer cents end-to-end. Parents typing "$5.005" should not
      see "$5.005" or "$5.00499..." anywhere — the displayed balance is
      always two-decimal dollars.
    test_cases:
      - id: 1
        level: unit
        description: Entering "$5.00" records 500 cents
        given: the Earn form is open
        when: the parent enters "$5.00" and submits
        then: the recorded transaction amount is 500 cents and the kid's balance increases by $5.00
      - id: 2
        level: unit
        description: Entering "$5.005" rounds to the nearest cent
        given: the Earn form is open
        when: the parent enters "$5.005" and submits
        then: the recorded transaction amount is 501 cents and the displayed balance shows whole cents only

  - id: transactions-are-recorded-not-edited
    claim: Once a transaction is recorded, a parent can delete it but cannot change its amount or reason. To correct a mistake, the parent deletes the transaction and records a new one.
    notes: |
      Keeps the kid's history a faithful ledger — any past balance is
      reproducible from the transaction log. Trades off some convenience
      (no in-place edit) for accountability.
    test_cases:
      - id: 1
        level: e2e
        description: There is no edit affordance on a transaction row
        given: the kid-detail screen shows a transaction history
        when: the parent inspects any transaction row
        then: the only mutation affordance available is the delete (trash) icon — no edit button or tap-to-edit
      - id: 2
        level: e2e
        description: Correcting a recorded transaction requires delete + re-record
        given: a kid has a +$5.00 Earn that should have been $4.00
        when: the parent corrects the mistake
        then: the corrective path is to delete the original transaction and record a new $4.00 Earn — two visible rows in the resulting history (delete leaves the row absent; the new $4.00 row appears)

  - id: reason-is-the-row-label
    claim: Whatever the parent types in the Reason field becomes the label on the transaction row in the kid-detail history, with leading and trailing whitespace trimmed. An empty Reason defaults to "Earned" on Earn and "Spent" on Spend.
    test_cases:
      - id: 1
        level: integration
        description: Typed reason becomes the row label
        given: the Earn form is open with reason "Birthday gift"
        when: the parent submits
        then: the resulting transaction row in the kid-detail history shows "Birthday gift"
      - id: 2
        level: integration
        description: Empty reason on Earn defaults to "Earned"
        given: the Earn form is open with the reason field blank
        when: the parent submits
        then: the resulting transaction row shows "Earned"
      - id: 3
        level: integration
        description: Empty reason on Spend defaults to "Spent"
        given: the Spend form is open with the reason field blank
        when: the parent submits
        then: the resulting transaction row shows "Spent"
      - id: 4
        level: unit
        description: Surrounding whitespace is trimmed; interior whitespace is preserved
        given: the Earn form is open with reason "  Movie  ticket  "
        when: the parent submits
        then: the resulting transaction row shows "Movie  ticket"
---

# Kid balance

The kid balance is the running total of money a kid has earned, been gifted, spent, or accrued in interest. It's the single most-looked-at number in the app: parents check it on the family list; kids check it on their own detail screen.

## Why derived, not stored?

A stored balance column is tempting (one column, one read) but it drifts the moment a transaction is added, removed, or backdated outside the one path that updates the column. Deriving balance from `SUM(amount_cents)` over `transactions` means every mutation path is automatically correct, and the balance survives migrations, reinstalls, and manual transaction edits without a "recompute" job. The cost is a per-read aggregation — trivial at this scale.

## Out of scope (lives elsewhere)

- **Task completion and interest accrual.** Those flows have their own triggers (a kid completing a task, the interest cron firing) and live in `tasks/complete-task` and `wallet/interest`. They appear in `affected_by:` above — they mutate the balance this feature displays.
- **Overdraft policy beyond "allowed."** No warning UI, no parental cap, no auto-block on Spend. If we ever want a soft warning when a spend would overdraw, it would be a new behavior on `spend-flow`, not a separate feature.
- **Visual design.** Colors, typography, animations are out of scope for ProductOS.
