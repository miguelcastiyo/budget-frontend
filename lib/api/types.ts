// API Types matching openapi.yaml contract

export type Category = "needs" | "wants" | "savings_debts"

export type AuthProvider = "password" | "google"

export type AllocationMode = "percent" | "amount"

export type Preset = "last_7_days" | "last_30_days" | "month_to_date" | "last_month" | "quarter_to_date"

export type SortOrder = "date_desc" | "date_asc"
export type SplitFilter = "all" | "split" | "not_split"

// Profile
export interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  auth_provider: AuthProvider
  email_verified: boolean
  created_at: string
  onboarding_complete: boolean
}

export interface UpdateProfileRequest {
  display_name: string
}

// Auth
export interface AuthUser {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  auth_provider: AuthProvider
  onboarding_complete: boolean
}

export interface SessionInfo {
  session_id: string
  expires_at: string
  csrf_token: string
  session_token?: string
}

export interface AuthSessionResponse {
  user: AuthUser
  session: SessionInfo
}

export interface PasswordSignInRequest {
  email: string
  password: string
  client_type: "web" | "native"
}

export interface GoogleSignInRequest {
  google_id_token: string
  invite_token?: string
  client_type: "web" | "native"
}

// Tags
export interface Tag {
  id: string
  name: string
  icon_key: string | null
}

export interface CreateNamedEntityRequest {
  name: string
  icon_key?: string | null
}

// Cards
export interface Card {
  id: string
  name: string
}

// Recurring expenses
export type RecurringBillingType = "day_of_month" | "last_day"

export interface RecurringExpense {
  id: string
  expense: string
  amount: string
  category: Category
  tag: Tag
  card: Card | null
  billing_type: RecurringBillingType
  billing_day: number | null
  projected_date_for_month: string
  starts_month: string
  ends_month: string | null
  is_active: boolean
  generated_for_month: boolean
  created_at: string
  updated_at: string
}

export interface RecurringExpensesResponse {
  month: string
  committed_total: string
  items_count: number
  items: RecurringExpense[]
}

export interface CreateRecurringExpenseRequest {
  expense: string
  amount: string
  category: Category
  tag_id: string
  card_id?: string | null
  seed_transaction_id?: string | null
  billing_type: RecurringBillingType
  billing_day?: number | null
  starts_month?: string
  ends_month?: string | null
  is_active?: boolean
}

export interface UpdateRecurringExpenseRequest {
  expense?: string
  amount?: string
  category?: Category
  tag_id?: string
  card_id?: string | null
  billing_type?: RecurringBillingType
  billing_day?: number | null
  starts_month?: string
  ends_month?: string | null
  is_active?: boolean
}

// Budget Settings
export interface BudgetSettings {
  monthly_income: string
  allocation_mode: AllocationMode
  needs_percent?: string
  wants_percent?: string
  savings_debts_percent?: string
  needs_amount?: string
  wants_amount?: string
  savings_debts_amount?: string
}

export interface BudgetSettingsPercentInput {
  monthly_income: string
  allocation_mode: "percent"
  needs_percent: string
  wants_percent: string
  savings_debts_percent: string
}

export interface BudgetSettingsAmountInput {
  monthly_income: string
  allocation_mode: "amount"
  needs_amount: string
  wants_amount: string
  savings_debts_amount: string
}

// Transactions
export interface Transaction {
  id: string
  date: string
  expense: string
  amount: string
  category: Category
  is_split: boolean
  tag: Tag
  card: Card | null
  created_at: string
  updated_at: string
}

export interface CreateTransactionRequest {
  date: string
  expense: string
  amount: string
  category: Category
  is_split?: boolean
  tag_id?: string
  tag?: { name: string }
  card_id?: string
  card?: { name: string }
}

export interface UpdateTransactionRequest {
  date?: string
  expense?: string
  amount?: string
  category?: Category
  is_split?: boolean
  tag_id?: string
  tag?: { name: string }
  card_id?: string
  card?: { name: string }
}

export interface TransactionsPage {
  items: Transaction[]
  page: number
  page_size: number
  total_items: number
}

