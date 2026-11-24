// Pointer helpers shared by mouse and touch.
import type { PointerEvent as ReactPointerEvent } from 'react'
//
// Touch differs from the mouse in two ways that matter here:
// - The browser may take over a touch to scroll or pinch; it then sends `pointercancel`. A cancelled drag
//   must leave no trace (no move saved, no edit started).
// - A second finger turns any running gesture into a pinch, so drags in progress are cancelled.

interface Tracked {
  cancel: () => void
}

const active = new Set<Tracked>()
const touchPointers = new Set<number>()
let multiTouchSince = 0

/** True while two or more fingers are down, and briefly after, so the release of a pinch is not a tap. */
export function inMultiTouch(): boolean {
  return touchPointers.size > 1 || performance.now() - multiTouchSince < 250
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return
      touchPointers.add(e.pointerId)
      if (touchPointers.size > 1) {
        multiTouchSince = performance.now()
        for (const t of [...active]) t.cancel()
      }
    },
    true
  )
  const release = (e: PointerEvent): void => {
    if (touchPointers.size > 1) multiTouchSince = performance.now()
    touchPointers.delete(e.pointerId)
  }
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
}

/** Touch and pen behave like fingers: they scroll the page, so actions wait for a tap. */
export function isTouchLike(event: { pointerType?: string }): boolean {
  return event.pointerType !== undefined && event.pointerType !== 'mouse'
}

/**
 * Follows a pointer drag started by `event` until release. Deltas are in
 * client pixels relative to the start. Returns false from onUp when the
 * pointer barely moved (a click). When the browser takes the pointer over
 * (scroll, pinch) or a second finger lands, onCancel runs instead of onUp.
 */
export function trackPointer(
  event: { clientX: number; clientY: number; pointerId: number },
  handlers: {
    onMove?: (dx: number, dy: number, e: PointerEvent) => void
    onUp?: (dx: number, dy: number, moved: boolean, e: PointerEvent) => void
    onCancel?: () => void
  }
): void {
  const startX = event.clientX
  const startY = event.clientY
  let moved = false
  const stop = (): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancelEvent)
    active.delete(tracked)
  }
  const tracked: Tracked = {
    cancel: () => {
      stop()
      handlers.onCancel?.()
    }
  }
  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== event.pointerId) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (!moved && Math.hypot(dx, dy) < 3) return
    moved = true
    handlers.onMove?.(dx, dy, e)
  }
  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== event.pointerId) return
    stop()
    handlers.onUp?.(e.clientX - startX, e.clientY - startY, moved, e)
  }
  const onCancelEvent = (e: PointerEvent): void => {
    if (e.pointerId === event.pointerId) tracked.cancel()
  }
  active.add(tracked)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancelEvent)
}

const TAP_SLOP = 10

/**
 * Runs `action` for a click or tap. With a mouse it runs at once (unchanged desktop behavior); with a
 * finger it waits for the release, and only if the finger stayed put and the browser did not start a
 * scroll or pinch. So placing a finger to scroll never commits, deselects or starts an edit.
 */
export function onTap(event: PointerEvent | ReactPointerEvent, action: (e?: PointerEvent) => void): void {
  if (!isTouchLike(event)) {
    action()
    return
  }
  trackPointer(event, {
    onUp: (dx, dy, _moved, e) => {
      if (Math.hypot(dx, dy) <= TAP_SLOP && !inMultiTouch()) action(e)
    }
  })
}
