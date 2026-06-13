# Settings: Tags

Status: Current  
Last reviewed: 2026-06-13

The Settings -> Tags page manages the available tag library used to organize transactions.

## Current experience

- Mobile uses the existing compact settings flow with a single-column page, icon-only create action, direct edit/remove row actions, and bottom tray create/edit forms.
- Create and edit now use the shared `ResponsiveDialog` shell with `mobileSize="compact"` so short tag forms hug their content on mobile instead of expanding into a tall tray.
- Remove confirmation now uses the shared `ResponsiveConfirmDialog` shell so destructive actions also follow the same mobile tray / desktop modal pattern.
- Desktop uses a wider management surface, an explicit "New tag" action, compact rows, and an overflow menu for row actions.
- The list card includes a simple header with the current tag count.
- Create and edit preserve auto icon behavior, manual icon selection, validation, and the existing API calls.
- The icon picker keeps horizontal scrolling on mobile and wraps on desktop so options do not clip.

## Remove Language

- User-facing copy should say "Remove tag" because the action removes the tag from the available list.
- Existing transactions that already use the tag are not changed.
- Backend and API method names may continue using delete terminology where already established.

## Preserved Behavior

- Back navigation, loading tags, creating tags, editing tag names/icons, removing tags, delete confirmation, and dark/light mode support are preserved.
- Tags can still be created from transaction flows outside this settings page.
- Transaction tag storage and display behavior are unchanged.

## QA Checklist

- Check desktop light mode and dark mode.
- Check mobile light mode and dark mode.
- Create a tag with automatic icon selection.
- Create a tag with a manual icon.
- Edit a tag name.
- Edit a tag icon.
- Remove a tag and cancel removal.
- Remove a tag and confirm it leaves existing transaction history unchanged.
- Open create/edit on mobile and confirm the tray footer stays reachable.
- Open remove confirmation on mobile and confirm it opens as a tray and stays dismissible until removal starts.
- Open create/edit on desktop and confirm the dialog is not clipped.
- Confirm desktop row overflow menu opens, closes on outside click, and supports keyboard navigation.
- Confirm loading, empty, and error states do not show a blank card.
