import { expect, test } from "@playwright/test"
import { validateNewPassphrase } from "../../lib/privacy/vault-crypto"
import { assertionOptionsForBrowser, extractPrfResult, registrationOptionsForBrowser } from "../../lib/privacy/quick-unlock"

test("new Vault passphrases reject trivial weak patterns while allowing strong choices", () => {
  expect(validateNewPassphrase("123456123456")).toContain("unique")
  expect(validateNewPassphrase("passwordpassword")).toContain("unique")
  expect(validateNewPassphrase("A secure phrase 2026")).toBeNull()
})

test("Quick Unlock converts PRF extension inputs to browser byte arrays", () => {
  const first = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  const registration = registrationOptionsForBrowser({ challenge: first, user: { id: first }, extensions: { prf: { eval: { first } } } })
  const assertion = assertionOptionsForBrowser({ challenge: first, allowCredentials: [], extensions: { prf: { evalByCredential: { credential: { first } } } } })
  expect((registration.extensions as any)?.prf?.eval?.first).toBeInstanceOf(Uint8Array)
  expect((assertion.extensions as any)?.prf?.evalByCredential?.credential?.first).toBeInstanceOf(Uint8Array)
})

test("Quick Unlock accepts Safari-compatible PRF byte views", () => {
  const credential = { getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: new Uint8Array(32) } } }) } as unknown as Credential
  expect(extractPrfResult(credential)?.byteLength).toBe(32)
})

test("browser Web Crypto supports the Phase 2 synthetic Vault round trip and negative paths", async ({ page }) => {
  await page.goto("/")
  const result = await page.evaluate(async () => {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const recovery = crypto.getRandomValues(new Uint8Array(32))
    const vault = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode("phase2-test-passphrase"), "PBKDF2", false, ["deriveKey"])
    const kek = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" }, material, { name: "AES-KW", length: 256 }, false, ["wrapKey", "unwrapKey"])
    const recoveryKey = await crypto.subtle.importKey("raw", recovery, { name: "AES-KW", length: 256 }, false, ["wrapKey", "unwrapKey"])
    const wrapped = await crypto.subtle.wrapKey("raw", vault, kek, "AES-KW")
    const recoveryWrapped = await crypto.subtle.wrapKey("raw", vault, recoveryKey, "AES-KW")
    const runtime = await crypto.subtle.unwrapKey("raw", wrapped, kek, "AES-KW", { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(JSON.stringify({ marker: "phase2-synthetic", amount: "not-financial" }))
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, runtime, plaintext)
    const decoded = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, runtime, ciphertext)
    let wrongPassphraseRejected = false
    try {
      const wrongMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode("wrong-passphrase"), "PBKDF2", false, ["deriveKey"])
      const wrongKek = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" }, wrongMaterial, { name: "AES-KW", length: 256 }, false, ["wrapKey", "unwrapKey"])
      await crypto.subtle.unwrapKey("raw", wrapped, wrongKek, "AES-KW", { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
    } catch { wrongPassphraseRejected = true }
    let tamperRejected = false
    try { const tampered = new Uint8Array(ciphertext); tampered[0] ^= 1; await crypto.subtle.decrypt({ name: "AES-GCM", iv }, runtime, tampered) } catch { tamperRejected = true }
    let exportRejected = false
    try { await crypto.subtle.exportKey("raw", runtime) } catch { exportRejected = true }
    return { wrappedLength: wrapped.byteLength, recoveryWrappedLength: recoveryWrapped.byteLength, decoded: new TextDecoder().decode(decoded), wrongPassphraseRejected, tamperRejected, exportRejected, ivLength: iv.byteLength }
  })
  expect(result.wrappedLength).toBe(40)
  expect(result.recoveryWrappedLength).toBe(40)
  expect(result.ivLength).toBe(12)
  expect(result.decoded).toContain("phase2-synthetic")
  expect(result.wrongPassphraseRejected).toBe(true)
  expect(result.tamperRejected).toBe(true)
  expect(result.exportRejected).toBe(true)
})

test("Quick Unlock derives a non-exportable PRF wrapper key and proves local Vault-key recovery", async ({ page }) => {
  await page.goto("/")
  const result = await page.evaluate(async () => {
    const vault = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
    const prf = crypto.getRandomValues(new Uint8Array(32)).buffer
    const derived = await crypto.subtle.importKey("raw", prf, { name: "AES-KW", length: 256 }, false, ["wrapKey", "unwrapKey"])
    const wrapped = await crypto.subtle.wrapKey("raw", vault, derived, "AES-KW")
    await crypto.subtle.unwrapKey("raw", wrapped, derived, "AES-KW", { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
    let exportRejected = false
    try { await crypto.subtle.exportKey("raw", derived) } catch { exportRejected = true }
    return { exportRejected }
  })
  expect(result.exportRejected).toBe(true)
})
