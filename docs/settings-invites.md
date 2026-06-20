# Settings: Invites

Status: Current  
Last reviewed: 2026-06-13

The Settings -> Invites page lets owners create, review, and revoke invitation links for Budget access.

## Current experience

- Mobile uses the compact Settings layout with owner-only create access and a single-column invite list.
- Create Invite uses the shared `ResponsiveDialog` shell so mobile opens as a bottom tray and desktop opens as a centered modal.
- Pending invite cards expose a revoke action with the shared `ResponsiveConfirmDialog` pattern.
- The tray keeps a fixed header, scrollable body, and safe-area-aware footer so the primary action stays reachable while editing fields on iPhone.
- Role selection, expiration presets, date picker, and email subject/body editing preserve the existing API contract and validation behavior.
- Non-owners continue to see the existing access-required state instead of the create flow.

## Preserved Behavior

- Invite list loading, status filtering, owner-only access, role selection, expiration selection, email content editing, and invite creation behavior are unchanged.
- Accepted, expired, and revoked invites remain visible for history, but only pending invites show the revoke action.

## QA Checklist

- Check mobile light mode and dark mode.
- Check desktop light mode and dark mode.
- Open Create Invite on mobile and confirm it opens as a bottom tray.
- Confirm the tray footer remains reachable with the keyboard open.
- Open Create Invite on desktop and confirm the modal is not clipped.
- Create a member invite.
- Create an admin invite.
- Revoke a pending invite and confirm it disappears from the Pending filter and remains visible in All as revoked.
- Change expiration using presets, date picker, and time buttons.
- Confirm owner-only access remains enforced.
