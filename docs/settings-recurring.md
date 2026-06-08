# Settings: Recurring

Status: Current  
Last reviewed: 2026-06-07

The Settings -> Recurring page manages monthly recurring expense items.

## Current experience

- Mobile uses a compact single-column flow: header with the single Add action, intro copy, month summary, then recurring items.
- Desktop uses a wider settings layout with the main content on the left and a compact helper/summary rail on the right.
- The summary card keeps month selection, committed total, and recurring item count visible.
- The page is month-based, not day-based; month selection uses a month-only picker with year controls and a Current month shortcut.
- Recurring rows are grouped by projected date for the selected month and mirror recent transaction rows with a category-colored icon, title, metadata chips, amount, and chevron.
- Recurring-specific details stay visible as compact chips: tag, card when available, billing schedule, and active/inactive status.
- The list can be sorted locally by newest or oldest projected date without changing backend behavior.
- Tapping or clicking a recurring row opens a detail sheet, matching the transaction row interaction pattern.
- Edit and Delete actions live in the detail sheet; Delete still confirms before mutating data.
- New and edit use the existing mobile tray / desktop modal pattern, grouped into Expense, Schedule, and Status sections.
- The recurring form intentionally mirrors the money-entry pattern from Add Transaction: Amount, Description, Classification, Timing, Submit.
- The top half of the recurring form follows Amount -> Description -> Tag -> Category -> Card, then schedule-specific fields appear separately.
- Tags and cards can be created from inside the recurring form and are selected immediately after creation.
- Card selection is optional but stays in the Expense section because it describes the bill.
- The desktop right rail provides a short helper panel and an "Upcoming this month" list derived from already loaded recurring item data.

## Preserved behavior

- Month selection and projected recurring totals are still loaded from the recurring expenses API.
- Create, edit, delete, category, tag, card, billing rule, billing day, start month, end month, and active status behavior remain unchanged.
- Mobile tray swipe-dismiss, dialog close, cancel, save validation, and dark/light mode support are preserved.

## Design decisions

- "Rules" was renamed to "Recurring items" in user-facing labels because it describes the user's bills rather than the system model.
- "Added for June 2026" was removed from the default row view to reduce metadata noise; rows focus on what, how much, tag/card, status, schedule, and projected date grouping.
- Projected-date group headers intentionally follow the Recent Transactions list pattern while keeping recurring-specific schedule metadata in chips.
- The sort control mirrors the Transactions page pattern with simple Newest and Oldest date controls.
- Row tap opens details, while Edit/Delete move into the detail sheet so rows feel closer to transaction rows and less like an admin table.
- Mobile spacing was tightened around the header, intro, summary card, list header, and rows so the first recurring item appears sooner.
- Only one primary Add CTA is visible per layout: mobile uses the header "+ Add" action, while desktop uses the right-rail "Add recurring expense" action.
- Recurring creation should feel like "Add Transaction + Schedule": amount is the hero field, description uses transaction-style language, tags use mobile chips, category uses segmented buttons, and optional card selection stays with expense classification.
- Field-level validation appears inline near Amount, Description, and Billing day; the sticky footer is reserved for Cancel and Save/Create actions.
- The submit button uses muted disabled styling until required fields are valid or an edit has changes.
- Tray content includes extra bottom padding and a safe-area-aware sticky footer so fields remain reachable on iOS and mobile keyboards.

## iOS Home Screen QA Checklist

- Launch the app from the iOS Home Screen and navigate to Settings -> Recurring.
- Check light mode and dark mode.
- Confirm the bottom navigation clears the iPhone home indicator.
- Confirm the recurring list can scroll to the final item with breathing room above bottom navigation.
- Open the new recurring tray and confirm the drag handle, close button, and sticky footer are visible.
- Open the month picker, change the year, choose a month, and use Current month.
- Tap a recurring row and confirm the detail sheet opens and closes.
- Edit an existing item from the detail sheet.
- Delete an existing item from the detail sheet and confirmation dialog.
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
