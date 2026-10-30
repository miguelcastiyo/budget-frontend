"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, LineChart, Plus, Receipt, Settings, X, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrentMonthKey } from "@/lib/date-filters"
import { useAuth } from "@/components/auth/auth-provider"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { hasTransactionViewState } from "@/lib/transaction-view-state"
import { useInterfacePreference } from "./interface-preference"
import styles from "./v2-navigation.module.css"
import { useV2Add } from "@/components/budget/v2-add-provider"

const coachmarkDismissedStorageKey = "budget-add-transaction-coachmark-dismissed"

type MobileNavRouteItem = {
  type: "route"
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

type MobileNavActionItem = {
  type: "action"
  label: string
  action: "log-transaction"
  icon: ComponentType<{ className?: string }>
}

type MobileNavItem = MobileNavRouteItem | MobileNavActionItem

const mobileNavItems: MobileNavItem[] = [
  { type: "route", href: "/", icon: LayoutDashboard, label: "Overview" },
  { type: "route", href: "/transactions", icon: Receipt, label: "Transactions" },
  { type: "action", action: "log-transaction", icon: Plus, label: "Log" },
  { type: "route", href: "/insights", icon: LineChart, label: "Insights" },
  { type: "route", href: "/settings", icon: Settings, label: "Settings" },
]

function isRouteActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href))
}

interface MobileBottomNavItemProps {
  item: MobileNavItem
  href?: string
  isActive?: boolean
  onAction?: () => void
  badge?: number
}

function MobileBottomNavItem({ item, href, isActive = false, onAction, badge }: MobileBottomNavItemProps) {
  const Icon = item.icon
  const className = cn(
    "mobile-nav-item",
    item.type === "action" && "mobile-nav-item-primary",
    item.type === "route" && item.href === "/transactions" && "mobile-nav-item-transactions",
    item.type === "route" && isActive && "mobile-nav-item-active"
  )
  const content = (
    <>
      <span className={cn("mobile-nav-icon relative", item.type === "route" && isActive && "mobile-nav-icon-active")}>
        <Icon className="size-5" aria-hidden="true" />
        {badge != null && badge > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground" aria-label={`${badge} pending`}>{badge}</span>}
      </span>
      <span className="mobile-nav-label">{item.label}</span>
    </>
  )

  if (item.type === "route") {
    return (
      <Link href={href ?? item.href} className={className} aria-current={isActive ? "page" : undefined}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onAction} className={className} aria-label="Log transaction">
      {content}
    </button>
  )
}

interface BottomNavProps {
  onAddClick?: () => void
  addLabel?: string
  addHref?: string
  showAddCoachmark?: boolean
  addCoachmarkText?: string
}

export function BottomNav({
  onAddClick,
  addLabel = "Add",
  addHref = "/transactions?add=1",
  showAddCoachmark = false,
  addCoachmarkText = "Start here. Add your first transaction.",
}: BottomNavProps) {
  const { version } = useInterfacePreference()
  const { openAdd } = useV2Add()
  const { profile } = useAuth()
  const authority = useFinancialAuthority()
  const reviewEnabled = authority.pendingCaptureEnabled || (authority.isUnlocked && authority.pendingGlobalCount > 0)
  const pathname = usePathname()
  const router = useRouter()
  const [hasHydrated, setHasHydrated] = useState(false)
  const [coachmarkDismissed, setCoachmarkDismissed] = useState(false)
  const [transactionsHref, setTransactionsHref] = useState("/transactions")

  useEffect(() => {
    let dismissed = false
    try { dismissed = window.localStorage.getItem(coachmarkDismissedStorageKey) === "1" } catch { /* Storage is optional. */ }
    setCoachmarkDismissed(dismissed)
    try {
      setTransactionsHref(hasTransactionViewState(profile?.id ?? "") ? "/transactions?resume=1" : `/transactions?month=${getCurrentMonthKey()}`)
    } catch { setTransactionsHref(`/transactions?month=${getCurrentMonthKey()}`) }
    setHasHydrated(true)
  }, [profile?.id])

  const shouldShowCoachmark = useMemo(
    () => hasHydrated && showAddCoachmark && !coachmarkDismissed,
    [hasHydrated, showAddCoachmark, coachmarkDismissed]
  )

  const dismissCoachmark = () => {
    setCoachmarkDismissed(true)
    try { window.localStorage.setItem(coachmarkDismissedStorageKey, "1") } catch { /* Storage is optional. */ }
  }

  const handleAddClick = () => {
    if (shouldShowCoachmark) {
      dismissCoachmark()
    }
    if (version === "v2") { openAdd(); return }
    if (onAddClick) {
      onAddClick()
      return
    }
    router.push(addHref)
  }

  if (version === "v2") {
    const items: MobileNavItem[] = reviewEnabled
      ? [...mobileNavItems.slice(0, 2), { type: "route", href: "/review", icon: ListChecks, label: "Review" }, ...mobileNavItems.slice(2)]
      : mobileNavItems
    const renderRoutes = (includeAction: boolean) => items.map((item) => {
      if (item.type === "action") return includeAction ? <button key={item.action} type="button" className={styles.item} onClick={handleAddClick} aria-label="Log transaction"><span className={styles.action}><Plus className={styles.icon} aria-hidden="true" /></span></button> : null
      const Icon = item.icon
      const active = isRouteActive(pathname, item.href)
      const badge = item.href === "/review" && authority.isUnlocked && !authority.isLoading ? authority.pendingGlobalCount : 0
      return <Link key={item.href} href={item.href === "/transactions" ? transactionsHref : item.href} className={styles.item} aria-current={active ? "page" : undefined}>
        <Icon className={styles.icon} aria-hidden="true" />{item.label}
        {badge > 0 && <span className={styles.badge} aria-label={`${badge} pending`}>{badge}</span>}
      </Link>
    })
    return <>
      <aside className={cn(styles.nav, styles.sidebar)} aria-label="Desktop navigation">
        <span className={styles.brand}>Budget</span>
        <button type="button" className={styles.action} onClick={handleAddClick}><Plus className={styles.icon} aria-hidden="true" />{addLabel}</button>
        <nav aria-label="Primary desktop" className={styles.items}>{renderRoutes(false)}</nav>
      </aside>
      <nav className={cn(styles.nav, styles.mobile)} aria-label="Primary"><div className={styles.items}>{renderRoutes(true)}</div></nav>
    </>
  }

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Primary">
      <div className={cn("mx-auto grid h-full max-w-lg items-center gap-0.5 px-1.5 py-1", reviewEnabled ? "grid-cols-6" : "grid-cols-5")}>
        {(reviewEnabled ? [...mobileNavItems.slice(0, 2), { type: "route" as const, href: "/review", icon: ListChecks, label: "Review" }, ...mobileNavItems.slice(2)] : mobileNavItems).map((item) => {
          if (item.type === "action") {
            return (
              <div key={item.action} className="relative flex h-full items-center justify-center">
                {shouldShowCoachmark && (
                  <div className="absolute bottom-[calc(100%+0.75rem)] left-1/2 z-10 w-56 -translate-x-1/2 rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur">
                    <button
                      type="button"
                      onClick={dismissCoachmark}
                      className="absolute right-1.5 top-1.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      aria-label="Dismiss add transaction tip"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                    <p className="pr-6 text-xs font-medium text-foreground">{addCoachmarkText}</p>
                    <div className="absolute bottom-[-6px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-border/60 bg-background/95" />
                  </div>
                )}
                <MobileBottomNavItem item={item} onAction={handleAddClick} />
              </div>
            )
          }

          const isActive = isRouteActive(pathname, item.href)
          const href = item.href === "/transactions" ? transactionsHref : item.href
          return <MobileBottomNavItem key={item.href} item={item} href={href} isActive={isActive} badge={item.href === "/review" && authority.isUnlocked && !authority.isLoading ? authority.pendingGlobalCount : undefined} />
        })}
      </div>
    </nav>
  )
}

