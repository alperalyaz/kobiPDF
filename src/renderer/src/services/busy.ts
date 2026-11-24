import { useAppStore } from '../store/useAppStore'

let depth = 0

/** True while a save (or another long operation) runs; Save, Save As and Share ignore taps meanwhile. */
export function isBusy(): boolean {
  return depth > 0
}

/** Lets the browser paint before heavy synchronous work (pdf-lib blocks the main thread). */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 0)))
}

/**
 * Runs `work` behind the full-screen busy overlay (message `key`). Nested calls share one overlay,
 * which stays until the outermost call ends.
 */
export async function runBusy<T>(key: string, work: () => Promise<T>): Promise<T> {
  depth += 1
  if (depth === 1) useAppStore.getState().setBusy(key)
  try {
    await nextPaint()
    return await work()
  } finally {
    depth -= 1
    if (depth === 0) useAppStore.getState().setBusy(null)
  }
}
