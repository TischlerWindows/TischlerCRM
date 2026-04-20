/**
 * Layout resolver — picks the one page layout a user should see for a given
 * object, based on active/roles/default assignment.
 *
 * The active layout always wins: records no longer pin themselves to a
 * historical layout. Existing records automatically render with whichever
 * layout is currently active for the viewer's profile.
 *
 * Priority (first match wins, all steps filter `layout.active === true`):
 *   1. Role match: layout whose `roles` contains the user's profileId
 *   2. Default: layout marked `isDefault: true`
 *   3. Single active: if only one active layout exists, use it
 *   4. Error: admin config problem, return an actionable message
 */

import type { ObjectDef, PageLayout } from './schema';

export type LayoutResolveResult =
  | { kind: 'resolved'; layout: PageLayout; reason: ResolveReason }
  | { kind: 'error'; reason: 'no-layouts' | 'no-match'; message: string };

export type ResolveReason =
  | 'role-match'
  | 'default'
  | 'single-active';

export interface ResolveUserContext {
  /** The current user's profile id — matched against `layout.roles`. */
  profileId?: string | null;
}

export interface ResolveOptions {
  /** Accepted for source-compat with older callers; ignored. The active
   *  layout now always wins regardless of what layout a record was saved
   *  against historically. */
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

  void options;

  // 1. Role match — first active layout whose roles include the user's profileId.
  const profileId = user.profileId ?? null;
  if (profileId) {
    const match = activeLayouts.find((l) => (l.roles ?? []).includes(profileId));
    if (match) return { kind: 'resolved', layout: match, reason: 'role-match' };
  }

  // 2. Default layout.
  const defaultLayout = activeLayouts.find((l) => l.isDefault === true);
  if (defaultLayout) {
    return { kind: 'resolved', layout: defaultLayout, reason: 'default' };
  }

  // 3. Single active — unambiguous, use it.
  if (activeLayouts.length === 1) {
    return { kind: 'resolved', layout: activeLayouts[0]!, reason: 'single-active' };
  }

  // 4. Admin configuration gap.
  return {
    kind: 'error',
    reason: 'no-match',
    message:
      'No layout is assigned to your profile and no default is set. Ask an admin to mark one layout as Default, or assign a layout to your profile.',
  };
}
