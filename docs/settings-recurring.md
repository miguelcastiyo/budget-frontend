# Recurring Settings Page

## Modernized Create/Edit Flow
- Creating and editing recurring expenses now uses modal dialogs instead of inline card editing.
- Dialogs follow the same interaction pattern used elsewhere in the app:
  - clear title + helper description
  - structured form sections
  - explicit `Cancel` and primary save actions

## Form Hierarchy
- Amount is now presented first with stronger visual weight.
- Core fields are grouped to reduce visual noise:
  - Expense
  - Category + Tag
  - Optional card
  - Billing rule + billing day
  - Start/end month
  - Active state

## Behavior
- Existing recurring CRUD behavior is unchanged.
- Edit still updates future recurring behavior.
- Delete still removes the recurring rule (existing generated transactions remain unchanged).
