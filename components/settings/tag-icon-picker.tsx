"use client"

import type { ReactNode } from "react"
import { FormChipRail, type FormChipRailItem } from "@/components/budget/form-chip-rail"
import { getTagIcon, TAG_ICON_OPTIONS } from "@/lib/tag-icons"
import type { LucideIcon } from "lucide-react"

type IconOption = { key: string; label: string; icon: LucideIcon }

interface TagIconPickerProps {
  tagName: string
  value: string
  onChange: (value: string) => void
  label?: ReactNode
  fadeClassName?: string
  wrapOnDesktop?: boolean
  entityLabel?: string
  iconOptions?: readonly IconOption[]
  iconResolver?: (name: string, iconKey?: string | null) => LucideIcon
  desktopGridColumns?: 4 | 5 | 6 | 7 | 8
}

export function TagIconPicker({
  tagName,
  value,
  onChange,
  label = <p className="text-xs font-medium text-muted-foreground">Icon</p>,
  fadeClassName = "from-background via-background/80 to-transparent sm:hidden",
  wrapOnDesktop = true,
  entityLabel = "Tag",
  iconOptions = TAG_ICON_OPTIONS,
  iconResolver = getTagIcon,
  desktopGridColumns,
}: TagIconPickerProps) {
  const selectedIconOption = iconOptions.find((option) => option.key === value)
  const AutoIcon = iconResolver(tagName || entityLabel, null)
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
    ...iconOptions.map((option) => {
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
  const gridClassName = desktopGridColumns
    ? ({
        4: "sm:grid sm:grid-cols-4",
        5: "sm:grid sm:grid-cols-5",
        6: "sm:grid sm:grid-cols-6",
        7: "sm:grid sm:grid-cols-7",
        8: "sm:grid sm:grid-cols-8",
      } as const)[desktopGridColumns]
    : undefined

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
        ariaLabel={`Choose a ${entityLabel.toLowerCase()} icon`}
        fadeClassName={fadeClassName}
        chipClassName="h-10 font-medium sm:w-full"
        trackClassName={gridClassName}
        wrapOnDesktop={wrapOnDesktop}
      />
    </div>
  )
}
