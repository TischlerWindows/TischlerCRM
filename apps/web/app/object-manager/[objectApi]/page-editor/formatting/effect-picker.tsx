'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormattingRule } from '@/lib/schema';
import { isBadgeToken, isHighlightToken } from './utils';

interface EffectPickerProps {
  rule: FormattingRule;
  onUpdateRule: (id: string, updater: (rule: FormattingRule) => FormattingRule) => void;
}

export function EffectPicker({ rule, onUpdateRule }: EffectPickerProps) {
  return (
    <div className="space-y-3 rounded-md border border-gray-200 p-3">
      <Label>Effects</Label>
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={!!rule.effects.hidden}
            onChange={(event) =>
              onUpdateRule(rule.id, (current) => ({
                ...current,
                effects: {
                  ...current.effects,
                  hidden: event.target.checked ? true : undefined,
                },
              }))
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          Hidden
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={!!rule.effects.readOnly}
            onChange={(event) =>
              onUpdateRule(rule.id, (current) => ({
                ...current,
                effects: {
                  ...current.effects,
                  readOnly: event.target.checked ? true : undefined,
                },
              }))
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          Read-only
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Badge</Label>
          <Select
            value={rule.effects.badge ?? 'none'}
            onValueChange={(value) => {
              if (value !== 'none' && !isBadgeToken(value)) return;
              onUpdateRule(rule.id, (current) => ({
                ...current,
                effects: {
                  ...current.effects,
                  badge: value === 'none' ? undefined : value,
                },
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="destructive">Destructive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Highlight token</Label>
          <Select
            value={rule.effects.highlightToken ?? 'none'}
            onValueChange={(value) => {
              if (!isHighlightToken(value)) return;
              onUpdateRule(rule.id, (current) => ({
                ...current,
                effects: {
                  ...current.effects,
                  highlightToken: value === 'none' ? undefined : value,
                },
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="subtle">Subtle</SelectItem>
              <SelectItem value="attention">Attention</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
