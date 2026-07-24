# Settings: Contexts

Status: Current

Contexts are optional transaction dimensions for grouping related spending across tags, such as trips, events, projects, or one-off purchases.

The Settings -> Contexts page mirrors Tags: users can create, rename, change the icon for, and remove contexts using the same responsive dialogs, confirmation flow, icon vocabulary, automatic icon fallback, loading states, and empty states. Contexts are never required for transactions.

Transactions expose Context as secondary enrichment. In the filter drawer, Context supports the same multi-select behavior as Tags and is serialized as `context_ids`. In Add/Edit Transaction, Context lives in More details, starts empty for new transactions, uses the same chip selector and inline `New context` flow as Tags, and can be created with a name and icon. Creating a context inline selects it only for the transaction currently being edited; it is not sticky across new transactions.

Context creation and editing reuse the Tag icon picker interaction, but expose a separate context-only icon set: place, calendar, event, building, project, outdoors, adventure, landmark, world, and milestone. Context icons never overlap tag icon keys. A null icon key uses automatic context name-based fallback.

On desktop, the fixed context icon set is displayed in a balanced six-column grid; on mobile it remains horizontally scrollable.
