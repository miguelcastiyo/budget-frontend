# Settings: Contexts

Status: Current

Contexts are optional transaction dimensions for grouping related spending across tags, such as trips, events, projects, or one-off purchases.

The Settings -> Contexts page mirrors Tags: users can create, rename, change the icon for, and remove contexts using the same responsive dialogs, confirmation flow, icon vocabulary, automatic icon fallback, loading states, and empty states. Contexts are never required for transactions.

Transactions expose Context as secondary enrichment. In the filter drawer, Context supports the same multi-select behavior as Tags and is serialized as `context_ids`. In Add/Edit Transaction, Context lives in More details as a compact `+ Add` row when unused. Tapping it opens a searchable picker with Recent and All contexts, and creation happens inside the picker with name and icon selection. A selected context can be reopened or cleared, is selected only for the current transaction draft, and is never sticky across new transactions.

Context creation and editing reuse the Tag icon picker interaction, but expose a separate curated Context icon set for travel, events, places, and life projects. The set intentionally overlaps Tags for useful shared meanings such as travel, home, gifts, and hearts. A null icon key uses automatic context name-based fallback.

On desktop, the fixed context icon set is displayed in a balanced six-column grid; on mobile it remains horizontally scrollable.
