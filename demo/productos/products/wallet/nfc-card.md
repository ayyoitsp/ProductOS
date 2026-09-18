---
id: wallet/nfc-card
title: NFC card
status: planned
description: |
  Each kid gets a writeable NFC card programmed (externally, with a tool
  like NFC Tools) with a single NDEF URL record of the form
  familywallet://kid/<id>. Two flows use the same card content:
  (1) on the Spend form, the parent enters an amount and the kid taps
  their card to confirm and commit the spend — modeled on a point-of-sale
  tap-to-pay; (2) tapping a card outside that flow deep-links into the
  kid's detail screen via the existing familywallet:// scheme.
affected_by: []
surfaces:
  - id: tap-to-charge-modal
    title: Tap-to-charge modal
    sketch: |
      ┌──────────────────────────────────┐
      │  Tap Mia's card                  │
      │  to charge $5.00                 │
      │                                  │
      │         📶  Waiting…             │
      │                                  │
      │          [ Cancel ]              │
      └──────────────────────────────────┘
    sketch_html: |
      <div style="background:rgba(28,25,23,0.45);padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;min-height:520px;display:flex;align-items:center;justify-content:center;">
        <div style="background:#fffbf5;border:1px solid #fed7aa;border-left:6px solid #f97316;border-radius:18px;padding:28px;width:100%;max-width:340px;box-shadow:0 12px 32px rgba(0,0,0,0.18);">
          <div style="text-align:center;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#78716c;margin-bottom:6px;">Tap to charge</div>
            <div style="font-size:24px;font-weight:700;line-height:1.25;">Tap Mia's card</div>
            <div style="font-size:15px;color:#57534e;margin-top:4px;">to charge <span style="font-weight:700;color:#dc2626;">$5.00</span></div>
          </div>
          <div style="margin:28px auto;display:flex;flex-direction:column;align-items:center;gap:10px;">
            <div style="width:88px;height:88px;border-radius:44px;background:#fff;border:2px dashed #f97316;display:flex;align-items:center;justify-content:center;font-size:36px;">📶</div>
            <div style="font-size:13px;color:#78716c;letter-spacing:0.5px;">Waiting…</div>
          </div>
          <div style="display:flex;justify-content:center;">
            <a href="#surface-spend-form" title="Cancel — close modal, return to Spend form" style="text-decoration:none;background:#fffbf5;border:1px solid #fed7aa;color:#57534e;font-weight:600;padding:10px 28px;border-radius:10px;cursor:pointer;">Cancel</a>
          </div>
        </div>
      </div>
    elements:
      - id: kid-name-prompt
        kind: text
        label: Tap Mia's card
        notes: Header line; reflects the focused kid's name.
      - id: amount-prompt
        kind: text
        label: to charge $5.00
        notes: Mirrors the amount entered on the underlying Spend form.
      - id: waiting-indicator
        kind: text
        label: Waiting…
        notes: Visible while the NFC reader session is active and no tag has been scanned yet.
      - id: cancel-button
        kind: button
        label: Cancel
        notes: Closes the modal and ends the NFC session — no transaction recorded.
      - id: error-message
        kind: text
        label: That's Leo's card, not Mia's
        notes: Replaces the waiting indicator when a card was scanned but rejected. Wording covers wrong-card, unrecognized-card, and unknown-id cases.
      - id: try-again-button
        kind: button
        label: Try again
        notes: Appears alongside Cancel after a rejection; restarts the NFC session in place.

  - id: edit-kid-nfc-snippet
    title: Edit-kid NFC URL snippet
    path: /add-kid?id=[id]
    sketch: |
      ┌──────────────────────────────────┐
      │  NFC URL                         │
      │  familywallet://kid/3   [ Copy ] │
      │  Write this URL to a blank card  │
      │  with NFC Tools.                 │
      └──────────────────────────────────┘
    sketch_html: |
      <div style="background:#fffbf5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;">
        <div style="background:#fff;border:1px solid #fed7aa;border-radius:14px;padding:14px;">
          <div style="font-size:16px;font-weight:600;">NFC URL</div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1c1917;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">familywallet://kid/3</div>
            </div>
            <a href="#" title="Copy URL to clipboard" style="text-decoration:none;background:#f97316;color:#fff;font-weight:700;font-size:13px;padding:8px 16px;border-radius:10px;cursor:pointer;">Copy</a>
          </div>
          <div style="font-size:12px;color:#78716c;margin-top:10px;">Write this URL to a blank NFC card with NFC Tools (or any NDEF writer) to make this kid's card.</div>
        </div>
      </div>
    elements:
      - id: nfc-url-text
        kind: text
        label: familywallet://kid/3
        notes: Per-kid URL — deterministic from the kid's database id; stable for the life of the kid record.
      - id: copy-button
        kind: button
        label: Copy
        notes: Copies the URL to the system clipboard so the parent can program a card with an external tool like NFC Tools.

