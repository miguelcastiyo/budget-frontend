import type { Category } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { CATEGORY_CONFIG } from "./transaction-editor-types"

export function TransactionCategoryPicker({ value, onChange }: { value: Category; onChange: (value: Category) => void }) {
  return (
    <div className="grid min-w-0 max-w-full grid-cols-3 gap-2">
      {(["needs", "wants", "savings"] as const).map((category) => {
        const config = CATEGORY_CONFIG[category]
        const selected = value === category
        return (
          <button key={category} type="button" onClick={() => onChange(category)} className={cn("relative h-11 cursor-pointer rounded-xl text-sm font-medium transition-all duration-200 sm:h-12", selected ? `border-primary ${config.selectedClassName} text-foreground shadow-sm` : "bg-muted/60 text-foreground hover:bg-muted")}>
            {config.label}
          </button>
        )
      })}
    </div>
  )
}
