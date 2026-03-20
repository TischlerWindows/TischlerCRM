'use client';

import { Button } from '@/components/ui/button';
import type { PageLayout } from '@/lib/schema';
import { Grid2x2, Layout, Plus, Trash2 } from 'lucide-react';

export function LayoutListView({
  objectLabel,
  layouts,
  onCreate,
  onEdit,
  onDelete,
}: {
  objectLabel: string | undefined;
  layouts: PageLayout[];
  onCreate: () => void;
  onEdit: (layoutId: string) => void;
  onDelete: (layoutId: string) => void;
}) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Page Layouts</h2>
        <p className="text-gray-600">
          Manage page layouts for {objectLabel}. Layouts control fields on forms, presentation, and
          conditional rules.
        </p>
      </div>

      <div className="mb-6">
        <Button onClick={onCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create New Layout
        </Button>
      </div>

      {layouts.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Page Layouts</h3>
          <p className="text-gray-600 mb-4">
            Create your first page layout to define how forms appear for this object.
          </p>
          <Button onClick={onCreate} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Layout
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {layouts.map((layout) => (
            <div
              key={layout.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{layout.name}</h3>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Layout className="h-4 w-4" />
                  <span>
                    {layout.tabs.length} tab{layout.tabs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Grid2x2 className="h-4 w-4" />
                  <span>
                    {layout.tabs.reduce((sum, tab) => sum + tab.sections.length, 0)} section
                    {layout.tabs.reduce((sum, tab) => sum + tab.sections.length, 0) !== 1
                      ? 's'
                      : ''}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(layout.id)}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(layout.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
