"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { TransactionEditorForm } from "./transaction-editor-form"
import { useAuth } from "@/components/auth/auth-provider"
import { clearRememberedCapture, getRememberedCapture } from "@/components/review/capture-recovery"

type AddContext = { openAdd: (mode?: "full") => void }
const Context = createContext<AddContext>({ openAdd: () => {} })
export function useV2Add() { return useContext(Context) }

export function V2AddProvider({ children }: { children: ReactNode }) {
  const authority = useFinancialAuthority()
  const { profile } = useAuth()
  const accountId = profile?.id ?? ""
  const [session, setSession] = useState<{ capture: boolean } | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState("")
  useEffect(() => { if (!authority.authority) setSession(null) }, [authority.authority])
  const openAdd = useCallback((mode?: "full") => {
    if (!authority.authority || authority.isLoading) return
    if (getRememberedCapture(accountId)) { setRecoveryMessage("A previous capture has an uncertain outcome. Sync Review before adding another transaction."); return }
    setSession(current => current ?? { capture: mode !== "full" && authority.pendingCaptureEnabled })
  }, [accountId, authority.authority, authority.isLoading, authority.pendingCaptureEnabled])
  const checkCapture = async () => {
    const id = getRememberedCapture(accountId)
    if (!id || !authority.authority) return
    try {
      await authority.syncFinancialState()
      if (authority.authority.getState().pendingTransactions.some(item => item.id === id)) {
        clearRememberedCapture(accountId, id)
        setRecoveryMessage("The capture was found in Review.")
      } else setRecoveryMessage("The outcome is still uncertain. Sync again before creating another transaction.")
    } catch { setRecoveryMessage("Unable to sync Review. The capture outcome remains uncertain.") }
  }
  return <Context.Provider value={{ openAdd }}>
    {children}
    {recoveryMessage && <div role="alert" className="fixed bottom-24 right-4 z-[70] max-w-sm rounded-xl border bg-background p-4 shadow-lg"><p>{recoveryMessage}</p><button type="button" className="mt-2 underline" onClick={() => void checkCapture()}>Sync Review</button>{!getRememberedCapture(accountId) && <button type="button" className="ml-4 underline" onClick={() => setRecoveryMessage("")}>Dismiss</button>}</div>}
    {session && <TransactionEditorForm open onOpenChange={(open) => { if (!open) setSession(null) }} v2Create initialCapture={session.capture} onTransactionCreated={() => window.dispatchEvent(new Event("budget:v2-transaction-created"))} />}
  </Context.Provider>
}
