import { useRef, useEffect, useCallback } from 'react'

/**
 * Hook for Excel-like arrow key navigation in data entry grids.
 * Inputs must have data-row and data-col attributes.
 */
export function useGridNavigation() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLInputElement
      if (target.tagName !== 'INPUT' || target.type !== 'number') return

      const row = parseInt(target.dataset.row ?? '', 10)
      const col = parseInt(target.dataset.col ?? '', 10)
      if (isNaN(row) || isNaN(col)) return

      let nextRow = row
      let nextCol = col

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          nextRow = row - 1
          break
        case 'ArrowDown':
        case 'Enter':
          e.preventDefault()
          nextRow = row + 1
          break
        case 'ArrowLeft':
          e.preventDefault()
          nextCol = col - 1
          break
        case 'ArrowRight':
          e.preventDefault()
          nextCol = col + 1
          break
        case 'Tab':
          // Let Tab work naturally but also select text in the next input
          // Don't preventDefault — browser handles Tab natively
          return
        default:
          return
      }

      const next = container.querySelector(
        `input[data-row="${nextRow}"][data-col="${nextCol}"]`
      ) as HTMLInputElement | null
      if (next) {
        next.focus()
        next.select()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [])

  const getCellProps = useCallback((row: number, col: number) => ({
    'data-row': row,
    'data-col': col,
  }), [])

  return { containerRef, getCellProps }
}
