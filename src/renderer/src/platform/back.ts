// The Android Back button closes the innermost thing first: a dialog, a menu, the text being edited, a
// selection. Only when nothing is left does the app ask about unsaved changes and exit (androidApi.ts).
// Desktop never calls runBack, so registering is harmless there.
import { useEffect, useRef } from 'react'

/** Return false to pass Back on to the next handler. */
type BackHandler = () => boolean | void

const stack: BackHandler[] = []

export function pushBack(handler: BackHandler): () => void {
  stack.push(handler)
  return () => {
    const index = stack.lastIndexOf(handler)
    if (index >= 0) stack.splice(index, 1)
  }
}

/** Runs the most recently registered handler that takes Back. True when one did. */
export function runBack(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]() !== false) return true
  }
  return false
}

/** Registers `handler` for Back while `active` is true. The latest handler is always used. */
export function useBackHandler(active: boolean, handler: BackHandler): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    return pushBack(() => ref.current())
  }, [active])
}
