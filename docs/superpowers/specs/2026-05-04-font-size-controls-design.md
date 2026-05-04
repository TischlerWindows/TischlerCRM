# Per-Element Font Size Controls — Design Spec

## Context

The page builder currently supports text styling (bold, italic, uppercase, color) but has no font size control. All text sizes are hardcoded via Tailwind classes: field labels at 12px (`text-xs`), field values at 14px (`text-sm`), and panel headers at 14px (`text-sm`). Users need the ability to customize text size per-element to match their brand and readability requirements.

## Scope

Add per-element font size controls to:
- **Field labels** (via `LabelStyle.fontSize`)
- **Field values** (via `ValueStyle.fontSize`)
- **Panel headers** (via `PanelStyle.headerFontSize`)

Region/section labels are **not** in scope.

## Font Size Range & Presets

- **Range**: 8–32 (integers only)
- **Presets**: 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32
- **Defaults** (when `fontSize` is `undefined`):
  - Field label: 12px
  - Field value: 14px
  - Panel header: 14px

Undefined means the current Tailwind classes apply — zero visual change for existing layouts.

## Data Model Changes

### `LabelStyle` (in `apps/web/lib/schema.ts`)

```typescript
export interface LabelStyle {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  uppercase?: boolean;
  fontSize?: number; // NEW — 8–32, default 12
}
```

### `ValueStyle` (in `apps/web/lib/schema.ts`)

```typescript
export interface ValueStyle {
  color?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number; // NEW — 8–32, default 14
}
```

### `PanelStyle` (in `apps/web/lib/schema.ts`)

```typescript
export interface PanelStyle {
  headerBackground?: string;
  headerTextColor?: string;
  headerBold?: boolean;
  headerItalic?: boolean;
  headerUppercase?: boolean;
  bodyBackground?: string;
  headerFontSize?: number; // NEW — 8–32, default 14
}
```

No database migration needed. These live inside existing JSON style objects that are already persisted as part of the layout config.

## UI Component: `FontSizeCombobox`

A new shared component in `apps/web/app/object-manager/[objectApi]/page-editor/properties/shared.tsx`.

**Behavior:**
- Editable text input (52px wide) showing current numeric value
- Click arrow or focus to open dropdown with preset values
- User can type any integer 8–32 directly into the input
- On blur: clamp to 8–32, round to integer, validate
- Invalid input reverts to previous value
- Current value highlighted in dropdown with checkmark
- Click outside or select a preset to close

**Props:**
```typescript
interface FontSizeComboboxProps {
  value: number | undefined;
  defaultValue: number; // fallback when value is undefined
  onChange: (value: number | undefined) => void;
}
```

Passing `undefined` to `onChange` resets to default (removes the override).

## Properties Panel Integration

### Field Properties (`field-properties.tsx`)

Replace the current separate "Label style" and "Value style" button groups with compact toolbar rows:

**Label style row:** `[FontSizeCombobox] | [Bold] [Italic] [Uppercase]`
**Value style row:** `[FontSizeCombobox] | [Bold] [Italic]`

The `|` is a thin vertical divider (1px, gray-200).

### Panel Properties (`panel-properties.tsx`)

Replace the "Header text style" button group:

**Header text style row:** `[FontSizeCombobox] | [Bold] [Italic] [Uppercase]`

## Renderer Changes

### `record-tab-renderer.tsx`

Add `fontSize` to inline style objects:

**Field label:**
```typescript
const labelStyle: React.CSSProperties = {
  ...(f.labelStyle?.color ? { color: f.labelStyle.color } : {}),
  fontWeight: f.labelStyle?.bold ? 700 : undefined,
  fontStyle: f.labelStyle?.italic ? 'italic' : undefined,
  textTransform: f.labelStyle?.uppercase ? 'uppercase' : undefined,
  fontSize: f.labelStyle?.fontSize ? `${f.labelStyle.fontSize}px` : undefined, // NEW
};
```

**Field value:**
```typescript
const valueStyle: React.CSSProperties = {
  ...(f.valueStyle?.color ? { color: f.valueStyle.color } : {}),
  ...(f.valueStyle?.background ? { backgroundColor: f.valueStyle.background, padding: '2px 6px', borderRadius: 4 } : {}),
  fontWeight: f.valueStyle?.bold ? 700 : undefined,
  fontStyle: f.valueStyle?.italic ? 'italic' : undefined,
  fontSize: f.valueStyle?.fontSize ? `${f.valueStyle.fontSize}px` : undefined, // NEW
};
```

**Panel header:** same pattern with `panel.style.headerFontSize`.

### Canvas Preview (`canvas-field.tsx`, `canvas-panel.tsx`)

Apply the same `fontSize` inline style so the editor canvas reflects size changes live during editing.

## Verification Plan

1. **Unit**: Verify `FontSizeCombobox` renders, opens dropdown, accepts typed values, clamps to 8–32
2. **Integration**: Open page builder, select a field, change label and value font sizes, verify canvas preview updates
3. **Persistence**: Save layout, reload page editor, verify sizes persist
4. **Runtime**: View a record detail page, verify custom font sizes render correctly
5. **Defaults**: Verify existing layouts with no `fontSize` set render identically to current behavior
6. **Edge cases**: Type 0, 100, "abc", empty string — verify clamping/fallback
7. **QA**: Live QA run on Railway-hosted site using Claude in Chrome
