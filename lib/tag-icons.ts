import type { LucideIcon } from "lucide-react"
import {
  Bookmark,
  BookOpen,
  Building2,
  Briefcase,
  Box,
  CalendarDays,
  Car,
  Coffee,
  Cookie,
  CreditCard,
  Dumbbell,
  Droplet,
  Film,
  Gamepad2,
  Gift,
  Flag,
  Heart,
  Home,
  Lightbulb,
  Luggage,
  Landmark,
  MapPinned,
  Mountain,
  Globe2,
  PiggyBank,
  Plane,
  Receipt,
  Route,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Ticket,
  PartyPopper,
  TrendingUp,
  Utensils,
  Umbrella,
  Users,
  Star,
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

export const CONTEXT_ICON_OPTIONS = [
  { key: "map_pinned", label: "Place", icon: MapPinned },
  { key: "plane", label: "Travel", icon: Plane },
  { key: "calendar_days", label: "Calendar", icon: CalendarDays },
  { key: "party_popper", label: "Event", icon: PartyPopper },
  { key: "gift", label: "Gift", icon: Gift },
  { key: "heart", label: "Romance", icon: Heart },
  { key: "luggage", label: "Suitcase", icon: Luggage },
  { key: "home", label: "Home", icon: Home },
  { key: "car", label: "Car", icon: Car },
  { key: "building", label: "Building", icon: Building2 },
  { key: "landmark", label: "Landmark", icon: Landmark },
  { key: "mountain", label: "Mountain", icon: Mountain },
  { key: "beach", label: "Beach", icon: Umbrella },
  { key: "globe", label: "World", icon: Globe2 },
  { key: "route", label: "Route", icon: Route },
  { key: "briefcase", label: "Work", icon: Briefcase },
  { key: "users", label: "People", icon: Users },
  { key: "star", label: "Favorite", icon: Star },
  { key: "flag", label: "Milestone", icon: Flag },
  { key: "ticket", label: "Ticket", icon: Ticket },
  { key: "bookmark", label: "Bookmark", icon: Bookmark },
  { key: "tag", label: "Generic", icon: Tag },
  { key: "box", label: "Project", icon: Box },
  { key: "coffee", label: "Coffee", icon: Coffee },
  { key: "utensils", label: "Dining", icon: Utensils },
  { key: "book_open", label: "Books", icon: BookOpen },
  { key: "shopping_bag", label: "Shopping", icon: ShoppingBag },
  { key: "shirt", label: "Clothing", icon: Shirt },
  { key: "sparkles", label: "Self care", icon: Sparkles },
  { key: "droplet", label: "Water", icon: Droplet },
  { key: "scissors", label: "Hair care", icon: Scissors },
  { key: "film", label: "Movies", icon: Film },
  { key: "cookie", label: "Snacks", icon: Cookie },
] as const

export type ContextIconKey = (typeof CONTEXT_ICON_OPTIONS)[number]["key"]

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

const contextIconByKey: Record<ContextIconKey, LucideIcon> = CONTEXT_ICON_OPTIONS.reduce(
  (acc, option) => {
    acc[option.key] = option.icon
    return acc
  },
  {} as Record<ContextIconKey, LucideIcon>
)

const CONTEXT_ICON_RULES: Array<{ keywords: string[]; iconKey: ContextIconKey }> = [
  { keywords: ["japan", "mexico", "chicago", "travel", "trip", "vacation", "flight", "airbnb", "hotel"], iconKey: "plane" },
  { keywords: ["christmas", "gift", "holiday", "present"], iconKey: "gift" },
  { keywords: ["date night", "anniversary", "romantic", "valentine"], iconKey: "heart" },
  { keywords: ["birthday", "event", "party", "celebration"], iconKey: "party_popper" },
  { keywords: ["apartment", "home", "move", "moving", "renovation"], iconKey: "home" },
  { keywords: ["conference", "work", "business", "project"], iconKey: "briefcase" },
  { keywords: ["mountain", "camp", "outdoor", "hike"], iconKey: "mountain" },
  { keywords: ["beach", "coast", "ocean", "island"], iconKey: "beach" },
  { keywords: ["route", "road", "itinerary", "journey"], iconKey: "route" },
  { keywords: ["world", "international", "country", "global"], iconKey: "globe" },
  { keywords: ["city", "landmark", "museum", "building"], iconKey: "landmark" },
  { keywords: ["people", "family", "friends", "group"], iconKey: "users" },
]

export function getContextIconByKey(iconKey?: string | null): LucideIcon | null {
  if (!iconKey) return null
  return contextIconByKey[iconKey as ContextIconKey] ?? null
}

export function getContextIcon(contextName: string, iconKey?: string | null): LucideIcon {
  const explicitIcon = getContextIconByKey(iconKey)
  if (explicitIcon) return explicitIcon

  const normalized = contextName.toLowerCase().trim()
  for (const rule of CONTEXT_ICON_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return contextIconByKey[rule.iconKey]
    }
  }

  return contextIconByKey.map_pinned
}
