import Link from "next/link"
import { ArrowUpRight, Folder } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function FundsCta({ compact = false }: { compact?: boolean }) {
  if (compact) return (
    <Link href="/insights/funds" className="flex min-h-24 min-w-0 flex-col justify-between rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Open Funds">
      <span className="flex items-center justify-between gap-2"><Folder className="size-4 text-muted-foreground" aria-hidden="true" /><ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" /></span>
      <span className="text-sm font-semibold text-foreground">Funds</span>
    </Link>
  )
  return (
    <Card className="border-0 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Folder className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Funds</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">View savings goals.</p>
        </div>
        <Button size="sm" variant="outline" className="rounded-full" asChild>
          <Link href="/insights/funds">Open</Link>
        </Button>
      </div>
    </Card>
  )
}
