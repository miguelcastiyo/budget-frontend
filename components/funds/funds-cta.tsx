import Link from "next/link"
import { Folder } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function FundsCta() {
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
