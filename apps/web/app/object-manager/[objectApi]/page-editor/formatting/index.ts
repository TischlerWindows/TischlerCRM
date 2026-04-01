import { lazy } from 'react';

export { FormattingRulesDialog } from './rules-dialog';

export const LazyFormattingRulesDialog = lazy(() =>
  import('./rules-dialog').then((m) => ({ default: m.FormattingRulesDialog })),
);
