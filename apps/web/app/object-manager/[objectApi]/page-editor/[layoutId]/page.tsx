'use client';

import { Suspense } from 'react';
import { EditorPage } from '../editor';

export default function PageEditorRoute() {
  return (
    <Suspense>
      <EditorPage />
    </Suspense>
  );
}
