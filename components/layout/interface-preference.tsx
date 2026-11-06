"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react"
import styles from "./v2-navigation.module.css"

type InterfaceVersion = "classic" | "v2"
const storageKey = "budget.interface-version"
const available = process.env.NEXT_PUBLIC_BUDGET_V2_ENABLED === "true"

const InterfaceContext = createContext<{
  version: InterfaceVersion
  available: boolean
  ready: boolean
  setVersion: (version: InterfaceVersion) => void
}>({ version: "classic", available: false, ready: false, setVersion: () => {} })

export function InterfacePreferenceProvider({ children }: { children: ReactNode }) {
  const [version, setCurrentVersion] = useState<InterfaceVersion>("classic")
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    try {
      if (available && window.localStorage.getItem(storageKey) === "v2") setCurrentVersion("v2")
    } catch {
      setCurrentVersion("classic")
    }
    setReady(true)
  }, [])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("v2-theme", version === "v2")
  }, [version])

  useEffect(() => () => document.documentElement.classList.remove("v2-theme"), [])

  useEffect(() => {
    if (version !== "v2") {
      document.documentElement.style.removeProperty("--v2-viewport-height")
      document.documentElement.style.removeProperty("--v2-viewport-middle")
      document.documentElement.style.removeProperty("--v2-viewport-bottom-inset")
      return
    }
    const viewport = window.visualViewport
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight
      const top = viewport?.offsetTop ?? 0
      const bottomInset = Math.max(0, window.innerHeight - height - top)
      document.documentElement.style.setProperty("--v2-viewport-height", `${height}px`)
      document.documentElement.style.setProperty("--v2-viewport-middle", `${top + height / 2}px`)
      document.documentElement.style.setProperty("--v2-viewport-bottom-inset", `${bottomInset}px`)
    }
    syncViewport()
    viewport?.addEventListener("resize", syncViewport)
    viewport?.addEventListener("scroll", syncViewport)
    window.addEventListener("resize", syncViewport)
    return () => {
      viewport?.removeEventListener("resize", syncViewport)
      viewport?.removeEventListener("scroll", syncViewport)
      window.removeEventListener("resize", syncViewport)
      document.documentElement.style.removeProperty("--v2-viewport-height")
      document.documentElement.style.removeProperty("--v2-viewport-middle")
      document.documentElement.style.removeProperty("--v2-viewport-bottom-inset")
    }
  }, [version])

  const setVersion = useCallback((next: InterfaceVersion) => {
    if (next === "v2" && !available) return
    try {
      window.localStorage.setItem(storageKey, next)
      setCurrentVersion(next)
    } catch {
      setCurrentVersion("classic")
    }
  }, [])

  return <InterfaceContext.Provider value={{ version, available, ready, setVersion }}>
    <div className={version === "v2" ? styles.page : undefined}>{children}</div>
  </InterfaceContext.Provider>
}

export function useInterfacePreference() {
  return useContext(InterfaceContext)
}
