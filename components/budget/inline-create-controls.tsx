"use client"

import { CreditCard, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagIconPicker } from "@/components/settings/tag-icon-picker"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"

interface InlineCreateTagControlProps {
  name: string
  iconKey: string
  onNameChange: (value: string) => void
  onIconKeyChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
  isSubmitting: boolean
  subtitle: string
  compact?: boolean
}

interface InlineCreateCardControlProps {
  name: string
  onNameChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
  isSubmitting: boolean
  subtitle: string
  surfaceClassName?: string
  compact?: boolean
}

export function InlineCreateTagControl({
  name,
  iconKey,
  onNameChange,
  onIconKeyChange,
  onCancel,
  onSubmit,
  isSubmitting,
  subtitle,
  compact = false,
}: InlineCreateTagControlProps) {
  const TagInputIcon = getTagIcon(name || "Tag", iconKey || null)
  const inputHeightClassName = compact ? "h-11 sm:h-10" : "h-12"
  const buttonHeightClassName = compact ? "h-11 sm:h-10" : "h-12"

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card p-3">
      <InlineCreateHeader title="Create tag" subtitle={subtitle} onCancel={onCancel} cancelLabel="Cancel new tag" />
      <div className="grid min-w-0 gap-3">
        <div className="relative min-w-0">
          <TagInputIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tag name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className={cn("rounded-xl border-border/60 pl-10", inputHeightClassName)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                onSubmit()
              }
            }}
          />
        </div>
        <TagIconPicker
          tagName={name}
          value={iconKey}
          onChange={onIconKeyChange}
          label={<Label className="text-xs font-medium text-muted-foreground">Icon</Label>}
          fadeClassName="from-card via-card/80 to-transparent"
          wrapOnDesktop={false}
        />
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!name.trim() || isSubmitting}
          className={cn("w-full rounded-xl px-4", buttonHeightClassName)}
        >
          {isSubmitting ? "Adding..." : "Add tag"}
        </Button>
      </div>
    </div>
  )
}

export function InlineCreateCardControl({
  name,
  onNameChange,
  onCancel,
  onSubmit,
  isSubmitting,
  subtitle,
  surfaceClassName = "bg-card",
  compact = false,
}: InlineCreateCardControlProps) {
  const inputHeightClassName = compact ? "h-11 sm:h-10" : "h-12"
  const buttonHeightClassName = compact ? "h-11 sm:h-10" : "h-12"

  return (
    <div className={cn("rounded-xl border border-border/60 p-3", surfaceClassName)}>
      <InlineCreateHeader title="Create card" subtitle={subtitle} onCancel={onCancel} cancelLabel="Cancel new card" />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Card name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className={cn("rounded-xl border-border/60 pl-10", inputHeightClassName)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                onSubmit()
              }
            }}
          />
        </div>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!name.trim() || isSubmitting}
          className={cn("rounded-xl px-4", buttonHeightClassName)}
        >
          {isSubmitting ? "Adding..." : "Add card"}
        </Button>
      </div>
    </div>
  )
}

function InlineCreateHeader({
  title,
  subtitle,
  onCancel,
  cancelLabel,
}: {
  title: string
  subtitle: string
  onCancel: () => void
  cancelLabel: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        className="h-9 w-9 shrink-0 rounded-lg p-0"
        aria-label={cancelLabel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
