# Auth

## Password Reset
- `/password-reset` submits `POST /api/v1/auth/password-reset/request`.
- `/password-reset/[token]` submits `POST /api/v1/auth/password-reset/confirm`.
- Password reset routes are public in `AuthGate` and `AuthProvider`, so unauthenticated users are not redirected to sign-in before they can request a reset.
- Request success copy stays generic so the UI does not reveal whether an email belongs to an account.
- Successful reset confirmation redirects back to `/sign-in`.
