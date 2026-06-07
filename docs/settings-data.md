# Settings: Data Import / Export

Status: Current
Last reviewed: 2026-06-06

The Settings -> Data page lets users import transactions from CSV and export transactions to CSV. The experience follows the same modern financial notebook direction as Settings, Budget, and Recurring: calm surfaces, clear copy, guided actions, and limited CTAs.

## Landing Page

- Import CSV explains the guided flow: upload a file, map columns, and review before importing.
- Export CSV remains direct: export all transactions or choose a custom date range.
- Recent Activity shows recent imports and exports with status, scope, timestamp, and import rollback where available.

## CSV Import Flow

No transaction data is written during Upload, Map, Dates, Budget Groups, Spending Tags, or Review. Data is only written after the final import confirmation from the Review step.

1. Upload
   - Choose a CSV file.
   - Preview headers and sample rows.
   - Communicate that nothing is written until review and confirmation.

2. Map
   - Match CSV columns to Budget fields: Date, Expense, Amount, Spending tag, Card, and Split.
   - Required fields stay marked.
   - Sample rows remain available for visual confirmation.

3. Dates
   - Used only when the mapped date column has dates without a year.
   - Applies one selected year before validation.

4. Budget Groups
   - Maps imported labels into Needs, Wants, or Savings.
   - Debt-like labels should map to Needs; use the Spending Tags step to select or create `Debt`.
   - Internal APIs may still use category naming, but the import flow uses Budget Groups for user-facing clarity.

5. Spending Tags
   - Matches imported labels to existing tags or creates new spending tags.
   - Internal APIs may still use tag strategy naming.

6. Review
   - Shows what will happen before anything is written.
   - Summarizes rows checked, valid rows, rows that will import, duplicates, skipped rows, invalid rows, and any new tags/cards to be created.

7. Import Complete
   - Shows the result after the final write.
   - Done is the primary action; Import another CSV is secondary.

## Mobile And iOS QA Checklist

- Open Settings -> Data in Mobile Safari.
- Open Settings -> Data from the iOS Home Screen web app.
- Check light mode and dark mode.
- Start Import CSV.
- Upload a CSV.
- Navigate every step: Upload, Map, Dates, Budget Groups, Spending Tags, Review, Import.
- Confirm mobile step header shows Step X of 7 and current step title.
- Confirm sticky footer clears the iPhone home indicator.
- Confirm scrollable content has enough bottom padding and is not hidden behind the footer.
- Confirm sample row tables/cards do not break viewport width.
- Confirm selects and inputs remain reachable with the keyboard open.
- Confirm closing the tray returns to a usable Data page.
- Confirm bottom navigation does not interfere while the modal/tray is open.
- Confirm export all time and custom date range still work.

## Design Decisions

- The import flow uses "Budget Groups" for Needs / Wants / Savings.
- The import flow uses "Spending Tags" for user labels such as Dining, Coffee, Utilities, and Transportation.
- Helper copy emphasizes preview and review to reduce anxiety.
- Review is the trust checkpoint; it describes what will be imported or skipped before data is written.
- Simple steps use compact content while complex steps can scroll within the modal/tray.
