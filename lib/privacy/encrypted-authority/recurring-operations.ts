import { cancelEncryptedRecurringExpenseChange, createEncryptedRecurringExpense, deleteEncryptedRecurringExpense, scheduleEncryptedRecurringExpenseChange, updateEncryptedRecurringExpense } from "./recurring-commands"
import { requireEncryptedAuthority, type EncryptedOperationDependencies } from "./authority-adapters"

export function createRecurringOperations(deps: EncryptedOperationDependencies) {
  return {
    create: (input: Record<string, unknown>) => createEncryptedRecurringExpense(requireEncryptedAuthority(deps), input),
    update: (id: string, input: Record<string, unknown>) => updateEncryptedRecurringExpense(requireEncryptedAuthority(deps), id, input),
    delete: (id: string) => deleteEncryptedRecurringExpense(requireEncryptedAuthority(deps), id),
    schedule: (id: string, input: Record<string, unknown>) => scheduleEncryptedRecurringExpenseChange(requireEncryptedAuthority(deps), id, input),
    cancel: (currentId: string, scheduledId: string) => cancelEncryptedRecurringExpenseChange(requireEncryptedAuthority(deps), currentId, scheduledId),
  }
}
