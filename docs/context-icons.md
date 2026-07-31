# Context icon palette

Contexts have a separate curated icon palette from Tags. The shared frontend palette and backend `ContextIconKeys` allow-list must stay in sync.

The palette includes lifestyle and activity icons such as `coffee`, `utensils`, `book_open`, `shopping_bag`, `shirt`, `sparkles`, `droplet`, `scissors`, `film`, and `cookie`, in addition to the existing travel, place, event, and project icons.

The named-account remap is intentionally not automatic. After unlocking the encrypted authority, an explicitly invoked client utility may call `remapNamedEncryptedContextIcons(authority)`. It matches exact context names and updates only `icon_key`; names, IDs, transaction relationships, and all other fields are preserved. No backend plaintext search or migration is used.
