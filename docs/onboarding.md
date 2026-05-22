# Onboarding

## User-Centric Flow

Onboarding is a short guided setup that helps a new user create a usable first budget before they land on the dashboard.

The flow has four steps:

1. **Profile**
   - The user enters the display name shown in the app.
   - A non-empty name is required before continuing.

2. **Income**
   - The user estimates their average monthly take-home income.
   - They can choose a fixed monthly income or an hourly income.
   - Hourly income uses hourly rate and expected weekly hours.
   - The user can optionally add side income, such as babysitting, tutoring, gig work, or similar extra income.
   - Side income can be entered as either an average monthly amount or as hourly rate plus weekly hours.
   - The app shows the computed estimated monthly income before the user continues.

3. **Budget Allocation**
   - The user splits the computed monthly income into three budget categories:
     - Needs
     - Wants
     - Savings & Debts
   - The split can be entered by percentage or by exact dollar amount.
   - Percentage mode must total 100%.
   - Amount mode must total the computed monthly income.

4. **Review**
   - The user reviews their name, estimated monthly income, and budget split.
   - The app saves profile and budget settings only when the user finishes this step.

This flow supports both salary users and users with irregular income patterns, especially students or part-time workers who may combine a small hourly job with occasional side income.

## Technical Explanation

Onboarding writes to the existing profile and budget settings APIs. The dashboard and metrics still use `monthly_income` as the canonical budget number, so the new income breakdown does not require a metrics rework.

The main data model is `budget_settings`:

- `monthly_income` remains required and canonical.
- `income_source_type` stores whether the primary income is `monthly` or `hourly`.
- `primary_monthly_income` stores fixed monthly primary income.
- `primary_hourly_rate` and `primary_weekly_hours` store hourly primary income details.
- `side_income_type` stores `none`, `monthly`, or `hourly`.
- `side_income_label` optionally names the side income source.
- `side_monthly_income` stores fixed monthly side income.
- `side_hourly_rate` and `side_weekly_hours` store hourly side income details.

Hourly income is converted to monthly income with:

```text
hourly_rate * weekly_hours * 52 / 12
```

The frontend centralizes this math in `lib/income-breakdown.ts`, and both `/onboarding` and `/settings/budget` use the same helper and form component. This keeps the onboarding flow and later budget editing behavior aligned.

The backend accepts old budget settings payloads for compatibility. If income breakdown fields are omitted, the backend treats the request as a monthly primary income with no side income. When the new breakdown fields are provided, the backend validates that the breakdown computes to the submitted `monthly_income` after rounding to cents.

The save sequence is:

1. Update profile with the display name.
2. Upsert budget settings with:
   - Computed `monthly_income`
   - Persisted income breakdown
   - Allocation mode and allocation values
3. Refresh the auth profile so `onboarding_complete` reflects the new saved state.
4. Route the user to the dashboard.

Onboarding completion remains based on:

- Non-empty display name
- A saved budget settings row with `monthly_income > 0`

This keeps the feature additive: existing users and API clients keep working, while new users get a more accurate setup path for hourly and side income.
