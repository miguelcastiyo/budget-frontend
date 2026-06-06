"use client"

import { useCallback, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react"

interface UseSwipeDismissOptions {
  open: boolean
  onDismiss: () => void
  scrollRef: RefObject<HTMLElement | null>
}

interface SwipeDismissProps {
  onClick: (event: ReactMouseEvent<HTMLElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  style?: CSSProperties
}

const CLOSE_DISTANCE = 110
const CLOSE_VELOCITY = 0.5
const HORIZONTAL_TOLERANCE = 1.25
const MOBILE_QUERY = "(max-width: 639px)"
const SNAP_BACK_MS = 260
const DISMISS_MS = 220

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.closest("[data-swipe-handle='true']")) {
    return false
  }

  return Boolean(
    target.closest(
      "input, textarea, select, button, a, [role='button'], [role='combobox'], [data-radix-popper-content-wrapper]"
    )
  )
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  return window.matchMedia(MOBILE_QUERY).matches
}

export function useSwipeDismiss({
  open,
  onDismiss,
  scrollRef,
}: UseSwipeDismissOptions): SwipeDismissProps {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isSettling, setIsSettling] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startTimeRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const gestureActiveRef = useRef(false)
  const gestureRejectedRef = useRef(false)
  const lastDragYRef = useRef(0)

  const resetDrag = useCallback(() => {
    pointerIdRef.current = null
    gestureActiveRef.current = false
    gestureRejectedRef.current = false
    lastDragYRef.current = 0
    setIsDragging(false)
    setIsDismissing(false)
    setDragY(0)
  }, [])

  const snapBack = useCallback(() => {
    setIsDragging(false)
    setIsSettling(true)
    setDragY(0)
    window.setTimeout(() => {
      setIsSettling(false)
      resetDrag()
    }, SNAP_BACK_MS)
  }, [resetDrag])

  const dismissWithMomentum = useCallback(() => {
    setIsDragging(false)
    setIsSettling(true)
    setIsDismissing(true)
    setDragY(Math.max(window.innerHeight, lastDragYRef.current))

    window.setTimeout(() => {
      onDismiss()
      resetDrag()
      setIsSettling(false)
    }, DISMISS_MS)
  }, [onDismiss, resetDrag])

  const handleClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!open || !isMobileViewport()) {
      return
    }

    const target = event.target
    if (target instanceof HTMLElement && target.closest("[data-swipe-handle='true']")) {
      onDismiss()
    }
  }, [onDismiss, open])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!open || !isMobileViewport() || event.pointerType === "mouse" || isInteractiveTarget(event.target)) {
      return
    }

    const scrollNode = scrollRef.current
    if (scrollNode && scrollNode.scrollTop > 0) {
      return
    }

    pointerIdRef.current = event.pointerId
    gestureActiveRef.current = false
    gestureRejectedRef.current = false
    startXRef.current = event.clientX
    startYRef.current = event.clientY
    startTimeRef.current = performance.now()
    lastDragYRef.current = 0
  }, [open, scrollRef])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId || gestureRejectedRef.current) {
      return
    }

    const deltaX = event.clientX - startXRef.current
    const deltaY = event.clientY - startYRef.current

    if (!gestureActiveRef.current) {
      if (Math.abs(deltaX) > Math.abs(deltaY) * HORIZONTAL_TOLERANCE) {
        gestureRejectedRef.current = true
        resetDrag()
        return
      }

      if (deltaY <= 8) {
        return
      }

      const scrollNode = scrollRef.current
      if (scrollNode && scrollNode.scrollTop > 0) {
        gestureRejectedRef.current = true
        resetDrag()
        return
      }

      gestureActiveRef.current = true
      setIsDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (deltaY < 0) {
      return
    }

    const resistedDrag = deltaY < 180
      ? deltaY
      : 180 + (1 - Math.exp(-(deltaY - 180) / 260)) * 150
    lastDragYRef.current = resistedDrag
    setDragY(resistedDrag)
    event.preventDefault()
  }, [resetDrag, scrollRef])

  const handlePointerEnd = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!gestureActiveRef.current) {
      resetDrag()
      return
    }

    const elapsed = Math.max(performance.now() - startTimeRef.current, 1)
    const velocity = lastDragYRef.current / elapsed
    const projectedDistance = lastDragYRef.current + velocity * 180
    const shouldClose = lastDragYRef.current >= CLOSE_DISTANCE || velocity >= CLOSE_VELOCITY || projectedDistance >= CLOSE_DISTANCE

    if (shouldClose) {
      dismissWithMomentum()
      return
    }

    snapBack()
  }, [dismissWithMomentum, resetDrag, snapBack])

  const translate = dragY > 0 || isSettling ? `0 ${dragY}px` : undefined

  return {
    onClick: handleClick,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    style: translate
      ? {
          translate,
          transition: isDragging
            ? "none"
            : isDismissing
              ? `translate ${DISMISS_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
              : `translate ${SNAP_BACK_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
          touchAction: isDragging ? "none" : "pan-y",
          willChange: "translate",
        }
      : undefined,
  }
}
