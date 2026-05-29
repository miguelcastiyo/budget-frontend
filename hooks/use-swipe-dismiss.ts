"use client"

import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react"

interface UseSwipeDismissOptions {
  open: boolean
  onDismiss: () => void
  scrollRef: RefObject<HTMLElement | null>
  baseTransform?: string
}

interface SwipeDismissProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  style?: CSSProperties
}

const CLOSE_DISTANCE = 96
const CLOSE_VELOCITY = 0.65
const HORIZONTAL_TOLERANCE = 1.25
const MOBILE_QUERY = "(max-width: 639px)"

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
  baseTransform = "",
}: UseSwipeDismissOptions): SwipeDismissProps {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isSettling, setIsSettling] = useState(false)
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
    setDragY(0)
  }, [])

  const snapBack = useCallback(() => {
    setIsDragging(false)
    setIsSettling(true)
    setDragY(0)
    window.setTimeout(() => {
      setIsSettling(false)
      resetDrag()
    }, 180)
  }, [resetDrag])

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

    const resistedDrag = deltaY > 220 ? 220 + (deltaY - 220) * 0.35 : deltaY
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
    const shouldClose = lastDragYRef.current >= CLOSE_DISTANCE || velocity >= CLOSE_VELOCITY

    if (shouldClose) {
      setIsDragging(false)
      onDismiss()
      resetDrag()
      return
    }

    snapBack()
  }, [onDismiss, resetDrag, snapBack])

  const transform = dragY > 0 || isSettling
    ? `${baseTransform ? `${baseTransform} ` : ""}translateY(${dragY}px)`
    : undefined

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    style: transform
      ? {
          transform,
          transition: isDragging ? "none" : "transform 180ms ease-out",
          touchAction: isDragging ? "none" : "pan-y",
        }
      : undefined,
  }
}
