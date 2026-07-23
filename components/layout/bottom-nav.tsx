"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, LineChart, Plus, Receipt, Settings, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrentMonthKey } from "@/lib/date-filters"

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
      <span className={cn("mobile-nav-icon", item.type === "route" && isActive && "mobile-nav-icon-active")}>
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
  const pathname = usePathname()
  const router = useRouter()
  const [hasHydrated, setHasHydrated] = useState(false)
  const [coachmarkDismissed, setCoachmarkDismissed] = useState(false)
  const [transactionsHref, setTransactionsHref] = useState("/transactions")

  useEffect(() => {
    const dismissed = window.localStorage.getItem(coachmarkDismissedStorageKey) === "1"
    setCoachmarkDismissed(dismissed)
    setTransactionsHref(`/transactions?month=${getCurrentMonthKey()}`)
    setHasHydrated(true)
  }, [])

  const shouldShowCoachmark = useMemo(
    () => hasHydrated && showAddCoachmark && !coachmarkDismissed,
    [hasHydrated, showAddCoachmark, coachmarkDismissed]
  )

  const dismissCoachmark = () => {
    setCoachmarkDismissed(true)
    window.localStorage.setItem(coachmarkDismissedStorageKey, "1")
  }

  const handleAddClick = () => {
    if (shouldShowCoachmark) {
      dismissCoachmark()
    }
    if (onAddClick) {
      onAddClick()
      return
    }
    router.push(addHref)
  }

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Primary">
      <div className="mx-auto grid h-full max-w-lg grid-cols-5 items-center gap-0.5 px-1.5 py-1">
        {mobileNavItems.map((item) => {
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
          return <MobileBottomNavItem key={item.href} item={item} href={href} isActive={isActive} />
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
  const [hasHydrated, setHasHydrated] = useState(false)
  const [coachmarkDismissed, setCoachmarkDismissed] = useState(false)

  useEffect(() => {
    const dismissed = window.localStorage.getItem(coachmarkDismissedStorageKey) === "1"
    setCoachmarkDismissed(dismissed)
    setHasHydrated(true)
  }, [])

  const shouldShowCoachmark = useMemo(
    () => hasHydrated && showCoachmark && !coachmarkDismissed,
    [hasHydrated, showCoachmark, coachmarkDismissed]
  )

  const dismissCoachmark = () => {
    setCoachmarkDismissed(true)
    window.localStorage.setItem(coachmarkDismissedStorageKey, "1")
  }

  const handleClick = () => {
    if (shouldShowCoachmark) {
      dismissCoachmark()
    }
    onClick?.()
  }

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
