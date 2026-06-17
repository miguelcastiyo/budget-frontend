# Settings: Recurring

Status: Current  
Last reviewed: 2026-06-16

The Settings -> Recurring page manages monthly recurring expense items.

## Current experience

- Mobile uses a compact single-column flow: header with the single Add action, intro copy, month summary, then recurring items.
- Desktop uses a wider settings layout with the main content on the left and a compact helper/summary rail on the right.
- The summary card keeps month selection, committed total, and recurring item count visible.
- The page is month-based, not day-based; month selection uses a month-only picker with year controls and a Current month shortcut.
- The main commitments list now renders one visible row per `series_id` for the selected month, so future scheduled versions do not appear as duplicate rows.
- Mobile rows are intentionally compact: name, amount, and a single subtitle line with due date, tag, and selected-month status.
- The list can be sorted locally by newest or oldest projected date without changing backend behavior.
- Tapping or clicking a recurring row opens a detail sheet, matching the transaction row interaction pattern.
- Detail now uses the shared `ResponsiveDialog` shell with `mobileSize="compact"` so the tray stays tighter than the longer create/edit forms while keeping the same shared behavior.
- Edit and Delete actions live in the detail tray; Delete still confirms before mutating data.
- Detail explains the current version as a series-level commitment, shows a scheduled future change when present, and renders version history when the series has multiple rows.
- Schedule change no longer opens a second tray on mobile. It transitions inside the same tray and supports amount, effective month, billing type, and billing day changes with a preview.
- New and edit use the existing mobile tray / desktop modal pattern, grouped into Expense, Schedule, and Status sections.
- New and edit use the shared `ResponsiveDialog` shell for mobile tray behavior, desktop modal sizing, swipe-dismiss, close handling, and scroll containment.
- Delete confirmation now uses the shared `ResponsiveConfirmDialog` shell so destructive confirmation matches the rest of Settings.
- The recurring form intentionally mirrors the money-entry pattern from Add Transaction: Amount, Description, Classification, Timing, Submit.
- Amount entry is shared with Add Transaction through the same digit-buffered `AmountInput` behavior, including paste handling, keyboard handling, large display sizing, and select-all replacement.
- The top half of the recurring form follows Amount -> Description -> Tag -> Category -> Card, then schedule-specific fields appear separately.
- Tags and cards can be created from inside the recurring form with the shared inline create controls used by Add Transaction; new items are selected immediately after creation.
- Card selection is optional but stays in the Expense section because it describes the bill.
- The desktop right rail provides a short helper panel and an "Upcoming this month" list derived from already loaded recurring item data.

## Preserved behavior

- Month selection and projected recurring totals are still loaded from the recurring expenses API.
- Create, edit, delete, category, tag, card, billing rule, billing day, start month, end month, and active status behavior remain unchanged.
- Mobile tray swipe-dismiss, dialog close, cancel, save validation, and dark/light mode support are preserved.

## Design decisions

- "Rules" was renamed to "Recurring items" in user-facing labels because it describes the user's bills rather than the system model.
- Raw recurring-rule rows are not shown directly in the default month list; the page presents one user-facing commitment per series for the selected month.
- Future scheduled versions stay out of the default month list and are surfaced through detail-tray context plus the `Changes` filter.
- The sort control mirrors the Transactions page pattern with simple Newest and Oldest date controls.
- Row tap opens details, while Edit/Delete move into the detail sheet so rows feel closer to transaction rows and less like an admin table.
- Mobile spacing was tightened around the header, intro, summary card, list header, and rows so the first recurring item appears sooner.
- Only one primary Add CTA is visible per layout: mobile uses the header "+ Add" action, while desktop uses the right-rail "Add recurring expense" action.
- On mobile, Monthly Commitments uses the page-level header `Add` action for adding recurring commitments. The global bottom navigation `Add` remains reserved for the normal transaction-add flow. The previous sticky `Add commitment` button was removed to reduce duplicate actions and improve list visibility.
- Primary mobile filters now map to the selected month mental model: `All`, `Upcoming`, `Logged`, and `Changes`.
- Recurring creation should feel like "Add Transaction + Schedule": amount is the hero field, description uses transaction-style language, tags use mobile chips, category uses segmented buttons, and optional card selection stays with expense classification.
- Inline tag/card creation should stay consistent with Add Transaction: same naming input, icon picker for tags, keyboard submit behavior, cancel behavior, and immediate selection after save.
- Field-level validation appears inline near Amount, Description, and Billing day; the sticky footer is reserved for Cancel and Save/Create actions.
- The submit button uses muted disabled styling until required fields are valid or an edit has changes.
- Tray content includes extra bottom padding and a safe-area-aware sticky footer so fields remain reachable on iOS and mobile keyboards.

## iOS Home Screen QA Checklist

- Launch the app from the iOS Home Screen and navigate to Settings -> Recurring.
- Check light mode and dark mode.
- Confirm the bottom navigation clears the iPhone home indicator.
- Confirm the recurring list can scroll to the final item with breathing room above bottom navigation.
- Confirm there is no separate sticky `Add commitment` button above the bottom navigation.
- Open the new recurring tray and confirm the drag handle, close button, and sticky footer are visible.
- Open the month picker, change the year, choose a month, and use Current month.
- Tap a recurring row and confirm the detail sheet opens and closes.
- Edit an existing item from the detail sheet.
- Delete an existing item from the detail tray and confirmation tray.
- Focus Amount and confirm the input remains reachable with the software keyboard open.
- Focus Description and confirm the input remains reachable with the software keyboard open.
- Select a tag chip and confirm the horizontal rail remains readable.
- Create a new tag from the recurring tray and confirm it is selected.
- Select each category segment.
- Select an optional card.
- Create a new card from the recurring tray and confirm it is selected.
- Focus Billing day and confirm the input remains reachable with the software keyboard open.
- Change Starts and Ends month.
- Toggle Active.
- Scroll to Schedule, Status, and the bottom of the tray without fields being covered by the footer.
- Create a recurring expense with valid required fields.
- Change the selected month and confirm the month picker is readable and not clipped.
- Sanity check portrait and landscape/responsive widths if orientation is supported.
