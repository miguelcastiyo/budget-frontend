export function isLocalMockMode(): boolean {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_USE_MOCKS !== "1") {
    return false
  }

  if (typeof window === "undefined") {
    return false
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
}