behaviors:
  - id: tap-a-card-button-shown-when-nfc-available
    claim: On the Spend form, a "Tap a card" secondary action is shown when the device supports NFC. On devices without NFC (simulators, older phones), the button is hidden so the parent doesn't see a dead control.
    surface: wallet/kid-balance#spend-form
    interaction: view
    test_cases:
      - id: 1
        level: e2e
        description: NFC-capable device shows Tap a card
        given: an iPhone (XS or newer) with NFC enabled, Mia's Spend form open
        when: the form renders
        then: a "Tap a card" button appears below the Spend money submit
      - id: 2
        level: e2e
        description: Non-NFC device hides the button entirely
        given: a simulator or device without NFC support
        when: the Spend form renders
        then: only the Spend money submit is shown — no "Tap a card" button is rendered

  - id: tap-a-card-disabled-until-amount-positive
    claim: The Tap a card button shares the same enabled rule as the existing Spend money submit — disabled until the amount field is greater than zero.
    surface: wallet/kid-balance#spend-form
    notes: |
      Mirrors `submit-disabled-until-amount-positive` on wallet/kid-balance —
      one rule, two buttons. If the existing submit rule ever loosens or
      tightens, this one follows.
    test_cases:
      - id: 1
        level: e2e
        description: Tap a card starts disabled on an empty form
        given: Mia's Spend form has just opened with the amount field empty
        when: the parent inspects the Tap a card button
        then: it is visibly disabled and tapping does nothing
      - id: 2
        level: e2e
        description: Tap a card enables when a positive amount is entered
        given: the Spend form is open with the Tap a card button disabled
        when: the parent types "$3.00" into the amount field
        then: the Tap a card button becomes enabled at the same moment as the Spend money submit

  - id: tap-a-card-opens-modal
    claim: Tapping the Tap a card button opens the tap-to-charge modal and starts an NFC reader session. The modal header shows the focused kid's name and the entered amount.
    surface: tap-to-charge-modal
    interaction: view
    test_cases:
      - id: 1
        level: e2e
        description: Modal opens with kid name and amount
        given: Mia's Spend form is open with amount "$5.00"
        when: the parent taps Tap a card
        then: a modal opens with "Tap Mia's card" and "to charge $5.00", and the NFC session is active
      - id: 2
        level: integration
        description: Opening the modal starts exactly one NFC reader session
        given: the Spend form is open with a valid amount
        when: the parent taps Tap a card
        then: the NFC reader session is requested exactly once for the duration of the modal

  - id: correct-card-commits-charge
    claim: When the scanned card's kid id matches the kid the form is open for, a Spend transaction is recorded against that kid for the amount entered. The modal dismisses and the user returns to the kid's detail screen with the new balance shown.
    surface: tap-to-charge-modal
    interaction: tap-card
    notes: |
      End state is identical to the existing parent-driven Spend submit —
      the tap is just an alternative trigger. The reason field carries
      through; an empty reason defaults to "Card tap".
    test_cases:
      - id: 1
        level: integration
        description: Matching card commits the spend
        given: Mia's Spend form is open with amount "$5.00", and Mia's card (familywallet://kid/<Mia's id>) is tapped
        when: the NFC session resolves the tag
        then: a −$5.00 spend transaction is recorded for Mia, the modal closes, and Mia's detail shows the new balance
      - id: 2
        level: integration
        description: Empty reason defaults to "Card tap"
        given: the Spend form is open with reason blank and amount "$3.00", and Mia's card is tapped
        when: the transaction is recorded
        then: the transaction's reason is "Card tap"
      - id: 3
        level: integration
        description: Typed reason is preserved on tap-confirmed spend
        given: the Spend form is open with reason "Movie ticket" and amount "$3.00", and Mia's card is tapped
        when: the transaction is recorded
        then: the transaction's reason is "Movie ticket"

  - id: wrong-card-rejected
    claim: If the scanned card's kid id does not match the kid the form is open for, no transaction is recorded. The modal shows a message naming both kids ("That's Leo's card, not Mia's") and offers Try again or Cancel.
    surface: tap-to-charge-modal
    element: error-message
    interaction: tap-card
    notes: |
      Strict match by design — the form's kid context is authoritative.
      Switching kids requires going back to family list and opening the
      other kid's Spend form, not tapping a different card.
    test_cases:
      - id: 1
        level: integration
        description: Wrong card is named by the other kid's name and rejected
        given: Mia's Spend form is open with amount "$5.00", and Leo's card is tapped
        when: the NFC session resolves the tag
        then: no transaction is recorded; the modal shows "That's Leo's card, not Mia's"
      - id: 2
        level: e2e
        description: Try again restarts the NFC session
        given: the modal has just rejected Leo's card while Mia's form is open
        when: the parent taps Try again
        then: the NFC session restarts and the modal returns to the waiting state
      - id: 3
        level: e2e
        description: Cancel from the rejection state closes cleanly
        given: the modal is in the rejection state ("That's Leo's card, not Mia's")
        when: the parent taps Cancel
        then: the modal closes, no transaction is recorded, and the Spend form is shown with amount and reason intact

  - id: unrecognized-card-rejected
    claim: If the tag holds no URL record, or a URL that doesn't match the familywallet kid scheme, the modal shows "Card not recognized" and no transaction is recorded.
    surface: tap-to-charge-modal
    element: error-message
    interaction: tap-card
    test_cases:
      - id: 1
        level: integration
        description: Tag with a non-familywallet URL is rejected
        given: a card programmed with "https://example.com" is tapped while Mia's Spend form is open
        when: the NFC session resolves the tag
        then: no transaction is recorded; the modal shows "Card not recognized"
      - id: 2
        level: integration
        description: Tag with no NDEF URL record is rejected
        given: an empty or non-NDEF tag is tapped while the modal is waiting
        when: the NFC session resolves the tag
        then: no transaction is recorded; the modal shows "Card not recognized"

  - id: unknown-kid-id-rejected
    claim: If the tag's URL is a well-formed familywallet kid URL but the id does not match any kid in the database, the modal shows "Card not recognized" and no transaction is recorded.
    surface: tap-to-charge-modal
    element: error-message
    interaction: tap-card
    notes: |
      Handles cards programmed for a deleted kid, a different install, or
      a typo'd id. Failure mode is identical to a fully unrecognized tag —
      clear message, no commit, parent retries or cancels.
    test_cases:
      - id: 1
        level: integration
        description: Well-formed URL with unknown id is rejected
        given: a card programmed with "familywallet://kid/9999" (no kid with id 9999 exists) is tapped
        when: the NFC session resolves the tag
        then: no transaction is recorded; the modal shows "Card not recognized"

  - id: cancel-during-scan-records-nothing
    claim: Tapping Cancel from the tap-to-charge modal closes the modal and ends the NFC session without recording any transaction. The underlying Spend form remains open with amount and reason intact, ready for a retry.
    surface: tap-to-charge-modal
    element: cancel-button
    interaction: tap
    test_cases:
      - id: 1
        level: e2e
        description: Cancel from the waiting state records nothing
        given: the tap-to-charge modal is open in the waiting state for Mia at $5.00
        when: the parent taps Cancel
        then: the modal closes, no transaction is recorded, and the Spend form shows amount "$5.00" intact
      - id: 2
        level: integration
        description: Cancel cleanly ends the NFC reader session
        given: an active NFC session driven by the modal
        when: Cancel is tapped
        then: the NFC reader session is cancelled and no further tag reads are processed for this modal

  - id: deep-link-opens-kid-detail
    claim: Tapping a programmed card outside of an active tap-to-charge session deep-links into that kid's detail screen via the app's familywallet:// scheme. This works whether the app is closed, backgrounded, or open on another screen.
    notes: |
      No code in THIS feature handles the deep-link directly — expo-router's
      default linking on app/(tabs)/(family)/kid/[id].tsx resolves the URL.
      This behavior asserts the seam holds end-to-end from the NFC tag to
      the rendered screen.
    test_cases:
      - id: 1
        level: e2e
        description: Tapping a card with the app closed lands on kid-detail
        given: the app is not running and a card with "familywallet://kid/<Mia's id>" is tapped (or the URL is opened via the OS)
        when: the OS dispatches the URL
        then: the app opens and lands on Mia's kid-detail screen
      - id: 2
        level: e2e
        description: Tapping a card while the app is on another screen routes to kid-detail
        given: the app is open on the Tasks tab
        when: the OS dispatches "familywallet://kid/<Mia's id>"
        then: the app routes to Mia's kid-detail screen

  - id: nfc-url-format-is-stable
    claim: Each kid has a single canonical NFC URL of the form "familywallet://kid/<id>" derived deterministically from the kid's database id. The URL never changes for the life of the kid record.
    notes: |
      Stability matters because cards are written once and used forever.
      If the URL format ever needs to change in the future, existing cards
      must continue to resolve — the URL parser is the compatibility seam,
      not the writer.
    test_cases:
      - id: 1
        level: unit
        description: URL is exactly familywallet://kid/<id>
        given: a kid with id 3
        when: the NFC URL is computed for that kid
        then: the result is exactly "familywallet://kid/3"
      - id: 2
        level: unit
        description: URL parser accepts canonical form and rejects others
        given: parser input "familywallet://kid/3"
        when: parsed
        then: kid id 3 is returned; "familywallet://kid/abc" returns no id; "familywallet://kid/" returns no id

  - id: edit-kid-exposes-nfc-url
    claim: The Edit kid screen shows an "NFC URL" snippet with the kid's canonical URL, a Copy button, and a one-line hint about programming a card with an external tool. The snippet is part of the kid's configuration, not the live wallet view — programming a card is a setup task, not a daily action.
    surface: edit-kid-nfc-snippet
    element: nfc-url-text
    interaction: view
    notes: |
      Lives on the Edit kid screen (reached via the Edit affordance on
      kid-detail) and NOT on kid-detail itself. The kid-detail screen
      stays focused on balance + transactions; NFC card setup is a
      one-time configuration step alongside name / color / avatar.
    test_cases:
      - id: 1
        level: e2e
        description: NFC URL snippet renders on the Edit kid screen
        given: Mia exists and the parent opens her Edit screen
        when: the screen renders
        then: a row shows the label "NFC URL" and the text "familywallet://kid/<Mia's id>" alongside a Copy button
      - id: 2
        level: e2e
        description: Add kid (not editing) does NOT show the NFC URL snippet
        given: the parent is creating a new kid (no id assigned yet)
        when: the Add kid screen renders
        then: no NFC URL snippet is shown — the kid has no id until they are saved

  - id: copy-button-copies-url
    claim: Tapping Copy puts the kid's NFC URL on the system clipboard and shows a brief "Copied!" confirmation.
    surface: edit-kid-nfc-snippet
    element: copy-button
    interaction: tap
    test_cases:
      - id: 1
        level: integration
        description: Copy places the URL on the clipboard
        given: Mia's Edit kid screen is shown with the NFC URL snippet
        when: the parent taps Copy
        then: the clipboard contents are "familywallet://kid/<Mia's id>" and a "Copied!" confirmation appears briefly
---

# NFC card

Each kid gets a writeable NFC card that acts as their "credit card" in the app. Two scenarios use the same card content:

- **Tap to confirm a charge.** A parent rings up a Spend on the form, taps "Tap a card", and the kid taps their card to settle it. Mirrors a real point-of-sale.
- **Tap to open my wallet.** Tapping a card anywhere else deep-links straight into that kid's detail screen.

The card holds one NDEF URL record (`familywallet://kid/<id>`); the rest is context — what the app does with the tap depends on what's open when the tap happens.
