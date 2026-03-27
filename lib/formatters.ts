export function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num)
}

export function formatCategory(category: string): string {
  switch (category) {
    case "needs":
      return "Needs"
    case "wants":
      return "Wants"
    case "savings_debts":
      return "Savings & Debts"
    default:
      return category
  }
}

export function getCategoryColorClass(category: string): string {
  switch (category) {
    case "needs":
      return "bg-needs"
    case "wants":
      return "bg-wants"
    case "savings_debts":
      return "bg-savings"
    default:
      return "bg-muted"
  }
}

export function getCategoryTextClass(category: string): string {
  switch (category) {
    case "needs":
      return "text-needs"
    case "wants":
      return "text-wants"
    case "savings_debts":
      return "text-savings"
    default:
      return "text-muted-foreground"
  }
}
