"use client"

import { useRef } from "react"
import { AlertCircle, CheckCircle2, FileUp, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { CsvImportErrorItem } from "@/lib/api/types"

interface TransactionImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  importFile: File | null
  importStatus: "idle" | "uploading" | "success" | "warning" | "error"
  importMessage: string
  importErrors: CsvImportErrorItem[]
  onFileSelect: (file: File | null) => void
  onReset: () => void
  onImport: () => void
}

export function TransactionImportDialog({
  open,
  onOpenChange,
  importFile,
  importStatus,
  importMessage,
  importErrors,
  onFileSelect,
  onReset,
  onImport,
}: TransactionImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
          onReset()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import transactions. The file should have columns for date, expense, amount, category, and tag.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              importFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
              className="hidden"
            />

            {importFile ? (
              <div className="space-y-2">
                <FileUp className="w-10 h-10 mx-auto text-primary" />
                <p className="font-medium">{importFile.name}</p>
                <p className="text-sm text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    onReset()
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ""
                    }
                  }}
                >
                  Choose different file
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="font-medium">Click to upload</p>
                <p className="text-sm text-muted-foreground">CSV files only</p>
              </div>
            )}
          </div>

          {importMessage && (
            <div
              className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
                importStatus === "error"
                  ? "bg-destructive/10 text-destructive"
                  : importStatus === "warning"
                    ? "bg-amber-500/10 text-amber-700"
                    : importStatus === "success"
                      ? "bg-green-500/10 text-green-600"
                      : "bg-muted"
              }`}
            >
              {importStatus === "error" && <AlertCircle className="w-4 h-4" />}
              {importStatus === "warning" && <AlertCircle className="w-4 h-4" />}
              {importStatus === "success" && <CheckCircle2 className="w-4 h-4" />}
              {importMessage}
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
              {importErrors.map((errorItem, index) => (
                <p key={`${errorItem.row}-${errorItem.field}-${index}`} className="text-xs text-destructive">
                  Row {errorItem.row} ({errorItem.field}): {errorItem.message}
                </p>
              ))}
              {importErrors.length >= 8 && (
                <p className="text-[11px] text-muted-foreground pt-1">Showing first 8 errors.</p>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!importFile || importStatus === "uploading" || importStatus === "success"}
            onClick={onImport}
          >
            {importStatus === "uploading" ? "Importing..." : "Import Transactions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
