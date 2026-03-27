"use client"

import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: string
  subtitle: string
  compact?: boolean
  className?: string
  children: ReactNode
  icon?: ReactNode
}

export function SectionCard({
  title,
  subtitle,
  compact = false,
  className,
  children,
  icon,
}: SectionCardProps) {
  return (
    <Card className={cn("border-0 shadow-sm", compact ? "p-3" : "p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className={cn("font-semibold", compact ? "text-sm" : "text-base")}>{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {icon}
      </div>
      <div className={compact ? "mt-3" : "mt-4"}>{children}</div>
    </Card>
  )
}
