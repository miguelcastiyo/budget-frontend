"use client"
import { useEffect, useState } from "react"

const CLIENT_VERSION = 1
export function ClientUpdateNotice() {
  const [required, setRequired] = useState(false)
  useEffect(() => {
    let active = true
    async function check() {
      try {
        const response = await fetch("/api/client-readiness", { cache: "no-store", credentials: "same-origin" })
        if (!response.ok) return
        const data: unknown = await response.json()
        if (!active || !data || typeof data !== "object") return
        const version = (data as { minVersion?: unknown }).minVersion
        if (typeof version === "number" && Number.isSafeInteger(version) && version > CLIENT_VERSION) setRequired(true)
      } catch { /* Keep working offline; never discard unsaved work. */ }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void check() }
    void check(); document.addEventListener("visibilitychange", onVisible)
    return () => { active = false; document.removeEventListener("visibilitychange", onVisible) }
  }, [])
  if (!required) return null
  return <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">An update is required. Save your work, then reload Budget. If installed on your iPhone, close and reopen it; if needed, open Budget in Safari and add it to the Home Screen again. <button type="button" className="underline" onClick={() => window.location.reload()}>Reload</button></div>
}
