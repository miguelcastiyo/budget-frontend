# Settings: Recurring

Status: Current  
Last reviewed: 2026-06-06

The Settings -> Recurring page manages monthly recurring expense items.

## Current experience

- Mobile uses a compact single-column flow: header, intro copy, month summary, mobile add button, then recurring items.
- Desktop uses a wider settings layout with the main content on the left and a compact helper/summary rail on the right.
- The summary card keeps month selection, committed total, and recurring item count visible.
- Recurring rows show expense, tag/card, billing schedule, next projected date, amount, and active/inactive status.
- Tapping or clicking the main row opens edit for faster management.
- Row edit and delete actions are also available from an overflow menu; delete still confirms before mutating data.
- New and edit use the existing mobile tray / desktop modal pattern, grouped into Expense, Schedule, and Status sections.
- The desktop right rail provides a short helper panel and an "Upcoming this month" list derived from already loaded recurring item data.

## Preserved behavior

- Month selection and projected recurring totals are still loaded from the recurring expenses API.
- Create, edit, delete, category, tag, card, billing rule, billing day, start month, end month, and active status behavior remain unchanged.
- Mobile tray swipe-dismiss, dialog close, cancel, save validation, and dark/light mode support are preserved.

## Design decisions

- "Rules" was renamed to "Recurring items" in user-facing labels because it describes the user's bills rather than the system model.
- "Added for June 2026" was removed from the default row view to reduce metadata noise; rows focus on what, how much, category/card, status, and next date.
- Row tap opens edit, while the overflow menu keeps secondary and destructive actions available without making the list feel like an admin table.
- Mobile spacing was tightened around the header, intro, summary card, list header, and rows so the first recurring item appears sooner.
- The mobile add action appears as a visible "Add recurring expense" button below the summary while the header action remains available.
- The submit button uses muted disabled styling and short validation hints for missing name, invalid amount, invalid billing day, or no edit changes.
- Tray content includes extra bottom padding and a safe-area-aware sticky footer so fields remain reachable on iOS and mobile keyboards.

## iOS Home Screen QA Checklist

- Launch the app from the iOS Home Screen and navigate to Settings -> Recurring.
- Check light mode and dark mode.
- Confirm the bottom navigation clears the iPhone home indicator.
- Confirm the recurring list can scroll to the final item with breathing room above bottom navigation.
- Open the new recurring tray and confirm the drag handle, close button, and sticky footer are visible.
- Focus Amount and confirm the input remains reachable with the software keyboard open.
- Focus Expense name and confirm the input remains reachable with the software keyboard open.
- Focus Billing day and confirm the input remains reachable with the software keyboard open.
- Scroll to Schedule, Status, and the bottom of the tray without fields being covered by the footer.
- Create a recurring expense with valid required fields.
- Edit an existing item by tapping the row.
- Edit an existing item from the overflow menu.
- Delete an existing item from the overflow menu and confirmation dialog.
- Change the selected month and confirm the month picker is readable and not clipped.
- Sanity check portrait and landscape/responsive widths if orientation is supported.
