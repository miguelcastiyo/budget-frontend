// Only opaque pending-record identifiers are retained across a Vault lock.
const pending = new Map<string, string>()
const key = (account: string) => `budget.review-recovery.${encodeURIComponent(account)}`
export function rememberReview(account: string, id: string) { pending.set(account, id); try { window.sessionStorage.setItem(key(account), id) } catch { /* In-memory fallback. */ } }
export function getRememberedReview(account: string) { const id = pending.get(account); if (id) return id; try { return window.sessionStorage.getItem(key(account)) } catch { return null } }
export function clearRememberedReview(account: string, id: string) { if (getRememberedReview(account) !== id) return; pending.delete(account); try { window.sessionStorage.removeItem(key(account)) } catch { /* In-memory fallback. */ } }
