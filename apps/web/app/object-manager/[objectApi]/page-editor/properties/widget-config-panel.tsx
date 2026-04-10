'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldDef, WidgetConfig } from '@/lib/schema';
import { SchemaRenderer } from '@/lib/widgets/schema-renderer';
import { getWidgetById, getExternalRegistration, getInternalRegistrationByType } from '@/lib/widgets/registry-loader';
import type { LayoutTab, LayoutSection, LayoutWidget } from '../types';
import { useEditorStore } from '../editor-store';
import { useSchemaStore } from '@/lib/schema-store';
import { parseNumber } from './shared';

interface WidgetConfigPanelProps {
  selection: {
    kind: 'widget';
    tab: LayoutTab;
    region: LayoutSection;
    widget: LayoutWidget;
  };
  availableFields: FieldDef[];
}

export function WidgetConfigPanel({ selection, availableFields }: WidgetConfigPanelProps) {
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const removeWidget = useEditorStore((s) => s.removeWidget);
  const schema = useSchemaStore((s) => s.schema);
  const objectOptions = useMemo(
    () => (schema?.objects ?? []).map((o) => ({ value: o.apiName, label: o.label })),
    [schema?.objects]
  );

  return (
    <>
      <div className="rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
        Type: <span className="font-medium">{selection.widget.widgetType}</span>
      </div>

      {(selection.widget.config.type === 'RelatedList' ||
        selection.widget.config.type === 'HeaderHighlights' ||
        selection.widget.config.type === 'TeamMembersRollup') && (() => {
        const InternalPanel = getInternalRegistrationByType(selection.widget.config.type)?.ConfigPanel;
        if (!InternalPanel) return null;
        const objectFields = (availableFields ?? []).map((f) => ({
          apiName: f.apiName,
          label: f.label,
          type: String(f.type),
        }));
        return (
          <InternalPanel
            config={selection.widget.config as unknown as Record<string, unknown>}
            onChange={(newCfg) =>
              updateWidget(selection.widget.id, {
                config: newCfg as unknown as WidgetConfig,
              })
            }
            record={{}}
            integration={null}
            object={{ apiName: '', label: '', fields: objectFields }}
            objectOptions={objectOptions}
          />
        );
      })()}

      {selection.widget.config.type === 'ActivityFeed' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">maxItems</Label>
          <Input
            type="number"
            value={selection.widget.config.maxItems ?? 10}
            aria-label="Activity feed max items"
            onChange={(e) =>
              updateWidget(selection.widget.id, {
                config: {
                  ...selection.widget.config,
                  maxItems: Math.max(1, parseNumber(e.target.value, 10)),
                } as WidgetConfig,
              })
            }
          />
        </div>
      )}

      {selection.widget.config.type === 'FileFolder' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">provider</Label>
            <select
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
              value={selection.widget.config.provider}
              aria-label="File folder provider"
              onChange={(e) =>
                updateWidget(selection.widget.id, {
                  config: {
                    ...selection.widget.config,
                    provider: e.target.value as 'dropbox' | 'google-drive' | 'local',
                  } as WidgetConfig,
                })
              }
            >
              <option value="dropbox">dropbox</option>
              <option value="google-drive">google-drive</option>
              <option value="local">local</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">folderId</Label>
            <Input
              value={selection.widget.config.folderId ?? ''}
              aria-label="File folder ID"
              onChange={(e) =>
                updateWidget(selection.widget.id, {
                  config: {
                    ...selection.widget.config,
                    folderId: e.target.value,
                  } as WidgetConfig,
                })
              }
            />
          </div>
        </>
      )}

      {selection.widget.config.type === 'CustomComponent' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">componentId</Label>
          <Input
            value={selection.widget.config.componentId}
            aria-label="Custom component ID"
            onChange={(e) =>
              updateWidget(selection.widget.id, {
                config: {
                  ...selection.widget.config,
                  componentId: e.target.value,
                } as WidgetConfig,
              })
            }
          />
        </div>
      )}

      {selection.widget.config.type === 'Spacer' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">minHeightPx</Label>
          <Input
            type="number"
            value={selection.widget.config.minHeightPx ?? 32}
            aria-label="Spacer minimum height"
            onChange={(e) =>
              updateWidget(selection.widget.id, {
                config: {
                  ...selection.widget.config,
                  minHeightPx: Math.max(8, parseNumber(e.target.value, 32)),
                } as WidgetConfig,
              })
            }
          />
        </div>
      )}


      {selection.widget.config.type === 'ExternalWidget' && (() => {
        const externalConfig = selection.widget.config;
        const manifest = getWidgetById(externalConfig.externalWidgetId);
        const ExternalConfigPanel = getExternalRegistration(externalConfig.externalWidgetId)?.ConfigPanel;
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Display Mode</Label>
              <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
                {(['full', 'column'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      updateWidget(selection.widget.id, {
                        config: { ...externalConfig, displayMode: mode },
                      })
                    }
                    className={`flex-1 py-1.5 font-medium capitalize transition-colors ${
                      externalConfig.displayMode === mode
                        ? 'bg-brand-navy text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    } ${mode === 'column' ? 'border-l border-gray-200' : ''}`}
                  >
                    {mode === 'full' ? 'Full Width' : 'Column'}
                  </button>
                ))}
              </div>
            </div>

            {ExternalConfigPanel ? (
              <ExternalConfigPanel
                config={externalConfig.config}
                onChange={(newCfg) =>
                  updateWidget(selection.widget.id, {
                    config: { ...externalConfig, config: newCfg },
                  })
                }
                record={{}}
                integration={null}
                object={{ apiName: '', label: '', fields: [] }}
                objectOptions={objectOptions}
              />
            ) : manifest ? (
              <SchemaRenderer
                schema={manifest.configSchema}
                config={externalConfig.config}
                onChange={(key, value) =>
                  updateWidget(selection.widget.id, {
                    config: {
                      ...externalConfig,
                      config: { ...externalConfig.config, [key]: value },
                    },
                  })
                }
              />
            ) : (
              <div className="text-xs text-gray-400">
                Widget &quot;{externalConfig.externalWidgetId}&quot; not found in registry.
              </div>
            )}

            {manifest?.integration && (
              <div className="rounded-md bg-blue-50 px-2.5 py-2 text-xs text-blue-700 border border-blue-100">
                Powered by {manifest.integration}
              </div>
            )}
          </div>
        );
      })()}

      <div className="border-t border-gray-200 pt-3">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() => removeWidget(selection.widget.id)}
        >
          Delete widget
        </Button>
      </div>
    </>
  );
}
