"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
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

  useEffect(() => {
    try {
      if (available && window.localStorage.getItem(storageKey) === "v2") setCurrentVersion("v2")
    } catch {
      setCurrentVersion("classic")
    }
    setReady(true)
  }, [])

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
