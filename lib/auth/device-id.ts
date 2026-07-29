const DEVICE_ID_KEY = "budget.device_id"

export function getBudgetDeviceId(): string {
  if (typeof window === "undefined") return ""
  const existing = window.localStorage.getItem(DEVICE_ID_KEY)
  if (existing && /^dev_[A-Za-z0-9_-]{10,64}$/.test(existing)) return existing
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const value = `dev_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`
  window.localStorage.setItem(DEVICE_ID_KEY, value)
  return value
}

export function clearBudgetDeviceId() {
  if (typeof window !== "undefined") window.localStorage.removeItem(DEVICE_ID_KEY)
}
