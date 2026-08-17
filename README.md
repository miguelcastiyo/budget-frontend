# Budget Frontend

Production: [https://www.miguelcastillo.info/projects/budget/](https://www.miguelcastillo.info/projects/budget/)

## Local frontend preview

Use the project-owned launcher from this directory:

```bash
scripts/dev-local.sh
```

It uses Node 22.x, binds Next.js to `127.0.0.1`, and starts the app at:

```text
http://127.0.0.1:3000
```

If port `3000` is already occupied, either open the URL if the existing process is the Budget frontend, or choose a different port:

```bash
PORT=3001 scripts/dev-local.sh
```

## Authentication during development

Use the normal sign-in UI or authentication endpoint. The resulting session
cookie authenticates web requests, and the CSRF token returned with the
session must be sent with cookie-session mutations. For supported native-client
testing, use `Authorization: Session <session_token>`.

Run diagnostics when local startup is confusing:

```bash
scripts/doctor-local.sh
```

## Runtime

This project is pinned to Node 22.x in `.nvmrc` and `package.json` because it is an LTS runtime and matches the installed dependency types. The local launcher intentionally prefers Homebrew `node@22` or nvm's `.nvmrc` runtime instead of whatever global `node` happens to be first on PATH.

Node 25 can be tested after the local Node 25 install is repaired, but it is not the stabilized default for this project. To intentionally test another Node binary:

```bash
BUDGET_NODE_BIN=/path/to/node BUDGET_ALLOW_NODE_MISMATCH=1 scripts/dev-local.sh
```

## Validation commands

`npm test` runs the fail-fast deterministic frontend suite, including typecheck, domain, authority, encrypted-boundary, security, fixture, and helper checks.

Use the following commands for broader validation:

- `npm run lint` — ESLint checks.
- `npm run build` — production build.
- `npm run test:browser` — Playwright browser suite using the standard configuration.
- `npm run test:vault-crypto` — focused Vault and Quick Unlock browser checks.
- `npm run test:encrypted-records` — encrypted-record browser checks.

Individual fast checks remain available as `npm run test:<name>` commands for targeted debugging.
