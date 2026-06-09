"use client"

import { forwardRef, useImperativeHandle, useRef, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const DEFAULT_MAX_AMOUNT_DIGITS = 9

function formatAmountDigits(digits: string): string {
  if (digits.length === 0) {
    return ""
  }

  const paddedDigits = digits.padStart(4, "0")

  return `${paddedDigits.slice(0, -2)}.${paddedDigits.slice(-2)}`
}

function amountDigitsFromDecimal(value: string, maxDigits: number): string {
  const normalized = value.trim().replace(/,/g, ".")
  if (normalized === "") {
    return ""
  }

  const [whole = "", fraction = ""] = normalized.split(".")
  const digits = `${whole.replace(/\D/g, "")}${fraction.replace(/\D/g, "").padEnd(2, "0").slice(0, 2)}`

  return digits.replace(/^0+/, "").slice(0, maxDigits)
}

interface AmountInputProps {
  id: string
  name: string
  value: string
  onValueChange: (value: string) => void
  label?: string
  maxDigits?: number
  required?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
  onBlur?: () => void
  onEnter?: () => void
  className?: string
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  {
    id,
    name,
    value,
    onValueChange,
    label = "Amount",
    maxDigits = DEFAULT_MAX_AMOUNT_DIGITS,
    required,
    ariaInvalid,
    ariaDescribedBy,
    onBlur,
    onEnter,
    className,
  },
  forwardedRef
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const amountDigits = amountDigitsFromDecimal(value, maxDigits)
  const displayAmount = value || "00.00"
  const amountLength = displayAmount.length
  const amountInputStyle = {
    width: `${Math.min(Math.max(amountLength + 0.25, 5), 10.5)}ch`,
  }
  const amountTextClassName = amountLength > 7
    ? "text-4xl sm:text-5xl md:text-5xl"
    : "text-5xl sm:text-6xl md:text-6xl"

  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

  const inputIsFullySelected = (): boolean => {
    const input = inputRef.current
    if (!input || value.length === 0) {
      return false
    }

    return input.selectionStart === 0 && input.selectionEnd === value.length
  }

  const setAmountFromDigits = (digits: string) => {
    const normalizedDigits = digits.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxDigits)

    onValueChange(formatAmountDigits(normalizedDigits))
  }

  const appendAmountDigits = (digits: string) => {
    if (!digits) {
      return
    }

    setAmountFromDigits(`${amountDigits}${digits}`)
  }

  const handleBeforeInput = (event: FormEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent
    const inputType = nativeEvent.inputType
    const data = nativeEvent.data ?? ""

    if (inputType === "insertText") {
      event.preventDefault()
      if (/^\d+$/.test(data)) {
        appendAmountDigits(data)
      }
      return
    }

    if (inputType === "deleteContentBackward") {
      event.preventDefault()
      setAmountFromDigits(inputIsFullySelected() ? "" : amountDigits.slice(0, -1))
      return
    }

    if (inputType === "deleteContentForward") {
      event.preventDefault()
      if (inputIsFullySelected()) {
        setAmountFromDigits("")
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      onEnter?.()
      return
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault()
      appendAmountDigits(event.key)
      return
    }

    if (event.key === "Backspace") {
      event.preventDefault()
      setAmountFromDigits(inputIsFullySelected() ? "" : amountDigits.slice(0, -1))
      return
    }

    if (event.key === "Delete") {
      if (inputIsFullySelected()) {
        event.preventDefault()
        setAmountFromDigits("")
      }
      return
    }

    if (["Tab", "Enter", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    event.preventDefault()
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()

    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "")
    if (!pastedDigits) {
      return
    }

    setAmountFromDigits(inputIsFullySelected() ? pastedDigits : `${amountDigits}${pastedDigits}`)
  }

  return (
    <div className={cn("rounded-2xl border border-border/60 bg-muted/20 px-4 py-5 sm:px-5", className)}>
      <label htmlFor={id} className="block text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-3 flex justify-center">
        <div className="inline-flex items-baseline gap-2">
          <span className={cn("font-semibold leading-none text-muted-foreground", amountTextClassName)}>
            $
          </span>
          <Input
            ref={inputRef}
            id={id}
            name={name}
            type="text"
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            placeholder="00.00"
            value={value}
            style={amountInputStyle}
            onBeforeInput={handleBeforeInput}
            onChange={(event) => setAmountFromDigits(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={onBlur}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "h-auto min-w-0 max-w-[68vw] border-0 bg-transparent p-0 text-left font-semibold leading-none tracking-normal shadow-none placeholder:text-muted-foreground/30 focus-visible:ring-0 dark:bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              amountTextClassName
            )}
            required={required}
          />
        </div>
      </div>
    </div>
  )
})
