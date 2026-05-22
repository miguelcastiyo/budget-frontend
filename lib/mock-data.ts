import type {
  Profile,
  BudgetSettings,
  Transaction,
  Tag,
  Card,
  TagMetricsResponse,
  CategoryMetricsResponse,
} from "./api/types"

// Mock profile
export const mockProfile: Profile = {
  id: "usr_1",
  email: "alex@example.com",
  display_name: "Alex",
  avatar_url: null,
  auth_provider: "password",
  role: "owner",
  email_verified: true,
  created_at: "2024-01-15T10:00:00Z",
  onboarding_complete: true,
  user_preferences: {
    appearance: {
      theme: "system",
    },
  },
}

// Mock tags
export const mockTags: Tag[] = [
  { id: "tag_1", name: "Groceries", icon_key: null },
  { id: "tag_2", name: "Dining Out", icon_key: null },
  { id: "tag_3", name: "Transportation", icon_key: null },
  { id: "tag_4", name: "Entertainment", icon_key: null },
  { id: "tag_5", name: "Utilities", icon_key: null },
  { id: "tag_6", name: "Shopping", icon_key: null },
  { id: "tag_7", name: "Healthcare", icon_key: null },
  { id: "tag_8", name: "Subscriptions", icon_key: null },
  { id: "tag_9", name: "Rent", icon_key: null },
  { id: "tag_10", name: "Savings", icon_key: null },
]

// Mock cards
export const mockCards: Card[] = [
  { id: "card_1", name: "Chase Sapphire" },
  { id: "card_2", name: "Apple Card" },
  { id: "card_3", name: "Amex Gold" },
  { id: "card_4", name: "Debit" },
]

// Mock budget settings
export const mockBudgetSettings: BudgetSettings = {
  monthly_income: "6500.00",
  allocation_mode: "percent",
  needs_percent: "50.00",
  wants_percent: "30.00",
  savings_debts_percent: "20.00",
  needs_amount: "3250.00",
  wants_amount: "1950.00",
  savings_debts_amount: "1300.00",
}

// Generate mock transactions for current month
function generateMockTransactions(): Transaction[] {
  const now = new Date()
  const transactions: Transaction[] = []
  
  const expenses = [
    { expense: "Whole Foods", amount: "127.45", category: "needs" as const, tag: mockTags[0], card: mockCards[1] },
    { expense: "Uber Eats", amount: "34.99", category: "wants" as const, tag: mockTags[1], card: mockCards[1] },
    { expense: "Gas Station", amount: "52.00", category: "needs" as const, tag: mockTags[2], card: mockCards[3] },
    { expense: "Netflix", amount: "15.99", category: "wants" as const, tag: mockTags[7], card: mockCards[1] },
    { expense: "Con Edison", amount: "145.00", category: "needs" as const, tag: mockTags[4], card: mockCards[3] },
    { expense: "Target", amount: "89.50", category: "wants" as const, tag: mockTags[5], card: mockCards[0] },
    { expense: "CVS Pharmacy", amount: "23.45", category: "needs" as const, tag: mockTags[6], card: mockCards[2] },
    { expense: "Spotify", amount: "9.99", category: "wants" as const, tag: mockTags[7], card: mockCards[1] },
    { expense: "Rent Payment", amount: "2100.00", category: "needs" as const, tag: mockTags[8], card: null },
    { expense: "High Yield Savings", amount: "500.00", category: "savings_debts" as const, tag: mockTags[9], card: null },
    { expense: "Trader Joes", amount: "78.34", category: "needs" as const, tag: mockTags[0], card: mockCards[2] },
    { expense: "Movie Theater", amount: "24.00", category: "wants" as const, tag: mockTags[3], card: mockCards[1] },
    { expense: "Chipotle", amount: "15.85", category: "wants" as const, tag: mockTags[1], card: mockCards[1] },
    { expense: "Internet Bill", amount: "79.99", category: "needs" as const, tag: mockTags[4], card: mockCards[3] },
    { expense: "Amazon", amount: "156.23", category: "wants" as const, tag: mockTags[5], card: mockCards[0] },
    { expense: "Gym Membership", amount: "45.00", category: "needs" as const, tag: mockTags[6], card: mockCards[1] },
    { expense: "Student Loan", amount: "350.00", category: "savings_debts" as const, tag: mockTags[9], card: null },
    { expense: "Coffee Shop", amount: "6.50", category: "wants" as const, tag: mockTags[1], card: mockCards[1] },
    { expense: "Dry Cleaning", amount: "28.00", category: "needs" as const, tag: mockTags[5], card: mockCards[2] },
    { expense: "Concert Tickets", amount: "120.00", category: "wants" as const, tag: mockTags[3], card: mockCards[0] },
  ]

  expenses.forEach((exp, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - index))
    transactions.push({
      id: `txn_${index + 1}`,
      date: date.toISOString().split("T")[0],
      expense: exp.expense,
      amount: exp.amount,
      category: exp.category,
      is_split: index % 5 === 0,
      source: "manual",
      recurring_expense_id: null,
      tag: exp.tag,
      card: exp.card,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
    })
  })

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export const mockTransactions = generateMockTransactions()

// Mock tag metrics
export function getMockTagMetrics(month: string): TagMetricsResponse {
  const totalSpend = mockTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)
  
  const tagSpends = mockTransactions.reduce((acc, t) => {
    const tagId = t.tag.id
    acc[tagId] = (acc[tagId] || 0) + parseFloat(t.amount)
    return acc
  }, {} as Record<string, number>)

  const tags = Object.entries(tagSpends)
    .map(([tagId, spend]) => ({
      tag_id: tagId,
      tag_name: mockTags.find(t => t.id === tagId)?.name || "Unknown",
      icon_key: mockTags.find(t => t.id === tagId)?.icon_key || null,
      spend: spend.toFixed(2),
      percent_of_monthly_spend: ((spend / totalSpend) * 100).toFixed(2),
    }))
    .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend))

  return {
    month,
    total_spend: totalSpend.toFixed(2),
    tags,
  }
}

// Mock category metrics
export function getMockCategoryMetrics(month: string): CategoryMetricsResponse {
  const categorySpends = mockTransactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount)
    return acc
  }, {} as Record<string, number>)

  const categories = [
    {
      category: "needs" as const,
      budget_amount: mockBudgetSettings.needs_amount || "3250.00",
      actual_spend: (categorySpends["needs"] || 0).toFixed(2),
      percent_used: (((categorySpends["needs"] || 0) / parseFloat(mockBudgetSettings.needs_amount || "3250")) * 100).toFixed(2),
    },
    {
      category: "wants" as const,
      budget_amount: mockBudgetSettings.wants_amount || "1950.00",
      actual_spend: (categorySpends["wants"] || 0).toFixed(2),
      percent_used: (((categorySpends["wants"] || 0) / parseFloat(mockBudgetSettings.wants_amount || "1950")) * 100).toFixed(2),
    },
    {
      category: "savings_debts" as const,
      budget_amount: mockBudgetSettings.savings_debts_amount || "1300.00",
      actual_spend: (categorySpends["savings_debts"] || 0).toFixed(2),
      percent_used: (((categorySpends["savings_debts"] || 0) / parseFloat(mockBudgetSettings.savings_debts_amount || "1300")) * 100).toFixed(2),
    },
  ]

  return {
    month,
    monthly_income: mockBudgetSettings.monthly_income,
    categories,
  }
}

// Helper to format currency
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num)
}

// Helper to format category name
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

// Helper to get category color class
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
