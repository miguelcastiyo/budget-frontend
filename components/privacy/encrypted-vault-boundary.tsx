"use client"

import { LockKeyhole } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useFinancialAuthority } from "./financial-authority-provider"

function isVaultManagementPath(pathname: string) {
  return pathname === "/settings" || pathname === "/settings/vault" || pathname.startsWith("/settings/vault/") || pathname === "/dev/privacy/migration-validation"
}

export function EncryptedVaultBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const authority = useFinancialAuthority()
  const [returnTo, setReturnTo] = useState(pathname)
  useEffect(() => { setReturnTo(`${pathname}${window.location.search}`) }, [pathname])

  if (authority.isLoading || authority.mode === "legacy" || authority.mode === "migration" || authority.authority || isVaultManagementPath(pathname)) {
    return <>{children}</>
  }

  return <div className="min-h-screen bg-background pb-mobile-nav">
    <main className="mx-auto max-w-lg px-5 pb-8 pt-6">
      <Card className="w-full space-y-4 p-6 text-center shadow-sm" data-testid="encrypted-vault-locked-boundary">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"><LockKeyhole className="size-6" aria-hidden="true" /></div>
        <div><h1 className="text-lg font-semibold">Vault setup required</h1><p className="mt-2 text-sm text-muted-foreground">Protect your financial data with a Vault passphrase before you start budgeting.</p></div>
        <Button asChild><Link href={`/settings/vault?returnTo=${encodeURIComponent(returnTo)}`}>Set up your Vault</Link></Button>
      </Card>
    </main>
    <BottomNav />
  </div>
}
