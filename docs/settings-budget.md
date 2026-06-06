# Settings: Budget

Status: Current
Last reviewed: 2026-06-06

The Settings -> Budget page manages the monthly budget basis and category allocation used by the dashboard and insights.

## Current Experience

- The page is summary-first by default on mobile and desktop.
- Mobile uses a single-column flow: header, monthly budget basis, budget allocation, then supporting usage/details cards.
- Desktop uses a two-column layout: the main column shows budget basis and allocation; the secondary column explains how the budget is used and shows compact details.
- Editing happens through the pencil action on the Monthly budget basis card instead of showing the raw income/configuration form by default.
- The page intentionally exposes one edit action on the main budget card to avoid duplicate CTAs for the same budget edit flow.
- Mobile uses the existing tray-style dialog behavior. Desktop uses the same dialog component as a centered modal.

## Components

- `BudgetSettingsPage` owns loading, edit state, save state, validation state, and API calls.
- `BudgetSummaryCard` presents the monthly budget basis and owns the single visible edit action.
- `BudgetAllocationCard` presents the stacked allocation summary and category targets.
- `BudgetUsageCard` explains how the monthly budget affects dashboard targets, spending progress, and insights.
- `BudgetDetailsCard` provides compact supporting details for budget basis, main income, extra income, and allocation mode.
- `BudgetAllocationSummary` is presentation-only and derives display values from existing budget allocation state and income.
- `IncomeBreakdownForm` and `BudgetAllocationForm` remain the editable form controls.

Budget calculation logic remains in `lib/income-breakdown.ts` and `lib/budget-allocation.ts`. The page continues to use those utilities for monthly income, hourly income, extra income, payload shape, allocation validation, and saved budget behavior.

## Design Decisions

- Desktop now follows the stronger mobile summary-first model.
- The raw income/configuration form is no longer the default desktop state.
- "Budget basis" is used for the user-facing concept because this page sets the monthly amount the app plans against.
- Editing is treated as a secondary action behind the single pencil action on the main budget card.
- Helper cards are informational only; the right column explains and summarizes instead of duplicating edit actions from the main page.
- Existing calculation logic and API payload behavior were preserved.

## iOS Home Screen QA Checklist

- Open Settings -> Budget from the iOS Home Screen web app.
- Check light mode and dark mode.
- Confirm bottom navigation clears the home indicator.
- Confirm page content can scroll to the bottom without being hidden behind bottom navigation.
- Open Edit Budget and confirm the tray handle, close button, and footer are visible.
- Toggle Monthly / Hourly for main income.
- Focus amount inputs with the software keyboard open.
- Change extra income controls and inputs.
- Edit allocation fields.
- Confirm the Preview section updates while editing.
- Confirm the tray scrolls to the bottom.
- Confirm no fields are hidden behind the sticky footer.
- Save changes.
- Cancel without saving.
- Return to Settings with the back button.
