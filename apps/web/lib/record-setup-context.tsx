'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type RecordSetupValue = {
  objectApiName: string;
  pageLayoutId: string | null;
} | null;

type RecordSetupContextType = {
  value: RecordSetupValue;
  setRecordSetupContext: (v: RecordSetupValue) => void;
};

const RecordSetupContext = createContext<RecordSetupContextType | null>(null);

export function RecordSetupProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<RecordSetupValue>(null);
  const setRecordSetupContext = useCallback((v: RecordSetupValue) => {
    setValue(v);
  }, []);

  const memo = useMemo(
    () => ({ value, setRecordSetupContext }),
    [value, setRecordSetupContext]
  );

  return (
    <RecordSetupContext.Provider value={memo}>{children}</RecordSetupContext.Provider>
  );
}

export function useRecordSetupContext() {
  const ctx = useContext(RecordSetupContext);
  if (!ctx) {
    throw new Error('useRecordSetupContext must be used within RecordSetupProvider');
  }
  return ctx;
}
