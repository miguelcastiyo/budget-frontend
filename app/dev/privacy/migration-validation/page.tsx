import { notFound } from "next/navigation"
import { MigrationValidationClient } from "./migration-validation-client"

export default function MigrationValidationPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ENABLE_VAULT_VALIDATION !== "1") notFound()
  return <MigrationValidationClient />
}
