'use client';

/**
 * Embedded Object Manager "Page Editor" section: layout list only.
 * Editing happens on the full-page route `/object-manager/[api]/page-editor/[layoutId|new]`.
 */
import { useRouter } from 'next/navigation';
import { useSchemaStore } from '@/lib/schema-store';
import { LayoutListView } from './page-editor/layout-list-view';

interface PageEditorProps {
  objectApiName: string;
  /** @deprecated Deep links use `/page-editor/[layoutId]`; kept for API compatibility */
  initialLayoutId?: string | null;
}

export default function PageEditor({ objectApiName }: PageEditorProps) {
  const router = useRouter();
  const { schema, updateObject } = useSchemaStore();
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
      alert('Failed to delete layout. Please try again.');
    }
  };

  return (
    <LayoutListView
      objectLabel={object?.label}
      layouts={object?.pageLayouts || []}
      onCreate={onCreate}
      onEdit={onEdit}
      onDelete={deleteLayout}
    />
  );
}