interface FloatingAddButtonProps {
  onClick?: () => void
  label?: string
  showCoachmark?: boolean
  coachmarkText?: string
}

export function FloatingAddButton({
  onClick,
  label = "Add Transaction",
  showCoachmark = false,
  coachmarkText = "Start here. Add your first transaction.",
}: FloatingAddButtonProps) {
  const { version } = useInterfacePreference()
  const [hasHydrated, setHasHydrated] = useState(false)
  const [coachmarkDismissed, setCoachmarkDismissed] = useState(false)

  useEffect(() => {
    let dismissed = false
    try { dismissed = window.localStorage.getItem(coachmarkDismissedStorageKey) === "1" } catch { /* Storage is optional. */ }
    setCoachmarkDismissed(dismissed)
    setHasHydrated(true)
  }, [])

  const shouldShowCoachmark = useMemo(
    () => hasHydrated && showCoachmark && !coachmarkDismissed,
    [hasHydrated, showCoachmark, coachmarkDismissed]
  )

  const dismissCoachmark = () => {
    setCoachmarkDismissed(true)
    try { window.localStorage.setItem(coachmarkDismissedStorageKey, "1") } catch { /* Storage is optional. */ }
  }

  const handleClick = () => {
    if (shouldShowCoachmark) {
      dismissCoachmark()
    }
    onClick?.()
  }

  if (version === "v2") return null

  return (
    <div className="fixed bottom-8 right-6 z-50 hidden lg:block">
      {shouldShowCoachmark && (
        <div className="relative mb-2 w-56 rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={dismissCoachmark}
            className="absolute right-1.5 top-1.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent/70 hover:text-foreground"
            aria-label="Dismiss add transaction tip"
          >
            <X className="size-3.5" />
          </button>
          <p className="pr-6 text-xs font-medium text-foreground">{coachmarkText}</p>
          <div className="absolute bottom-[-6px] right-7 size-3 rotate-45 border-b border-r border-border/60 bg-background/95" />
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex h-14 w-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 lg:w-auto lg:px-5"
      >
        <Plus className="size-7 lg:size-5" aria-hidden="true" />
        <span aria-hidden className="hidden text-sm font-semibold lg:inline">{label}</span>
        <span className="sr-only">{label}</span>
      </button>
    </div>
  )
}
