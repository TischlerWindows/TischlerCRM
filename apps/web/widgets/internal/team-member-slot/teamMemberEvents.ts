/**
 * Tiny module-level event channel for "TeamMember rows changed" notifications.
 *
 * The PendingTeamMemberPool's `bumpVersion` only signals widgets sharing the
 * provider — that covers create/edit forms. In view mode (record detail page)
 * there's no provider, so a slot writing a TeamMember row needs another way to
 * tell the rollup widget to refetch. This helper bridges that gap.
 *
 * Usage:
 *   - Writers: call `notifyTeamMembersChanged()` after a successful save/delete.
 *   - Listeners: call `subscribeTeamMembersChanged(cb)` in a useEffect; remove
 *     on cleanup with the returned unsubscribe.
 */

type Listener = () => void

const listeners = new Set<Listener>()

export function notifyTeamMembersChanged(): void {
  for (const l of listeners) {
    try {
      l()
    } catch {
      /* ignore listener errors — never let one widget break others */
    }
  }
}

export function subscribeTeamMembersChanged(cb: Listener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
