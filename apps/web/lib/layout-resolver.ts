/**
 * Layout resolver — picks the one page layout a user should see for a given
 * object (and optional record), based on active/roles/default assignment.
 *
 * Pure + synchronous so it can be used from event handlers, `useMemo`, tests,
 * and both DynamicForm and RecordDetailPage resolution.
 *
 * Priority (first match wins, all steps filter `layout.active !== false`):
 *   1. Preserve context: record's stored pageLayoutId if still active
 *   2. Role match: layout whose `roles` contains the user's profileId
 *   3. Default: layout marked `isDefault: true`
 *   4. Single active: if only one active layout exists, use it
 *   5. Error: admin config problem, return an actionable message
 */

import type { ObjectDef, PageLayout } from './schema';

export type LayoutResolveResult =
  | { kind: 'resolved'; layout: PageLayout; reason: ResolveReason }
  | { kind: 'error'; reason: 'no-layouts' | 'no-match'; message: string };

export type ResolveReason =
  | 'record-layout'
  | 'role-match'
  | 'default'
  | 'single-active';

export interface ResolveUserContext {
  /** The current user's profile id — matched against `layout.roles`. */
  profileId?: string | null;
}

export interface ResolveOptions {
  /** When provided, the record's `pageLayoutId` preempts role/default lookup
   *  (if the layout is still active). */
  record?: { pageLayoutId?: string | null } | null;
  /** Informational only — the resolver doesn't split layouts by type today. */
  layoutType?: 'create' | 'edit';
}

function isActive(layout: PageLayout): boolean {
  // Require an explicit `true`. The editor's getStatus() shows undefined/false
  // as "Draft" — matching that here keeps the resolver and the admin UI in
  // sync. Template-built layouts (e.g. seeded "Property - Wood Template")
  // leave `active` undefined and would otherwise be wrongly treated as live,
  // making activeLayouts.length > 1 and bypassing the single-active shortcut.
  return layout.active === true;
}

export function resolveLayoutForUser(
  object: Pick<ObjectDef, 'pageLayouts'> | null | undefined,
  user: ResolveUserContext,
  options?: ResolveOptions,
): LayoutResolveResult {
  const layouts = object?.pageLayouts ?? [];
  if (layouts.length === 0) {
    return {
      kind: 'error',
      reason: 'no-layouts',
      message: 'No page layouts exist for this object. Ask an admin to create one.',
    };
  }

  const activeLayouts = layouts.filter(isActive);
  if (activeLayouts.length === 0) {
    return {
      kind: 'error',
      reason: 'no-match',
      message:
        "No active page layouts are available for this object. Ask an admin to activate one.",
    };
  }

  // 1. Preserve record's stored layout (when still active).
  const recordLayoutId = options?.record?.pageLayoutId;
  if (recordLayoutId) {
    const match = activeLayouts.find((l) => l.id === recordLayoutId);
    if (match) return { kind: 'resolved', layout: match, reason: 'record-layout' };
    // If the record references an inactive/deleted layout, fall through.
  }

  // 2. Role match — first active layout whose roles include the user's profileId.
  const profileId = user.profileId ?? null;
  if (profileId) {
    const match = activeLayouts.find((l) => (l.roles ?? []).includes(profileId));
    if (match) return { kind: 'resolved', layout: match, reason: 'role-match' };
  }

  // 3. Default layout.
  const defaultLayout = activeLayouts.find((l) => l.isDefault === true);
  if (defaultLayout) {
    return { kind: 'resolved', layout: defaultLayout, reason: 'default' };
  }

  // 4. Single active — unambiguous, use it.
  if (activeLayouts.length === 1) {
    return { kind: 'resolved', layout: activeLayouts[0]!, reason: 'single-active' };
  }

  // 5. Admin configuration gap.
  return {
    kind: 'error',
    reason: 'no-match',
    message:
      'No layout is assigned to your profile and no default is set. Ask an admin to mark one layout as Default, or assign a layout to your profile.',
  };
}
