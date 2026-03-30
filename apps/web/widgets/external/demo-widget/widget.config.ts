import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'demo-widget',
  name: 'Demo Widget',
  description: 'Framework demo — shows every schema field type. Copy as a starting template.',
  icon: 'Puzzle',
  category: 'external',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [
    { key: 'title', type: 'text', label: 'Title', default: 'Demo Widget' },
    { key: 'description', type: 'textarea', label: 'Description' },
    { key: 'linkUrl', type: 'url', label: 'Link URL' },
    { key: 'dynamicPath', type: 'merge-text', label: 'Dynamic Path', placeholder: '/records/{record.name}' },
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
      default: 'light',
    },
    {
      key: 'size',
      type: 'button-group',
      label: 'Size',
      options: [
        { value: 'sm', label: 'S' },
        { value: 'md', label: 'M' },
        { value: 'lg', label: 'L' },
      ],
      default: 'md',
    },
    { key: 'showHeader', type: 'boolean', label: 'Show Header', default: true },
    { key: 'maxItems', type: 'number', label: 'Max Items', default: 10, min: 1, max: 50 },
    { key: 'accentColor', type: 'color', label: 'Accent Color', default: '#3b82f6' },
    { key: 'linkedObject', type: 'object-select', label: 'Link to Object' },
    { type: 'divider' },
    { type: 'heading', label: 'Advanced' },
    { key: 'customPayload', type: 'json', label: 'Custom Payload' },
  ],
}
