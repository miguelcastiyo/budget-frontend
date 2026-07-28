import { notFound } from "next/navigation"
import { VaultValidationClient } from "./vault-validation-client"

export default function VaultValidationPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_VAULT_VALIDATION !== "1") notFound()
  return <VaultValidationClient />
}
