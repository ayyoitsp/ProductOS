# Family Wallet — ProductOS demo app

A tiny mobile app used as the testbed for dogfooding ProductOS. Built with the same Expo + React Native + expo-router stack as `/Users/peter/personal/lost-powder-woods`, but uses a local SQLite database instead of a remote one.

## What it does

A "family wallet" for parents to manage allowances:

- **Kids**: add/edit/remove kids (each has a name + color)
- **Tasks**: add/edit/remove tasks (recurring or one-time, assigned to a specific kid or "anyone", with a dollar amount); completing a task credits the kid
- **Per-kid ledger**: balance + transaction history; manual + / − adjustments for gifts and spending
- **Interest**: opt-in, percent-of-balance, applied on selected days of the week. Rate is unbounded — 1000% is a valid choice to make tiny balances feel exciting

## Run

```bash
cd demo
npm install
npm start            # Expo dev server
npm run ios          # or
npm run android
npm run web
```

The DB is `family-wallet.db` in the app's documents directory; wipe via the simulator's "Delete app" if you want to reset.

## Why this exists in the productos repo

ProductOS needs a small real product to model. This app is intentionally simple but has enough real product surface (multi-tenant ledger, interest rules, edit-add-remove flows on tasks, modal flows) that the product-truth markdown + tracking sidecars will be non-trivial to write.

Next: run `productos init claude` from the productos repo root, then ask Claude to do a ProductOS pass on this demo. Watch what it proposes.
