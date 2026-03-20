'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldVisibilityRuleEditor } from '@/components/field-visibility-rule-editor';
import type { ConditionExpr, FieldDef, FormattingRule } from '@/lib/schema';
import { generateId } from '@/lib/schema';
import { Trash2, Plus } from 'lucide-react';

export function FormattingRulesDialog({
  open,
  onOpenChange,
  rules,
  onApply,
  sections,
  objectFields,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rules: FormattingRule[];
  onApply: (next: FormattingRule[]) => void;
  sections: { id: string; label: string }[];
  objectFields: FieldDef[];
}) {
  const [working, setWorking] = useState<FormattingRule[]>(rules);
  const [showComposer, setShowComposer] = useState(false);

  const [name, setName] = useState('New rule');
  const [order, setOrder] = useState(0);
  const [targetKind, setTargetKind] = useState<'field' | 'section'>('field');
  const [fieldApi, setFieldApi] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [when, setWhen] = useState<ConditionExpr[]>([]);
  const [hidden, setHidden] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [badge, setBadge] = useState<'none' | 'success' | 'warning' | 'destructive'>('none');

  useEffect(() => {
    if (open) {
      setWorking(rules.map((r) => ({ ...r, when: [...(r.when || [])] })));
      setShowComposer(false);
    }
  }, [open, rules]);

  useEffect(() => {
    if (objectFields[0] && !fieldApi) {
      setFieldApi(objectFields[0].apiName);
    }
    if (sections[0] && !sectionId) {
      setSectionId(sections[0].id);
    }
  }, [objectFields, sections, fieldApi, sectionId]);

  const resetComposer = () => {
    setName('New rule');
    setOrder(working.length);
    setTargetKind('field');
    setFieldApi(objectFields[0]?.apiName ?? '');
    setSectionId(sections[0]?.id ?? '');
    setWhen([]);
    setHidden(false);
    setReadOnly(false);
    setBadge('none');
  };

  const addRule = () => {
    const target: FormattingRule['target'] =
      targetKind === 'field'
        ? { kind: 'field', fieldApiName: fieldApi }
        : { kind: 'section', sectionId };

    const effects: FormattingRule['effects'] = {};
    if (hidden) effects.hidden = true;
    if (readOnly) effects.readOnly = true;
    if (badge !== 'none') effects.badge = badge;

    const rule: FormattingRule = {
      id: generateId(),
      name: name.trim() || 'Rule',
      active: true,
      order,
      when: when.length > 0 ? when : [],
      target,
      effects,
    };

    setWorking((prev) => [...prev, rule].sort((a, b) => a.order - b.order));
    setShowComposer(false);
    resetComposer();
  };

  const fakeFieldForEditor: FieldDef = {
    id: 'formatting-when',
    apiName: '__formatting_when__',
    label: 'When (all conditions)',
    type: 'Text',
    visibleIf: when,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Layout formatting rules</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">
          First matching rule wins (by <span className="font-medium">order</span>). Uses the same
          condition builder as field visibility.
        </p>

        <div className="space-y-2 my-4">
          {working.length === 0 ? (
            <p className="text-sm text-gray-500">No rules yet.</p>
          ) : (
            working.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-gray-500">
                    order {r.order} ·{' '}
                    {r.target.kind === 'field'
                      ? `Field: ${r.target.fieldApiName}`
                      : `Section: ${r.target.sectionId}`}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => setWorking((prev) => prev.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {!showComposer ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              resetComposer();
              setShowComposer(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add rule
          </Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Order</Label>
                <Input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
            <div>
              <Label>Target</Label>
              <Select
                value={targetKind}
                onValueChange={(v) => setTargetKind(v as 'field' | 'section')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="field">Field</SelectItem>
                  <SelectItem value="section">Section</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetKind === 'field' ? (
              <div>
                <Label>Field</Label>
                <Select value={fieldApi} onValueChange={setFieldApi}>
                  <SelectTrigger>
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {objectFields.map((f) => (
                      <SelectItem key={f.apiName} value={f.apiName}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Section</Label>
                <Select value={sectionId} onValueChange={setSectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>When</Label>
              <FieldVisibilityRuleEditor
                field={fakeFieldForEditor}
                availableFields={objectFields}
                onSave={(conditions) => setWhen(conditions)}
                onCancel={() => setWhen([])}
              />
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Hide
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={readOnly}
                  onChange={(e) => setReadOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Read-only
              </label>
              <div className="flex items-center gap-2">
                <Label className="mb-0">Badge</Label>
                <Select value={badge} onValueChange={(v) => setBadge(v as typeof badge)}>
                  <SelectTrigger className="w-[160px]">
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
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={addRule}>
                Save rule
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowComposer(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(working);
              onOpenChange(false);
            }}
          >
            Apply to layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
