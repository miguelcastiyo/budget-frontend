"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function formatted(code: string) { return code.replace(/-/g, "").match(/.{1,4}/g)?.join("-") ?? code }

export function RecoveryCodeCeremony({ code, onConfirmed, onCancel }: { code: string; onConfirmed: () => void; onCancel?: () => void }) {
  const [saved, setSaved] = useState(false)
  const [lastFour, setLastFour] = useState("")
  const [copied, setCopied] = useState(false)
  const displayCode = useMemo(() => formatted(code), [code])
  const expected = code.replace(/-/g, "").slice(-4).toUpperCase()
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  return <div className="space-y-4 rounded-lg border border-border/70 bg-secondary/20 p-4" data-testid="recovery-code-ceremony">
    <div><h3 className="font-semibold">Save your Recovery Code</h3><p className="mt-1 text-sm text-muted-foreground">This is a backup way to unlock your Vault if you forget your Vault passphrase. Keep it somewhere safe outside this device.</p></div>
    <p className="select-all break-all rounded-md bg-background px-3 py-3 text-center font-mono text-sm tracking-wide" aria-label="Recovery Code">{displayCode}</p>
    <Button type="button" variant="outline" className="w-full" onClick={() => void copy()}>{copied ? "Copied" : "Copy Recovery Code"}</Button>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={saved} onChange={(event) => setSaved(event.target.checked)} /><span>I've saved my Recovery Code somewhere safe.</span></label>
    <div className="space-y-1"><label htmlFor="recovery-last-four" className="text-sm font-medium">Enter the last 4 characters of your Recovery Code.</label><Input id="recovery-last-four" value={lastFour} onChange={(event) => setLastFour(event.target.value)} autoComplete="off" maxLength={4} /></div>
    <div className="flex gap-2"><Button type="button" className="flex-1" disabled={!saved || lastFour.replace(/-/g, "").toUpperCase() !== expected} onClick={onConfirmed}>Continue</Button>{onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}</div>
  </div>
}