export interface TransactionFilters {
  date_from?: string
  date_to?: string
  preset?: Preset
  q?: string
  categories?: string
  tag_ids?: string
  card_ids?: string
  is_split?: Exclude<SplitFilter, "all">
  page?: number
  page_size?: number
  sort?: SortOrder
}

// Metrics
export interface TagMetricsItem {
  tag_id: string
  tag_name: string
  icon_key: string | null
  spend: string
  percent_of_monthly_spend: string
}

export interface TagMetricsResponse {
  month: string
  total_spend: string
  tags: TagMetricsItem[]
}

export interface CategoryMetricsItem {
  category: Category
  budget_amount: string
  actual_spend: string
  percent_used: string
}

export interface CategoryMetricsResponse {
  month: string
  monthly_income: string
  categories: CategoryMetricsItem[]
}

export interface InsightsMonthlySpendPoint {
  month: string
  total_spend: string
}

export interface InsightsCategoryBreakdownItem {
  category: Category
  spend: string
  percent_of_total_spend: string
}

export interface InsightsCategoryBudgetVsActualItem {
  category: Category
  budget_amount: string
  actual_spend: string
  percent_used: string
}

export interface InsightsTagBreakdownItem {
  tag_id: string
  tag_name: string
  icon_key: string | null
  spend: string
  percent_of_total_spend: string
}

export interface InsightsDayOfWeekSpendItem {
  day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
  avg_spend: string
  total_spend: string
  transactions_count: number
}

export interface InsightsLargestTransactionItem {
  transaction_id: string
  date: string
  expense: string
  amount: string
  category: Category
  is_split: boolean
  tag: Tag
  card_name: string | null
}

export interface InsightsRecurringVsVariable {
  recurring: string
  variable: string
  recurring_percent: string
  variable_percent: string
}

export interface InsightsMetricsResponse {
  date_from: string
  date_to: string
  months_in_range: number
  total_spend: string
  total_transactions: number
  monthly_spend_trend: InsightsMonthlySpendPoint[]
  category_breakdown: InsightsCategoryBreakdownItem[]
  category_budget_vs_actual: InsightsCategoryBudgetVsActualItem[]
  tag_breakdown: InsightsTagBreakdownItem[]
  day_of_week_spend: InsightsDayOfWeekSpendItem[]
  largest_transactions: InsightsLargestTransactionItem[]
  recurring_vs_variable: InsightsRecurringVsVariable
}

// API Keys
export interface MasterApiKeyMetadata {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

export interface CreateMasterApiKeyRequest {
  name: string
  expires_at?: string | null
}

export interface CreateMasterApiKeyResponse extends MasterApiKeyMetadata {
  api_key: string
}

// Import/Export
export interface CsvImportErrorItem {
  row: number
  field: string
  message: string
}

export interface CsvImportResponse {
  status: "completed" | "failed"
  mode: "dry_run" | "commit"
  total_rows: number
  valid_rows: number
  imported_rows: number
  duplicate_rows: number
  invalid_rows: number
  errors: CsvImportErrorItem[]
}

// Errors
export interface ErrorDetail {
  field: string
  message: string
}

export interface ApiError {
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "RATE_LIMITED" | "INTERNAL_ERROR"
  message: string
  details?: ErrorDetail[]
}

export interface ErrorEnvelope {
  error: ApiError
}

// Invitations
export interface CreateInviteRequest {
  email: string
  auth_method: "google_or_password"
  expires_in_days: number
}

export interface InviteResponse {
  invite_id: string
  email: string
  status: "pending"
  expires_at: string
}

export interface AcceptInvitePasswordRequest {
  invite_token: string
  display_name: string
  password: string
  client_type: "web" | "native"
}

export interface AcceptInviteGoogleRequest {
  invite_token: string
  google_id_token: string
  display_name: string
  client_type: "web" | "native"
}

// Email Change
export interface RequestEmailChangeRequest {
  new_email: string
}

export interface EmailChangeRequestedResponse {
  email_change_id: string
  status: "verification_pending"
}

export interface VerifyEmailChangeRequest {
  email_change_id: string
  verification_code: string
}

export interface EmailChangeVerifiedResponse {
  email: string
  email_verified: boolean
}
