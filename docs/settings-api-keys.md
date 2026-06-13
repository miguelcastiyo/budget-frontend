# Settings: API Keys

Status: Current  
Last reviewed: 2026-06-13

The Settings -> API Keys page manages personal API keys for Budget development and testing access.

## Current experience

- Mobile uses the compact Settings layout with an icon-only create action and stacked key cards.
- Create API Key uses the shared `ResponsiveDialog` shell so mobile opens as a bottom tray and desktop opens as a centered modal.
- The post-create reveal step also uses `ResponsiveDialog`, preserving the one-time key visibility warning while keeping the footer reachable on mobile.
- Revoke confirmation uses the shared `ResponsiveConfirmDialog` shell so destructive confirmation matches the rest of Settings.
- Key status display, copy, show/hide behavior, and revoke behavior are unchanged.

## Preserved Behavior

- Loading keys, creating a key, revealing the newly created key once, copying the key, and revoking an active key all keep the existing API behavior.
- Expired and revoked keys remain non-destructive display rows.

## QA Checklist

- Check mobile light mode and dark mode.
- Check desktop light mode and dark mode.
- Open Create API Key on mobile and confirm it opens as a tray.
- Create a key and confirm the reveal step opens in a tray on mobile.
- Toggle show/hide on the new key.
- Copy the new key and confirm the copied state appears.
- Revoke an active key and cancel revocation.
- Revoke an active key and confirm it disappears from the active list.
- Confirm desktop create, reveal, and revoke flows still render as centered modals.
