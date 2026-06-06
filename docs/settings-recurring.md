# Settings: Recurring

Status: Current  
Last reviewed: 2026-06-06

The Settings -> Recurring page manages monthly recurring expense rules.

## Current experience

- Mobile uses a single-column flow: header, intro copy, month summary, then recurring rules.
- Desktop uses a wider settings layout with the main content on the left and a compact helper/summary rail on the right.
- The summary card keeps month selection, committed total, and rule count visible.
- Recurring rows show expense, tag/card, billing schedule, next projected date, amount, and active/inactive status.
- Row edit and delete actions are available from an overflow menu; delete still confirms before mutating data.
- New and edit use the existing mobile tray / desktop modal pattern, grouped into Expense, Schedule, and Status sections.

## Preserved behavior

- Month selection and projected recurring totals are still loaded from the recurring expenses API.
- Create, edit, delete, category, tag, card, billing rule, billing day, start month, end month, and active status behavior remain unchanged.
- Mobile tray swipe-dismiss, dialog close, cancel, save validation, and dark/light mode support are preserved.
