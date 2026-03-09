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
      console.log('[Permissions] Fetching /me/permissions...');
      const data = await apiClient.get<PermissionsData>('/me/permissions');
      console.log('[Permissions] Loaded:', data?.role, 'objects:', Object.keys(data?.objectPermissions || {}));
      setPermissions(data);
    } catch (err) {
      console.error('[Permissions] Failed to load:', err);
      // Retry once after a short delay
      try {
        await new Promise(r => setTimeout(r, 1000));
        const data = await apiClient.get<PermissionsData>('/me/permissions');
        console.log('[Permissions] Retry succeeded:', data?.role);
        setPermissions(data);
      } catch (retryErr) {
        console.error('[Permissions] Retry also failed:', retryErr);
        setPermissions(null);
      }
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
      // ADMIN users always have full access (fast path from auth context)
      if (user?.role === 'ADMIN') return true;

      // Still loading? Allow briefly so UI doesn't flash empty
      if (loading) return true;

      // Permissions failed to load (API error) — be RESTRICTIVE
      if (!permissions) return false;

      const objPerms = permissions.objectPermissions[objectApiName];
      // If no permissions configured for this object, DENY by default
      // (admins are already handled above; for regular users, if no
      // department/profile/permset mentions an object it stays locked)
      if (!objPerms) return false;
      return !!objPerms[action];
    },
    [permissions, loading, user],
  );

  const hasAppPermission = useCallback(
    (perm: keyof AppPermissions): boolean => {
      if (user?.role === 'ADMIN') return true;
      if (loading) return true;
      if (!permissions) return false;
      return !!permissions.appPermissions?.[perm];
    },
    [permissions, loading, user],
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
