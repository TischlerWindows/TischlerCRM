'use client';

/**
 * Embedded Object Manager "Page Editor" section: layout list only.
 * Editing happens on the full-page route `/object-manager/[api]/page-editor/[layoutId|new]`.
 */
import { useRouter } from 'next/navigation';
import type { SetLayoutActiveResult } from '@/lib/schema-store';
import { useSchemaStore } from '@/lib/schema-store';
import { LayoutListView } from './page-editor/layout-list-view';

interface PageEditorProps {
  objectApiName: string;
  /** @deprecated Deep links use `/page-editor/[layoutId]`; kept for API compatibility */
  initialLayoutId?: string | null;
}

export default function PageEditor({ objectApiName }: PageEditorProps) {
  const router = useRouter();
  const { schema, setLayoutActive, setLayoutDefault, updateObject } = useSchemaStore();
  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  const onCreate = () => {
    router.push(
      `/object-manager/${encodeURIComponent(objectApiName)}/page-editor/new`
    );
  };

  const onEdit = (layoutId: string) => {
    router.push(
      `/object-manager/${encodeURIComponent(objectApiName)}/page-editor/${encodeURIComponent(layoutId)}`
    );
  };

  const deleteLayout = async (layoutId: string) => {
    if (!object) return;
    if (!confirm('Are you sure you want to delete this page layout?')) return;

    const updatedLayouts = (object.pageLayouts || []).filter((l) => l.id !== layoutId);
    try {
      await updateObject(objectApiName, {
        pageLayouts: updatedLayouts,
      });
    } catch (err) {
      console.error('Failed to delete layout:', err);
      throw err;
    }
  };

  const onSetActive = async (
    layoutId: string,
    active: boolean,
    options?: { force?: boolean },
  ): Promise<SetLayoutActiveResult> => {
    return setLayoutActive(objectApiName, layoutId, active, options);
  };

  const onSetDefault = async (layoutId: string) => {
    await setLayoutDefault(objectApiName, layoutId);
  };

  const onSetRoles = async (layoutId: string, roles: string[]) => {
    const currentObject = schema?.objects.find((o) => o.apiName === objectApiName);
    if (!currentObject) return;
    const nextRoles = Array.from(new Set(roles.filter(Boolean)));
    let pageLayouts = (currentObject.pageLayouts || []).map((layout) =>
      layout.id === layoutId ? { ...layout, roles: nextRoles } : layout,
    );
    const targetLayout = pageLayouts.find((layout) => layout.id === layoutId);
    if (targetLayout?.active) {
      const conflicts = pageLayouts.filter((layout) => {
        if (!layout.active || layout.id === layoutId) return false;
        const layoutRoles = layout.roles ?? [];
        return layoutRoles.some((role) => nextRoles.includes(role));
      });
      if (conflicts.length > 0) {
        const conflictNames = conflicts.map((layout) => layout.name).join(', ');
        const confirmed = window.confirm(
          `These active layouts share one or more roles and will be deactivated: ${conflictNames}. Continue?`,
        );
        if (!confirmed) return;
        const conflictIds = new Set(conflicts.map((layout) => layout.id));
        pageLayouts = pageLayouts.map((layout) =>
          conflictIds.has(layout.id) ? { ...layout, active: false } : layout,
        );
      }
    }
    await updateObject(objectApiName, { pageLayouts });
  };

  const onDuplicate = async (layoutId: string) => {
    const currentObject = schema?.objects.find((o) => o.apiName === objectApiName);
    if (!currentObject) return;
    const source = (currentObject.pageLayouts || []).find((layout) => layout.id === layoutId);
    if (!source) return;

    const createId = () => Math.random().toString(36).slice(2, 11);
    const baseName = `${source.name} Copy`;
    const existingNames = new Set((currentObject.pageLayouts || []).map((layout) => layout.name));
    let copyName = baseName;
    let index = 2;
    while (existingNames.has(copyName)) {
      copyName = `${baseName} ${index}`;
      index += 1;
    }

    const clone = structuredClone(source);
    clone.id = createId();
    clone.name = copyName;
    clone.active = false;
    clone.isDefault = false;

    try {
      await updateObject(objectApiName, {
        pageLayouts: [...(currentObject.pageLayouts || []), clone],
      });
    } catch (err) {
      console.error('Failed to duplicate layout:', err);
      throw err;
    }
  };

  const availableRoles = Array.from(
    new Set([
      'Admin',
      'Manager',
      'Sales',
      ...(object?.pageLayouts || []).flatMap((layout) => layout.roles || []),
    ]),
  );

  return (
    <LayoutListView
      objectLabel={object?.label}
      layouts={object?.pageLayouts || []}
      onCreate={onCreate}
      onEdit={onEdit}
      onDelete={deleteLayout}
      onSetActive={onSetActive}
      onSetDefault={onSetDefault}
      onSetRoles={onSetRoles}
      availableRoles={availableRoles}
      onDuplicate={onDuplicate}
    />
  );
}
