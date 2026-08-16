# Financial Authority compatibility audit (Phase 5A / 5B)

Phase 5 began as an evidence-gathering exercise. Phase 5B now records the
selective retirement decisions below. No encrypted records are rewritten.

## Classification inventory

| Area | Compatibility behavior | Initial classification | Evidence path |
| --- | --- | --- | --- |
| Record families | `tags`, `transactions`, `recurring_expenses`, and other family aliases in `adapters.ts` | READ-COMPATIBILITY until production scan | Raw decrypted payload audit |
| Data fields | camelCase-to-snake_case aliases in `adapters.ts` | READ-COMPATIBILITY until production scan | Raw decrypted payload audit |
| Transaction/budget shapes | `amount`, `transaction_date`, percent/amount and income aliases in `rehydrate.ts` | READ-COMPATIBILITY until production scan | Raw decrypted payload audit plus fixture search |
| Relationships | camelCase relationship fields and numeric/namespaced reference matching | KEEP numeric; RETIRED namespaced tail matching | Reference-shape counters and fixture search |
| Recurring shapes | `id`, `source_id`, `sourceId`, `seriesId`, and amount aliases | READ-COMPATIBILITY until production scan | Raw field counters plus fixture search |
| Schema versions | Bare `v1` normalization | RETIRED | Production report plus adapter test update |
| Schema versions | Canonical `*_v1` validation | KEEP | Current writer contract |

## Privacy-safe production evidence

`EncryptedFinancialAuthority` now accumulates `getCompatibilityAudit()` while
bootstrapping. The report contains only counts and shape names:

- records scanned
- family-alias counts
- field-alias counts
- namespaced and numeric reference counts
- legacy schema-version counts
- numeric legacy record-ID count

It never includes record IDs, names, amounts, dates, or relationship values.
Because the audit runs before canonicalization, family aliases are not lost.

The temporary owner capture route was removed after the production report was
collected. The in-memory audit getter and metadata-only scanner remain
available for a future evidence pass if needed.

## Retirement rule

No alias is safe to delete from source code based only on the current writer.
Retirement requires production count zero, understood local fixture usage, and
no historical test dependency. A non-zero production count means the reader
stays in place; this phase does not introduce an automatic record rewrite.

## Phase 5B gate result (production report)

The captured production report covered 1,114 encrypted records. It observed:

- `budget_settings` family alias: 1
- Legacy budget field aliases: 3 occurrences each across the observed budget records
- `amount`: 808; `transaction_date`: 784
- CamelCase transaction fields: 149 occurrences each for the reported fields
- Namespaced references: 0
- Numeric references: 3,444
- Numeric legacy record IDs: 1,000
- Legacy schema versions: 0

KEEP: `budget_settings`, all observed budget aliases, transaction amount/date
aliases, camelCase transaction/reference fields, numeric record IDs, and numeric
reference matching. These all have non-zero production observations.

RETIRED: namespaced tail-based reference matching. The production count was
zero, and the only local dependency was an explicit adapter assertion; that
assertion was updated to verify exact and numeric matching instead. Namespaced
record IDs remain valid when matched exactly; only the compatibility behavior
that equated `prefix:value` with `value` was removed.

RETIRED: bare `v1` schema-version normalization. Current writers use canonical
`family_v1` versions, production reported no legacy schema versions, and the
local adapter test now uses the canonical form. Canonical `*_v1` validation
remains.

No encrypted records were rewritten or migrated.
