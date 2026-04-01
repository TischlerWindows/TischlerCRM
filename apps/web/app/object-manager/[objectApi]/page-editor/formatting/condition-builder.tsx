'use client';

import React from 'react';
import { FieldVisibilityRuleEditor } from '@/components/field-visibility-rule-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ConditionExpr,
  FieldDef,
  FormattingRule,
  FormattingRuleTarget,
} from '@/lib/schema';
import type { FieldTargetOption, PanelTargetOption, RegionTargetOption } from './types';
import {
  buildTargetForKind,
  isTargetKind,
  toFieldSelectValue,
  toFieldTarget,
} from './utils';

interface ConditionBuilderProps {
  rule: FormattingRule;
  objectFields: FieldDef[];
  fieldTargets: FieldTargetOption[];
  panelTargets: PanelTargetOption[];
  regionTargets: RegionTargetOption[];
  hasFieldTargetOptions: boolean;
  hasPanelTargetOptions: boolean;
  hasRegionTargetOptions: boolean;
  onUpdateRule: (id: string, updater: (rule: FormattingRule) => FormattingRule) => void;
}

export function ConditionBuilder({
  rule,
  objectFields,
  fieldTargets,
  panelTargets,
  regionTargets,
  hasFieldTargetOptions,
  hasPanelTargetOptions,
  hasRegionTargetOptions,
  onUpdateRule,
}: ConditionBuilderProps) {
  const fakeFieldForEditor: FieldDef = {
    id: 'formatting-when',
    apiName: '__formatting_when__',
    label: `When conditions for ${rule.name}`,
    type: 'Text',
    visibleIf: rule.when ?? [],
  };

  return (
    <>
      <div>
        <Label htmlFor="formatting-rule-name">Name</Label>
        <Input
          id="formatting-rule-name"
          value={rule.name}
          onChange={(event) =>
            onUpdateRule(rule.id, (current) => ({
              ...current,
              name: event.target.value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Target kind</Label>
        <Select
          value={rule.target.kind}
          onValueChange={(value) => {
            if (!isTargetKind(value)) return;
            onUpdateRule(rule.id, (current) => ({
              ...current,
              target: buildTargetForKind(
                value,
                current.target,
                fieldTargets,
                panelTargets,
                regionTargets,
              ),
            }));
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="field" disabled={!hasFieldTargetOptions}>
              Field
            </SelectItem>
            <SelectItem value="panel" disabled={!hasPanelTargetOptions}>
              Panel
            </SelectItem>
            <SelectItem value="region" disabled={!hasRegionTargetOptions}>
              Region
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rule.target.kind === 'field' && (
        <div className="space-y-2">
          <Label>Field target (field + panel)</Label>
          <Select
            value={toFieldSelectValue(rule.target)}
            onValueChange={(value) => {
              const next = toFieldTarget(value);
              if (!next) return;
              onUpdateRule(rule.id, (current) => ({
                ...current,
                target: {
                  kind: 'field',
                  fieldApiName: next.fieldApiName,
                  panelId: next.panelId,
                },
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose field target" />
            </SelectTrigger>
            <SelectContent>
              {fieldTargets.map((option) => (
                <SelectItem
                  key={`${option.panelId}-${option.fieldApiName}`}
                  value={toFieldSelectValue(option)}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {rule.target.kind === 'panel' && (
        <div className="space-y-2">
          <Label>Panel target</Label>
          <Select
            value={rule.target.panelId}
            onValueChange={(panelId) =>
              onUpdateRule(rule.id, (current) => ({
                ...current,
                target: { kind: 'panel', panelId },
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose panel target" />
            </SelectTrigger>
            <SelectContent>
              {panelTargets.map((option) => (
                <SelectItem key={option.panelId} value={option.panelId}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {rule.target.kind === 'region' && (
        <div className="space-y-2">
          <Label>Region target</Label>
          <Select
            value={rule.target.regionId}
            onValueChange={(regionId) =>
              onUpdateRule(rule.id, (current) => ({
                ...current,
                target: { kind: 'region', regionId },
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose region target" />
            </SelectTrigger>
            <SelectContent>
              {regionTargets.map((option) => (
                <SelectItem key={option.regionId} value={option.regionId}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>When conditions (all must match)</Label>
        <FieldVisibilityRuleEditor
          field={fakeFieldForEditor}
          availableFields={objectFields}
          onSave={(conditions) =>
            onUpdateRule(rule.id, (current) => ({
              ...current,
              when: conditions,
            }))
          }
          onCancel={() => {}}
        />
      </div>
    </>
  );
}
