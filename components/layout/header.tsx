"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Receipt, LineChart, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrentMonthKey } from "@/lib/date-filters"

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/transactions", icon: Receipt, label: "Transactions" },
  { href: "/insights", icon: LineChart, label: "Insights" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

export function Header() {
  const pathname = usePathname()
  const [transactionsHref, setTransactionsHref] = useState("/transactions")

  useEffect(() => {
    setTransactionsHref(`/transactions?month=${getCurrentMonthKey()}`)
  }, [])

  return (
    <header className="sticky top-0 z-40 hidden lg:block bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex-1">
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/" && pathname.startsWith(item.href))
              const href = item.href === "/transactions" ? transactionsHref : item.href
              
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-secondary text-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
