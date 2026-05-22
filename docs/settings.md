# Settings Page

## Summary Data
- The Settings landing page uses `GET /api/v1/me/settings-summary`.
- This endpoint returns monthly income, taxonomy counts, recurring rule count, current-month recurring committed total, and average monthly spend.
- The page no longer loads every transaction client-side to calculate average monthly spend.

## Display Behavior
- Desktop shows the summary strip in the profile card.
- Mobile keeps the existing compact Settings list and bottom navigation.
- If budget settings have not been saved, the Budget row falls back to `Set your monthly budget`.
