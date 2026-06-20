# Settings: Cards

Status: Current  
Last reviewed: 2026-06-13

The Settings -> Cards page manages the available card list used when assigning transactions to credit, debit, or account cards, including one optional favorite card.

## Current experience

- Mobile uses the existing compact settings flow with a single-column page, icon-only create action, inline create/edit controls, and direct edit/remove row actions.
- Users can mark one active card as favorite. The favorite card shows a subtle star pill and appears first anywhere cards are selected.
- Remove confirmation now uses the shared `ResponsiveConfirmDialog` shell so destructive actions follow the same mobile tray / desktop modal pattern used across Settings.
- Desktop uses a wider management surface, an explicit "New card" action, compact rows, and an overflow menu for row actions.
- The list card includes a simple header with the current card count.
- Create and edit preserve the existing inline form behavior and API calls.

## Remove Language

- User-facing copy should say "Remove card" because the action removes the card from the available list.
- Existing transactions that already use the card are not changed.
- Backend and API method names may continue using delete terminology where already established.

## Preserved Behavior

- Back navigation, loading cards, creating cards, editing card names, favoriting cards, removing cards, confirmation flow, and dark/light mode support are preserved.
- Cards can still be created from transaction flows outside this settings page.
- Favorite cards sort first in card selectors, but selectors do not auto-pick the favorite card for the user.
- Transaction suggestions remain history-based rather than favorite-based.

## QA Checklist

- Check desktop light mode and dark mode.
- Check mobile light mode and dark mode.
- Create a card.
- Edit a card name.
- Mark a card as favorite and confirm any previous favorite is cleared.
- Clear the current favorite card.
- Cancel an inline edit.
- Remove a card and cancel removal.
- Remove a card and confirm existing transaction history is unchanged.
- Remove the current favorite card and confirm no favorite badge remains on the list.
- Open remove confirmation on mobile and confirm it appears as a tray with safe-area footer spacing.
- Confirm desktop row overflow menu opens, closes on outside click, and supports keyboard navigation.
- Confirm mobile direct row actions remain comfortable to tap.
- Confirm loading, empty, and error states do not show a blank card.
