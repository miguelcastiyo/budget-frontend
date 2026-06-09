# UI Patterns

Status: Current  
Last reviewed: 2026-06-09

This document tracks shared frontend patterns that should be reused before adding page-specific UI plumbing.

## Responsive Dialog / Tray

Use `components/ui/responsive-dialog.tsx` for modal flows that should behave as:

- a bottom tray on mobile and iOS Home Screen web app mode
- a centered modal on desktop
- a scrollable body with fixed header and optional fixed footer
- swipe-dismiss on mobile using the existing `useSwipeDismiss` hook
- safe-area-aware footer spacing for iOS
- the standard drag handle and close button

Current users:

- Settings -> Budget edit flow
- Settings -> Data Import CSV flow
- Settings -> Recurring create/edit flows
- Settings profile edit flow

Use page-specific `DialogContent` or `SheetContent` directly only when the layout does not fit the header/body/footer model or when a component already has a specialized interaction contract.

## Notes

- Keep business logic in the page or feature component; `ResponsiveDialog` should only own layout, scroll, close, and mobile tray behavior.
- Prefer passing existing footer actions into the shell instead of duplicating sticky footer classes.
- If a future iOS tray issue appears, fix the shell first and then audit remaining direct modal implementations.
