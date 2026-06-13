# UI Patterns

Status: Current  
Last reviewed: 2026-06-13

This document tracks shared frontend patterns that should be reused before adding page-specific UI plumbing.

## Responsive Dialog / Tray

Use `components/ui/responsive-dialog.tsx` for modal flows that should behave as:

- a bottom tray on mobile and iOS Home Screen web app mode
- a centered modal on desktop
- a scrollable body with fixed header and optional fixed footer
- swipe-dismiss on mobile using the existing `useSwipeDismiss` hook
- safe-area-aware footer spacing for iOS
- the standard drag handle and close button

Mobile size modes:

- `mobileSize="full"` for longer forms and multi-step flows that should claim a full working surface on mobile.
- `mobileSize="compact"` for short forms and lightweight detail trays that should hug content and only grow taller when needed.

Current users:

- Settings -> Budget edit flow
- Settings -> Data Import CSV flow
- Settings -> Recurring create/edit flows
- Settings -> Recurring detail flow
- Settings profile edit flow
- Settings -> Tags create/edit flows
- Settings -> Invites create flow
- Settings -> API Keys create and reveal flows

## Responsive Confirmation Dialog / Tray

Use `components/ui/responsive-confirm-dialog.tsx` for destructive or confirm/cancel flows that should behave as:

- a bottom tray on mobile and iOS Home Screen web app mode
- a centered modal on desktop
- a fixed header and safe-area-aware footer
- guarded dismissal while a destructive action is pending

Current users:

- Settings -> Cards remove confirmation
- Settings -> Tags remove confirmation
- Settings -> Recurring delete confirmation
- Settings -> Data import rollback confirmation
- Settings -> API key revoke confirmation

Use page-specific `DialogContent` or `SheetContent` directly only when the layout does not fit the header/body/footer model or when a component already has a specialized interaction contract.

## Notes

- Keep business logic in the page or feature component; `ResponsiveDialog` should only own layout, scroll, close, and mobile tray behavior.
- Keep destructive mutation logic in the page or feature component; `ResponsiveConfirmDialog` should only own presentation and dismissal behavior.
- Prefer passing existing footer actions into the shell instead of duplicating sticky footer classes.
- Prefer `mobileSize="compact"` for short create/edit/detail flows where the content would otherwise leave large empty vertical space.
- If a future iOS tray issue appears, fix the shell first and then audit remaining direct modal implementations.
