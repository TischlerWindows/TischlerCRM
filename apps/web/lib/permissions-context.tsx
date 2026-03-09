'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from './api-client';
import { useAuth } from './auth-context';

/* ── Types ──────────────────────────────────────────────────────────── */

export interface ObjectPermission {
  read: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
}

export interface AppPermissions {
  manageUsers: boolean;
  manageProfiles: boolean;
  manageDepartments: boolean;
  exportData: boolean;
  importData: boolean;
  manageReports: boolean;
  manageDashboards: boolean;
  viewSetup: boolean;
  customizeApplication: boolean;
  manageSharing: boolean;
  viewAllData: boolean;
  modifyAllData: boolean;
}

interface PermissionsData {
  userId: string;
  departmentName: string | null;
  profileName: string | null;
  role: string;
  objectPermissions: Record<string, ObjectPermission>;
  appPermissions: AppPermissions;
}

interface PermissionsContextType {
  permissions: PermissionsData | null;
  loading: boolean;
  /** Check if the user can perform `action` on the given object */
  canAccess: (objectApiName: string, action: keyof ObjectPermission) => boolean;
  /** Check if the user has an app-level permission */
  hasAppPermission: (perm: keyof AppPermissions) => boolean;
  /** Force re-fetch permissions (e.g. after department change) */
  refresh: () => void;
}

const FULL_OBJECT_PERM: ObjectPermission = {
  read: true,
  create: true,
  edit: true,
  delete: true,
  viewAll: true,
  modifyAll: true,
};

/* ── Context ────────────────────────────────────────────────────────── */

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!isAuthenticated) {
      setPermissions(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiClient.get<PermissionsData>('/me/permissions');
      setPermissions(data);
    } catch (err) {
      console.error('Failed to load permissions:', err);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && user) {
      setLoading(true);
      fetchPermissions();
    } else {
      setPermissions(null);
      setLoading(false);
    }
  }, [isAuthenticated, user, fetchPermissions]);

  const canAccess = useCallback(
    (objectApiName: string, action: keyof ObjectPermission): boolean => {
      // While loading or if not authenticated, be permissive so UI doesn't flicker
      if (!permissions) return true;
      // ADMIN always has full access
      if (permissions.role === 'ADMIN') return true;
      const objPerms = permissions.objectPermissions[objectApiName];
      // If no permissions configured for this object, allow by default
      if (!objPerms) return true;
      return !!objPerms[action];
    },
    [permissions],
  );

  const hasAppPermission = useCallback(
    (perm: keyof AppPermissions): boolean => {
      if (!permissions) return true;
      if (permissions.role === 'ADMIN') return true;
      return !!permissions.appPermissions?.[perm];
    },
    [permissions],
  );

  return (
    <PermissionsContext.Provider
      value={{ permissions, loading, canAccess, hasAppPermission, refresh: fetchPermissions }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (ctx === undefined) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return ctx;
}
