# Encrypted Vault setup

New accounts begin in `vault_setup_required`. The browser creates the Vault
key, passphrase wrapper, and Recovery Code wrapper locally, then sends only
wrapped-key material to the backend. After initialization, the account enters
the `encrypted` state and financial reads and writes use the encrypted
authority.

There is no plaintext financial migration or legacy route fallback. Existing
financial recovery is handled through the documented CSV workflow before Vault
setup; migration staging and cutover endpoints are retired.
