"use client"

import { usePathname } from "next/navigation"
import { useFinancialAuthority } from "./financial-authority-provider"
import { VaultLockedView } from "./vault-locked-view"

function isVaultManagementPath(pathname: string) {
  return pathname === "/settings" || pathname === "/settings/vault" || pathname.startsWith("/settings/vault/")
}

export function EncryptedVaultBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const authority = useFinancialAuthority()
  if (authority.isLoading || authority.mode === "legacy" || authority.mode === "migration" || authority.authority || isVaultManagementPath(pathname)) {
    return <>{children}</>
  }

  return <VaultLockedView />
}
