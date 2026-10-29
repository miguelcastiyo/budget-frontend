const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), assert = require("node:assert/strict")
const { webcrypto } = require("node:crypto"), ts = require("typescript")
const root = path.resolve(__dirname, ".."), resolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) { return resolve(request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options) }
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
global.window = { isSecureContext: true, crypto: webcrypto, location: { hostname: "example.com" } }; global.crypto = webcrypto
const { pendingCapabilitiesForAccount } = require("../lib/pending-rollout-server.ts")
const { EncryptedFinancialAuthority } = require("../lib/privacy/encrypted-authority/authority.ts")
const { createDeterministicEncryptedRecordId } = require("../lib/privacy/encrypted-records/crypto.ts")
const { parseEncryptedRecordPayload } = require("../lib/privacy/encrypted-records/adapters.ts")
const { GET: getCapabilities } = require("../app/api/pending-capabilities/route.ts")
const { GET: getReadiness } = require("../app/api/client-readiness/route.ts")
;(async () => {
  assert.deepEqual(pendingCapabilitiesForAccount("1", {}), { capture: false, recovery: false })
  assert.deepEqual(pendingCapabilitiesForAccount("1", { captureEnabled: "1", recoveryEnabled: "1", accountIds: "1, 2" }), { capture: true, recovery: true })
  assert.deepEqual(pendingCapabilitiesForAccount("10", { captureEnabled: "1", recoveryEnabled: "1", accountIds: "1" }), { capture: false, recovery: true })
  const oldFetch = global.fetch
  process.env.BUDGET_PENDING_CAPTURE_ENABLED = "1"; process.env.BUDGET_PENDING_RECOVERY_ENABLED = "1"; process.env.BUDGET_PENDING_ACCOUNT_IDS = "1"
  global.fetch = async (_url, options) => { assert.equal(options.headers.cookie, "sid=authenticated"); return Response.json({ id: "2" }) }
  const result = await getCapabilities(new Request("http://localhost/api/pending-capabilities?id=1", { headers: { cookie: "sid=authenticated" } }))
  assert.deepEqual(await result.json(), { capture: false, recovery: true }); assert.match(result.headers.get("cache-control"), /no-store/)
  assert.equal((await getCapabilities(new Request("http://localhost/api/pending-capabilities?id=1"))).status, 401)
  global.fetch = async () => { throw Error("offline") }
  assert.equal((await getCapabilities(new Request("http://localhost/api/pending-capabilities", { headers: { cookie: "sid=x" } }))).status, 503)
  global.fetch = oldFetch
  process.env.BUDGET_MIN_CLIENT_VERSION = "2"
  const version = await getReadiness(); assert.deepEqual(await version.json(), { minVersion: 2 }); assert.match(version.headers.get("cache-control"), /no-store/)
  assert.throws(() => parseEncryptedRecordPayload({ record_family: "unknown", record_schema_version: "unknown_v1", source_id: "x", data: {} }), /unsupported_family/)
  assert.throws(() => parseEncryptedRecordPayload({ record_family: "pending_transaction", record_schema_version: "other_v1", source_id: "x", data: {} }), /SCHEMA_UNSUPPORTED/)
  const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  const authority = new EncryptedFinancialAuthority({ request: async () => { throw Error("unexpected request") } }, key, "vault")
  const pendingId = "rec_pending123456", transactionId = await createDeterministicEncryptedRecordId(`pending-finalization:v1:${pendingId}`)
  const pending = { id: pendingId, family: "pending_transaction", data: { id: pendingId } }
  const capture = { creates: [pending], updates: [], tombstones: [] }
  await assert.rejects(() => authority.preparePendingCapture(capture), /WRITES_DISABLED/)
  authority.setPendingCapabilities({ capture: true, recovery: true })
  await assert.rejects(() => authority.prepareSourceDiff(capture), /WRITES_DISABLED/)
  await assert.rejects(() => authority.preparePendingCapture({ ...capture, creates: [pending, pending] }), /PENDING_BATCH_INVALID/)
  const prepared = await authority.preparePendingCapture(capture)
  authority.setPendingCapabilities({ capture: false, recovery: true })
  await assert.rejects(() => authority.submitPreparedSourceDiff(prepared), /WRITES_DISABLED/)
  authority.store.replace({ envelope: { record_id: pendingId, record_revision: 1 }, family: "pending_transaction", sourceId: pendingId, schemaVersion: "pending_transaction_v1", data: pending.data })
  const final = { creates: [{ id: transactionId, family: "transaction", data: { pending_transaction_id: pendingId } }], updates: [], tombstones: [pending] }
  const recovery = await authority.preparePendingFinalization(final, pendingId, 1)
  authority.setPendingCapabilities({ capture: false, recovery: false })
  await assert.rejects(() => authority.submitPreparedSourceDiff(recovery), /WRITES_DISABLED/)
  console.log("Pending rollout and compatibility checks passed")
})().catch((error) => { console.error(error); process.exitCode = 1 })
