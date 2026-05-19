'use client';

/**
 * Embedded Object Manager "Page Editor" section: layout list only.
 * Editing happens on the full-page route `/object-manager/[api]/page-editor/[layoutId|new]`.
 */
import { useEffect, useState } from 'react';
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

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Desktop Required</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Page Layout configuration is not available on mobile. Please use a desktop or laptop to configure page layouts.
        </p>
      </div>
    );
  }

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
