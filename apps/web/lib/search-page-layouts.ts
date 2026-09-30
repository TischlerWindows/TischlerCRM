export interface SearchPageLayout {
  id: string;
  name: string;
  objectApiNames: string[];
}

export interface SearchPageLayoutSettings {
  version: 1;
  layouts: SearchPageLayout[];
  defaultLayoutId: string | null;
  userAssignments: Record<string, string>;
}

export function createDefaultSearchPageLayoutSettings(objectApiNames: string[]): SearchPageLayoutSettings {
  return {
    version: 1,
    layouts: [{ id: 'default', name: 'Default', objectApiNames: [...objectApiNames] }],
    defaultLayoutId: 'default',
    userAssignments: {},
  };
}

export function getSearchPageLayoutForUser(
  settings: SearchPageLayoutSettings | null | undefined,
  userId: string,
): SearchPageLayout | null {
  if (!settings?.layouts?.length) return null;
  const assignedId = settings.userAssignments?.[userId];
  const layoutId = settings.layouts.some(layout => layout.id === assignedId)
    ? assignedId
    : settings.defaultLayoutId;
  return settings.layouts.find(layout => layout.id === layoutId) ?? null;
}