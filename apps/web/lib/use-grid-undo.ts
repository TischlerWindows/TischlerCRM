import { useCallback, useRef } from 'react'

const MAX_GRID_UNDO_ACTIONS = 50

export function useGridUndo<T>() {
  const history = useRef<T[]>([])

  const pushUndo = useCallback((snapshot: T) => {
    history.current.push(snapshot)
    if (history.current.length > MAX_GRID_UNDO_ACTIONS) history.current.shift()
  }, [])

  const popUndo = useCallback(() => history.current.pop(), [])

  const clearUndo = useCallback(() => {
    history.current = []
  }, [])

  return { pushUndo, popUndo, clearUndo }
}
