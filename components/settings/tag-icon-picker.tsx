"use client"

import type { ReactNode } from "react"
import { FormChipRail, type FormChipRailItem } from "@/components/budget/form-chip-rail"
import { getTagIcon, TAG_ICON_OPTIONS } from "@/lib/tag-icons"

interface TagIconPickerProps {
  tagName: string
  value: string
  onChange: (value: string) => void
  label?: ReactNode
  fadeClassName?: string
  wrapOnDesktop?: boolean
}

export function TagIconPicker({
  tagName,
  value,
  onChange,
  label = <p className="text-xs font-medium text-muted-foreground">Icon</p>,
  fadeClassName = "from-background via-background/80 to-transparent sm:hidden",
  wrapOnDesktop = true,
}: TagIconPickerProps) {
  const selectedIconOption = TAG_ICON_OPTIONS.find((option) => option.key === value)
  const AutoIcon = getTagIcon(tagName || "Tag", null)
  const PreviewIcon = selectedIconOption?.icon ?? AutoIcon
  const iconLabel = selectedIconOption?.label ?? "Auto"
  const iconItems: FormChipRailItem[] = [
    {
      value: "",
      label: "Auto",
      icon: <AutoIcon className="h-4 w-4 shrink-0" />,
      ariaLabel: "Use automatic icon",
      title: "Auto icon",
    },
    ...TAG_ICON_OPTIONS.map((option) => {
      const Icon = option.icon
      return {
        value: option.key,
        label: option.label,
        icon: <Icon className="h-4 w-4" />,
        ariaLabel: `Use ${option.label} icon`,
        title: option.label,
        hideLabel: true,
      } satisfies FormChipRailItem
    }),
  ]

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        {label}
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <PreviewIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{iconLabel}</span>
        </span>
      </div>
      <FormChipRail
        items={iconItems}
        value={value}
        onValueChange={onChange}
        ariaLabel="Choose a tag icon"
        fadeClassName={fadeClassName}
        chipClassName="h-10 font-medium"
        wrapOnDesktop={wrapOnDesktop}
      />
    </div>
  )
}
