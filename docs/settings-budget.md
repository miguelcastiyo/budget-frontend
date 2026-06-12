# Settings: Budget

Status: Current
Last reviewed: 2026-06-11

The Settings -> Budget page manages the monthly budget basis and category allocation used by the dashboard and insights.

## Current Experience

- The page is summary-first by default on mobile and desktop.
- The page defaults to the current month and includes compact month navigation for choosing which budget to view or edit.
- The page loads the selected month resolution and the read-only budget version timeline independently, so a timeline failure does not block the main budget view.
- Mobile uses a single-column flow: header, monthly budget basis, budget allocation, then supporting usage/details cards.
- Desktop uses a two-column layout: the main column shows budget basis and allocation; the secondary column explains how the budget is used and shows compact details.
- Editing happens through the pencil action on the Monthly budget basis card instead of showing the raw income/configuration form by default.
- The page intentionally exposes one edit action on the main budget card to avoid duplicate CTAs for the same budget edit flow.
- Mobile uses the shared `ResponsiveDialog` tray behavior. Desktop uses the same shell as a centered modal.
- Near the top of the page, a short status message explains the selected month using one of three cases: exact month, inherited month, or no budget yet.
- Exact month copy uses: `This is an exact budget for [month].`
- Inherited month copy uses: `This month is using the budget from [month].`
- Empty-month copy uses: `No budget has been created for this month yet.`
- The page includes a read-only Budget Timeline section that lists version history, apply ranges, income, allocation mode, and resolved category amounts.
- The page avoids user-facing technical terms such as version, resolver, and effective date in the primary copy, but the timeline section is intentionally more explicit because it explains how month resolution works.
- Mobile adds extra safe-area-aware bottom padding so the allocation card can scroll fully above the fixed bottom navigation and iOS home indicator.

## Components

- `BudgetSettingsPage` owns loading, edit state, save state, validation state, and API calls.
- `BudgetSummaryCard` presents the monthly budget basis and owns the single visible edit action.
- `BudgetAllocationCard` presents the stacked allocation summary and category targets.
- `BudgetUsageCard` explains how the monthly budget affects dashboard targets, spending progress, and insights.
- `BudgetDetailsCard` provides compact supporting details for budget basis, main income, extra income, and allocation mode.
- `BudgetTimelineCard` renders the read-only list of budget versions and handles empty/loading/error states for the versions endpoint.
- `BudgetAllocationSummary` is presentation-only and derives display values from existing budget allocation state and income.
- `IncomeBreakdownForm` and `BudgetAllocationForm` remain the editable form controls.
- `MonthSelector` controls the selected budget month and allows future months on this page.
- `ResponsiveDialog` owns the edit modal/tray shell, including mobile swipe-dismiss, drag handle, close button, scroll body, and safe-area footer spacing.

Budget calculation logic remains in `lib/income-breakdown.ts` and `lib/budget-allocation.ts`. The page continues to use those utilities for monthly income, hourly income, extra income, payload shape, allocation validation, and saved budget behavior. Saves include `effective_month` so the backend can create or replace the selected month's version.
The page now uses `GET /me/budget-settings?month=YYYY-MM` for selected-month resolution and `GET /me/budget-settings/versions` for the timeline.

## Design Decisions

- Desktop now follows the stronger mobile summary-first model.
- The raw income/configuration form is no longer the default desktop state.
- "Budget basis" is used for the user-facing concept because this page sets the monthly amount the app plans against.
- Editing is treated as a secondary action behind the single pencil action on the main budget card.
- Helper cards are informational only; the right column explains and summarizes instead of duplicating edit actions from the main page.
- Existing calculation logic and API payload behavior were preserved.
- Month-aware API metadata is used to distinguish inherited budgets from exact month matches.
- The read-only budget timeline uses backend-resolved amounts instead of recalculating category totals on the client.
- The mobile allocation summary keeps the allocation bar, then switches the three targets into stacked label/value rows to avoid cramped cards on narrow screens.
- The visual direction remains a modern financial notebook: calm surfaces, compact settings-style hierarchy, subtle borders, and restrained copy.

## iOS Home Screen QA Checklist

- Open Settings -> Budget from the iOS Home Screen web app.
- Repeat the core checks in mobile Safari.
- Check light mode and dark mode.
- Confirm bottom navigation clears the home indicator.
- Confirm page content can scroll to the bottom and the allocation card is not hidden behind bottom navigation.
- Confirm previous and next month controls remain tappable.
- Confirm inherited month copy uses `Using your [month] budget.`
- Confirm exact-match month copy uses `Editing your [month] budget.`
- Open Edit Budget and confirm the tray handle, close button, and footer are visible.
- Toggle Monthly / Hourly for main income.
- Focus amount inputs with the software keyboard open.
- Change extra income controls and inputs.
- Edit allocation fields.
- Confirm the Preview section updates while editing.
- Confirm the tray scrolls to the bottom.
- Confirm no fields are hidden behind the sticky footer.
- Save changes.
- Change the selected month and confirm inherited/exact budget copy updates.
- Confirm the selected-month status copy uses the exact, inherited, and empty-month phrasing above.
- Confirm the Budget Timeline loads independently from the selected month resolution.
- Confirm the Budget Timeline shows the correct apply range and resolved amounts.
- Confirm a timeline failure still leaves the selected budget view usable.
- Save an inherited month and confirm the CTA includes the selected month.
- Cancel without saving.
- Return to Settings with the back button.
