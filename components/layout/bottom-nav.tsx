"use client"

import { useEffect, useState, type ComponentType } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, LineChart, Plus, Receipt, Settings, House, ListFilter, Layers, Ellipsis } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrentMonthKey } from "@/lib/date-filters"
import { useAuth } from "@/components/auth/auth-provider"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { hasTransactionViewState } from "@/lib/transaction-view-state"
import { useInterfacePreference } from "./interface-preference"
import styles from "./v2-navigation.module.css"
import { useV2Add } from "@/components/budget/v2-add-provider"

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
  { type: "route", href: "/transactions", icon: Receipt, label: "Activity" },
  { type: "action", action: "log-transaction", icon: Plus, label: "Add" },
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
}

function MobileBottomNavItem({ item, href, isActive = false, onAction }: MobileBottomNavItemProps) {
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
}

export function BottomNav({
  onAddClick,
  addLabel = "Add",
  addHref = "/transactions?add=1",
}: BottomNavProps) {
  const { version } = useInterfacePreference()
  const { openAdd } = useV2Add()
  const { profile } = useAuth()
  const authority = useFinancialAuthority()
  const reviewEnabled = authority.pendingCaptureEnabled || (authority.isUnlocked && authority.pendingGlobalCount > 0)
  const pathname = usePathname()
  const router = useRouter()
  const [transactionsHref, setTransactionsHref] = useState("/transactions")

  useEffect(() => {
    try {
      setTransactionsHref(hasTransactionViewState(profile?.id ?? "") ? "/transactions?resume=1" : `/transactions?month=${getCurrentMonthKey()}`)
    } catch { setTransactionsHref(`/transactions?month=${getCurrentMonthKey()}`) }
  }, [profile?.id])

  const handleAddClick = () => {
    if (version === "v2") { openAdd(); return }
    if (onAddClick) {
      onAddClick()
      return
    }
    router.push(addHref)
  }

  if (version === "v2") {
    // The prototype uses Home, Activity, Add, Review and More in this order.
    // More currently routes to the production Settings screen until its own pass.
    const items: MobileNavItem[] = [
      { type: "route", href: "/", icon: House, label: "Home" },
      { type: "route", href: "/transactions", icon: ListFilter, label: "Activity" },
      { type: "action", action: "log-transaction", icon: Plus, label: "Add" },
      ...(reviewEnabled ? [{ type: "route" as const, href: "/review", icon: Layers, label: "Review" }] : []),
      { type: "route", href: "/settings", icon: Ellipsis, label: "More" },
    ]
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
      <nav className={cn(styles.nav, styles.mobile)} aria-label="Primary" data-v2-mobile-nav="true"><div className={styles.items}>{renderRoutes(true)}</div></nav>
    </>
  }

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Primary">
      <div className="mx-auto grid h-full max-w-lg grid-cols-5 items-center gap-0.5 px-1.5 py-1">
        {mobileNavItems.map((item) => {
          if (item.type === "action") {
            return (
              <div key={item.action} className="relative flex h-full items-center justify-center">
                <MobileBottomNavItem item={item} onAction={handleAddClick} />
              </div>
            )
          }

          const isActive = isRouteActive(pathname, item.href)
          const href = item.href === "/transactions" ? transactionsHref : item.href
          return <MobileBottomNavItem key={item.href} item={item} href={href} isActive={isActive} />
        })}
      </div>
    </nav>
  )
}

interface FloatingAddButtonProps {
  onClick?: () => void
  label?: string
}

export function FloatingAddButton({
  onClick,
  label = "Add Transaction",
}: FloatingAddButtonProps) {
  const { version } = useInterfacePreference()

  if (version === "v2") return null

  return (
    <div className="fixed bottom-8 right-6 z-50 hidden lg:block">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-14 w-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 lg:w-auto lg:px-5"
      >
        <Plus className="size-7 lg:size-5" aria-hidden="true" />
        <span aria-hidden className="hidden text-sm font-semibold lg:inline">{label}</span>
        <span className="sr-only">{label}</span>
      </button>
    </div>
  )
}
