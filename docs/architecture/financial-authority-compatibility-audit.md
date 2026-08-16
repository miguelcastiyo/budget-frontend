# Financial Authority compatibility audit (Phase 5A)

Phase 5 begins as an evidence-gathering exercise. This change does not remove
or rewrite any compatibility behavior.

## Classification inventory

| Area | Compatibility behavior | Initial classification | Evidence path |
| --- | --- | --- | --- |
| Record families | `tags`, `transactions`, `recurring_expenses`, and other family aliases in `adapters.ts` | READ-COMPATIBILITY until production scan | Raw decrypted payload audit |
| Data fields | camelCase-to-snake_case aliases in `adapters.ts` | READ-COMPATIBILITY until production scan | Raw decrypted payload audit |
| Transaction/budget shapes | `amount`, `transaction_date`, percent/amount and income aliases in `rehydrate.ts` | READ-COMPATIBILITY until production scan | Raw decrypted payload audit plus fixture search |
| Relationships | camelCase relationship fields and numeric/namespaced reference matching | READ-COMPATIBILITY until production scan | Reference-shape counters and fixture search |
| Recurring shapes | `id`, `source_id`, `sourceId`, `seriesId`, and amount aliases | READ-COMPATIBILITY until production scan | Raw field counters plus fixture search |
| Schema versions | Non-`v1`/`*_v1` versions | READ-COMPATIBILITY until production scan | Raw decrypted payload audit |

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

For temporary owner capture, set `NEXT_PUBLIC_ENABLE_COMPATIBILITY_AUDIT=1`,
unlock the production vault, and open `/dev/privacy/compatibility-audit` as an
owner. Use **Copy report** and then remove the flag and this temporary route.
The page has no API calls and only reads the in-memory aggregate report.

## Retirement rule

No alias is safe to delete from source code based only on the current writer.
Retirement requires production count zero, understood local fixture usage, and
no historical test dependency. A non-zero production count means the reader
stays in place; this phase does not introduce an automatic record rewrite.

## Phase 5B gate result (current)

No compatibility branch is retired by this change. The repository has no
persisted encrypted-record fixture corpus, and no production compatibility
report has established zero usage for any alias. Current writers use canonical
families and snake_case fields, but that is insufficient evidence to delete a
reader. Phase 5B remains gated until a production bootstrap report is captured
and reviewed against this inventory.
