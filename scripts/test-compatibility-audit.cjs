const assert = require("node:assert/strict")
const { auditEncryptedRecordPayloads, mergeCompatibilityAuditReports } = require("../lib/privacy/encrypted-records/compatibility-audit.ts")

const report = auditEncryptedRecordPayloads([{
  record_family: "transactions",
  record_schema_version: "transaction_v1",
  source_id: "42",
  data: { amountCents: 1250, tagId: "vault:tag:1", card_id: "7", amount: "12.50" },
}])
assert.equal(report.records_scanned, 1)
assert.equal(report.family_aliases.transactions, 1)
assert.equal(report.field_aliases.amountCents, 1)
assert.equal(report.namespaced_references, 1)
assert.equal(report.numeric_references, 1)
assert.equal(report.legacy_record_ids, 1)
assert.deepEqual(mergeCompatibilityAuditReports(report, report).legacy_schema_versions, {})
console.log("Encrypted compatibility audit tests passed")
