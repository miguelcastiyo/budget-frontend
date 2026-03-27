"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Receipt, LineChart, Settings, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/transactions", icon: Receipt, label: "Transactions" },
  { href: "/insights", icon: LineChart, label: "Insights" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border safe-area-pb lg:hidden">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors",
                isActive 
                  ? "text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
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

const coachmarkDismissedStorageKey = "budget-add-transaction-coachmark-dismissed"

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
    <div className="fixed bottom-24 lg:bottom-8 right-6 z-50">
      {shouldShowCoachmark && (
        <div className="relative mb-2 w-56 rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={dismissCoachmark}
            className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/70 hover:text-foreground"
            aria-label="Dismiss add transaction tip"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="pr-6 text-xs font-medium text-foreground">{coachmarkText}</p>
          <div className="absolute bottom-[-6px] right-7 h-3 w-3 rotate-45 border-b border-r border-border/60 bg-background/95" />
        </div>
      )}
      <button
        onClick={handleClick}
        className="h-14 w-14 lg:w-auto rounded-full bg-primary lg:px-5 text-primary-foreground shadow-lg inline-flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="w-7 h-7 lg:w-5 lg:h-5" />
        <span aria-hidden className="hidden lg:inline text-sm font-semibold">{label}</span>
        <span className="sr-only">{label}</span>
      </button>
    </div>
  )
}
