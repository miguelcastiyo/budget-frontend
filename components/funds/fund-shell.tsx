"use client"

import type { ReactNode } from "react"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"

export function FundShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background pb-mobile-nav"><Header /><main className="mx-auto max-w-lg px-5 pt-standalone-safe-top lg:max-w-6xl lg:px-8">{children}</main><BottomNav /></div>
}
