import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  Heart,
  Home,
  Lightbulb,
  PiggyBank,
  Plane,
  Receipt,
  Shield,
  ShoppingCart,
  Smartphone,
  Tag,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react"

export const TAG_ICON_OPTIONS = [
  { key: "home", label: "Home", icon: Home },
  { key: "shopping_cart", label: "Shopping", icon: ShoppingCart },
  { key: "car", label: "Transportation", icon: Car },
  { key: "plane", label: "Travel", icon: Plane },
  { key: "receipt", label: "Bills & Food", icon: Receipt },
  { key: "coffee", label: "Coffee", icon: Coffee },
  { key: "smartphone", label: "Subscriptions", icon: Smartphone },
  { key: "credit_card", label: "Debt/Credit", icon: CreditCard },
  { key: "piggy_bank", label: "Savings", icon: PiggyBank },
  { key: "trending_up", label: "Investments", icon: TrendingUp },
  { key: "briefcase", label: "Income/Work", icon: Briefcase },
  { key: "heart", label: "Health", icon: Heart },
  { key: "dumbbell", label: "Fitness", icon: Dumbbell },
  { key: "book_open", label: "Education", icon: BookOpen },
  { key: "film", label: "Entertainment", icon: Film },
  { key: "gamepad", label: "Fun/Gaming", icon: Gamepad2 },
  { key: "gift", label: "Gifts", icon: Gift },
  { key: "shield", label: "Insurance", icon: Shield },
  { key: "lightbulb", label: "Personal", icon: Lightbulb },
  { key: "wrench", label: "Maintenance", icon: Wrench },
  { key: "wallet", label: "Cash", icon: Wallet },
  { key: "tag", label: "Generic Tag", icon: Tag },
] as const

export type TagIconKey = (typeof TAG_ICON_OPTIONS)[number]["key"]
export type ContextIconKey = TagIconKey
export const CONTEXT_ICON_OPTIONS = TAG_ICON_OPTIONS

const iconByKey: Record<TagIconKey, LucideIcon> = TAG_ICON_OPTIONS.reduce(
  (acc, option) => {
    acc[option.key] = option.icon
    return acc
  },
  {} as Record<TagIconKey, LucideIcon>
)

const TAG_ICON_RULES: Array<{ keywords: string[]; iconKey: TagIconKey }> = [
  { keywords: ["housing", "rent", "mortgage", "home", "utilities"], iconKey: "home" },
  { keywords: ["groceries", "grocery", "shopping", "target", "costco"], iconKey: "shopping_cart" },
  { keywords: ["transportation", "gas", "uber", "lyft", "car", "auto"], iconKey: "car" },
  { keywords: ["travel", "trip", "flight", "airbnb", "hotel"], iconKey: "plane" },
  { keywords: ["eating out", "restaurant", "dining", "food"], iconKey: "receipt" },
  { keywords: ["coffee", "cafe"], iconKey: "coffee" },
  { keywords: ["subscriptions", "subscription", "netflix", "spotify", "icloud"], iconKey: "smartphone" },
  { keywords: ["debt", "loan", "credit"], iconKey: "credit_card" },
  { keywords: ["savings", "emergency fund"], iconKey: "piggy_bank" },
  { keywords: ["investments", "invest", "roth", "ira", "brokerage"], iconKey: "trending_up" },
  { keywords: ["salary", "income", "paycheck", "work"], iconKey: "briefcase" },
  { keywords: ["health", "medical", "doctor", "pharmacy"], iconKey: "heart" },
  { keywords: ["gym", "fitness", "workout"], iconKey: "dumbbell" },
  { keywords: ["education", "book", "kindle", "course", "school"], iconKey: "book_open" },
  { keywords: ["entertainment", "movies", "theater", "amc"], iconKey: "film" },
  { keywords: ["fun", "gaming", "game"], iconKey: "gamepad" },
  { keywords: ["gift", "birthday"], iconKey: "gift" },
  { keywords: ["insurance"], iconKey: "shield" },
  { keywords: ["personal", "self care", "beauty"], iconKey: "lightbulb" },
  { keywords: ["maintenance", "repair", "tools"], iconKey: "wrench" },
  { keywords: ["cash", "money", "wallet"], iconKey: "wallet" },
]

export function getTagIconByKey(iconKey?: string | null): LucideIcon | null {
  if (!iconKey) {
    return null
  }

  return iconByKey[iconKey as TagIconKey] ?? null
}

export function getTagIcon(tagName: string, iconKey?: string | null): LucideIcon {
  const explicitIcon = getTagIconByKey(iconKey)
  if (explicitIcon) {
    return explicitIcon
  }

  const normalized = tagName.toLowerCase().trim()

  for (const rule of TAG_ICON_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return iconByKey[rule.iconKey]
    }
  }

  return iconByKey.tag
}

export const getContextIconByKey = getTagIconByKey
export const getContextIcon = getTagIcon
