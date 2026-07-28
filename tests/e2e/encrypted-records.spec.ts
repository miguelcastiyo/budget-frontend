import { expect, test } from "@playwright/test"

test("Phase 3 synthetic envelope binds ciphertext to canonical AAD and revision", async ({ page }) => {
  await page.goto("/")
  const result = await page.evaluate(async () => {
    const canonical = (vaultId: string, recordId: string, revision: number) => new TextEncoder().encode(`phase3-aad-v1|envelope_version=1:1|vault_id=${vaultId.length}:${vaultId}|record_id=${recordId.length}:${recordId}|record_revision=${String(revision).length}:${revision}`)
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
    const vaultId = "vault_phase3_test"
    const recordId = "rec_phase3_test"
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(JSON.stringify({ kind: "phase3-synthetic", marker: "PHASE3_PLAINTEXT_CANARY_CLIENT_ONLY" }))
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: canonical(vaultId, recordId, 1) }, key, plaintext)
    const roundTrip = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: canonical(vaultId, recordId, 1) }, key, ciphertext)
    let aadTransplantRejected = false
    try { await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: canonical(vaultId, "rec_other_record", 1) }, key, ciphertext) } catch { aadTransplantRejected = true }
    let revisionRejected = false
    try { await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: canonical(vaultId, recordId, 2) }, key, ciphertext) } catch { revisionRejected = true }
    let ivRejected = false
    try { const otherIv = new Uint8Array(iv); otherIv[0] ^= 1; await crypto.subtle.decrypt({ name: "AES-GCM", iv: otherIv, additionalData: canonical(vaultId, recordId, 1) }, key, ciphertext) } catch { ivRejected = true }
    return { roundTrip: new TextDecoder().decode(roundTrip), aadTransplantRejected, revisionRejected, ivRejected, ivLength: iv.length }
  })
  expect(result.roundTrip).toContain("phase3-synthetic")
  expect(result.aadTransplantRejected).toBe(true)
  expect(result.revisionRejected).toBe(true)
  expect(result.ivRejected).toBe(true)
  expect(result.ivLength).toBe(12)
})
