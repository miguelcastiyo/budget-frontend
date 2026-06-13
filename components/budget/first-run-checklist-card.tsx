"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { CheckCircle2, ChevronRight, Download, Repeat, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { SetupStatus, SetupTask } from "@/lib/api/types"

interface FirstMonthActionCardProps {
  month: string
  isDismissing: boolean
  onAddTransaction: () => void
  onDismiss: () => void
}

interface FirstMonthProgressCardProps {
  setupStatus: SetupStatus
  isDismissing: boolean
  onDismiss: () => void
  onTaskSelect: (taskKey: SetupTask["key"]) => void
}

export function FirstMonthActionCard({
  month,
  isDismissing,
  onAddTransaction,
  onDismiss,
}: FirstMonthActionCardProps) {
  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border/70 bg-card/95 p-0 shadow-sm">
      <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(120,141,96,0.14),rgba(201,175,124,0.08))] px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">First month</p>
            <h2 className="text-2xl font-semibold tracking-tight">Your {month} budget is ready</h2>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">Start with one small action.</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onDismiss}
            disabled={isDismissing}
            aria-label="Dismiss first-month action card"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-6">
        <PrimaryActionButton label="Add first transaction" sublabel="Start tracking spending now." onClick={onAddTransaction} />
        <PrimaryActionLink label="Add fixed bills" sublabel="Set up recurring monthly expenses." href="/settings/recurring" icon={<Repeat className="size-4" />} />
        <PrimaryActionLink label="Import CSV" sublabel="Bring in past transactions." href="/settings/data" icon={<Download className="size-4" />} />
      </div>
    </Card>
  )
}

export function FirstMonthProgressCard({
  setupStatus,
  isDismissing,
  onDismiss,
  onTaskSelect,
}: FirstMonthProgressCardProps) {
  const tasks: Array<SetupTask & { statusLabel: "Not started" | "Optional" | "Done" }> = setupStatus.setup_tasks.map((task) => ({
    ...task,
    statusLabel: task.completed ? "Done" : task.key === "import_transactions" ? "Optional" : "Not started",
  }))

  return (
    <Card className="rounded-[1.5rem] border-border/70 bg-card/95 p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Setup progress</p>
          <h3 className="text-lg font-semibold tracking-tight">What you&apos;ve completed</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onDismiss}
          disabled={isDismissing}
          aria-label="Dismiss setup progress"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {tasks.map((task) => (
          <TaskRow key={task.key} task={task} onSelect={() => onTaskSelect(task.key)} />
        ))}
      </div>
    </Card>
  )
}

function PrimaryActionButton({
  label,
  sublabel,
  onClick,
}: {
  label: string
  sublabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border/70 bg-background/85 p-4 text-left transition-colors hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{sublabel}</p>
        </div>
        <ChevronRight className="mt-0.5 size-4 text-muted-foreground" />
      </div>
    </button>
  )
}

function PrimaryActionLink({
  label,
  sublabel,
  href,
  icon,
}: {
  label: string
  sublabel: string
  href: string
  icon: ReactNode
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border/70 bg-background/85 p-4 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{sublabel}</p>
        </div>
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
      </div>
    </Link>
  )
}

function TaskRow({
  task,
  onSelect,
}: {
  task: SetupTask & { statusLabel: "Not started" | "Optional" | "Done" }
  onSelect: () => void
}) {
  const isComplete = task.completed

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
        isComplete
          ? "bg-success/8 hover:bg-success/12"
          : "bg-background/80 hover:bg-accent/40"
      }`}
    >
      <CheckCircle2 className={`mt-0.5 size-4 ${isComplete ? "text-success" : "text-muted-foreground"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{task.label}</p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isComplete
                ? "bg-success/12 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {task.statusLabel}
          </span>
          {isComplete && <span className="text-xs text-success">Completed</span>}
        </div>
      </div>
      <ChevronRight className="mt-0.5 size-4 text-muted-foreground" />
    </button>
  )
}
