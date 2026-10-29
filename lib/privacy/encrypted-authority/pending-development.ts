/** Enabled only by the development server with an explicitly local API. */
export function pendingDevelopmentEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_PENDING_DEVELOPMENT === "1" && typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
}
