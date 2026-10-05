'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  HelpCircle,
  Cog,
  Edit3,
  GripVertical,
  X,
  LogOut,
  Settings,
  Database,
  ExternalLink,
  Edit,
  LifeBuoy,
  Inbox,
  Users,
  Camera,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UniversalSearch from '@/components/universal-search';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { usePermissions, type AppPermissions } from '@/lib/permissions-context';
import { useSchemaStore } from '@/lib/schema-store';
import { getSetting, setSetting } from '@/lib/preferences';
import { PROFILE_PICTURE_KEY, resizeProfilePicture } from '@/lib/profile-picture';
import { RecordSetupProvider, useRecordSetupContext } from '@/lib/record-setup-context';
import { resolveListViewObjectSetup } from '@/lib/list-view-object-setup';
import { installGlobalErrorHandler } from '@/lib/error-reporter';
import { SubmitTicketModal } from '@/components/support/submit-ticket-modal';
import { MyTicketsDrawer } from '@/components/support/my-tickets-drawer';
import { BellPanel } from '@/components/notifications/bell-panel';

const defaultTabs = DEFAULT_TAB_ORDER;

function AppWrapperInner({ children }: { children: React.ReactNode }) {
  const { value: recordSetup } = useRecordSetupContext();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isImpersonating, returnToAdmin } = useAuth();
  const { canAccess, hasAppPermission } = usePermissions();
  const { schema, loadSchema } = useSchemaStore();
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedTabHref, setDraggedTabHref] = useState<string | null>(null);
  const [lastDragTargetHref, setLastDragTargetHref] = useState<string | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showSetupMenu, setShowSetupMenu] = useState(false);
  const [showSubmitTicket, setShowSubmitTicket] = useState(false);
  const [showMyTickets, setShowMyTickets] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
  const [savingProfilePicture, setSavingProfilePicture] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profilePictureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setProfilePicture(null);
    if (!user?.id) return () => { cancelled = true; };
    apiClient.getPreferences()
      .then(preferences => {
        if (cancelled) return;
        const value = preferences[PROFILE_PICTURE_KEY];
        setProfilePicture(typeof value === 'string' && /^data:image\/(?:webp|png|jpeg);base64,/.test(value) ? value : null);
      })
      .catch(() => {
        if (!cancelled) setProfilePicture(null);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const onProfilePictureUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; picture: string | null }>).detail;
      if (detail?.userId === user.id) setProfilePicture(detail.picture);
    };
    window.addEventListener('profile-picture-updated', onProfilePictureUpdated);
    return () => window.removeEventListener('profile-picture-updated', onProfilePictureUpdated);
  }, [user?.id]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setShowProfileMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showProfileMenu]);

  const handleProfilePictureChange = async (file?: File) => {
    if (!file || savingProfilePicture) return;
    setSavingProfilePicture(true);
    setProfilePictureError(null);
    try {
      const image = await resizeProfilePicture(file);
      await apiClient.setPreference(PROFILE_PICTURE_KEY, image);
      setProfilePicture(image);
    } catch (cause) {
      setProfilePictureError(cause instanceof Error ? cause.message : 'Could not save profile picture.');
    } finally {
      setSavingProfilePicture(false);
      if (profilePictureInputRef.current) profilePictureInputRef.current.value = '';
    }
  };

  const handleRemoveProfilePicture = async () => {
    if (savingProfilePicture) return;
    setSavingProfilePicture(true);
    setProfilePictureError(null);
    try {
      await apiClient.deletePreference(PROFILE_PICTURE_KEY);
      setProfilePicture(null);
    } catch (cause) {
      setProfilePictureError(cause instanceof Error ? cause.message : 'Could not remove profile picture.');
    } finally {
      setSavingProfilePicture(false);
    }
  };

  // Map tab hrefs to CRM object apiNames for permission filtering
  const hrefToObjectMap: Record<string, string> = {
    '/properties': 'Property',
    '/contacts': 'Contact',
    '/accounts': 'Account',
    '/products': 'Product',
    '/leads': 'Lead',
    '/opportunities': 'Opportunity',
    '/projects': 'Project',
    '/service': 'Service',
    '/workorders': 'WorkOrder',
    '/quotes': 'Quote',
    '/installations': 'Installation',
    '/tasks': 'Task',
  };

  // Also map custom object tabs (href like /objects/myobject) dynamically
  if (schema) {
    for (const obj of schema.objects) {
      const href = `/objects/${obj.apiName.toLowerCase()}`;
      if (!hrefToObjectMap[href]) {
        hrefToObjectMap[href] = obj.apiName;
      }
    }
  }

  // Map non-object tabs to app permissions
  const hrefToAppPermMap: Record<string, string> = {
    '/reports': 'manageReports',
    '/dashboard': 'manageDashboards',
  };

  // Filter tabs so users only see objects they have read access to
  const canShowTab = (tab: { name: string; href: string }): boolean => {
    const objectApiName = hrefToObjectMap[tab.href];
    if (objectApiName) return canAccess(objectApiName, 'read');

    const appPerm = hrefToAppPermMap[tab.href];
    if (appPerm) return hasAppPermission(appPerm as keyof AppPermissions);

    return true;
  };
  const filteredTabs = tabs.filter(canShowTab);
  const allowPageScroll = pathname === '/' || 
    pathname?.startsWith('/search') ||
    pathname?.includes('/[id]') || 
    pathname?.includes('/new') ||
    pathname?.startsWith('/contacts') ||
    pathname?.startsWith('/leads') ||
    pathname?.startsWith('/opportunities') ||
    pathname?.startsWith('/properties') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/projects') ||
    pathname?.startsWith('/installations') ||
    pathname?.startsWith('/products') ||
    pathname?.startsWith('/quotes') ||
    pathname?.startsWith('/reports') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/service') ||
    pathname?.startsWith('/workorders') ||
    pathname?.startsWith('/summary') ||
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/support') ||
    pathname?.startsWith('/notifications') ||
    pathname?.startsWith('/sf-import') ||
    pathname?.startsWith('/product-log') ||
    pathname?.includes('demo');

  // Proposal Builder is a full-viewport (h-screen) tool with its own embedded
  // header/back-link, same as the Object Manager page editor — it must be
  // excluded here too, otherwise its h-screen root gets nested under this
  // wrapper's own sticky header + h-dvh container and overflows, clipping
  // the top of its own toolbar (the Save button lives there).
  // /proposal-preview is the bare full-viewport react-pdf viewer opened in a
  // new tab from Proposal Builder's "Preview PDF" — it must render with zero
  // app chrome too.
  const shouldShowHeadbar = !pathname?.startsWith('/object-manager') && !pathname?.startsWith('/proposal-builder') && !pathname?.startsWith('/proposal-preview') && !pathname?.startsWith('/login') && !pathname?.startsWith('/signup');

  // Always refresh schema from the API on mount / when user changes.
  // The persisted Zustand cache provides a value for the very first paint
  // (avoiding a label flash), but we must still fetch the latest schema so
  // layout and field changes made in Object Manager are picked up on every
  // page load — not only when visiting the Object Manager itself.
  useEffect(() => {
    if (user) {
      loadSchema();
    }
  }, [loadSchema, user]);

  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

  // One-time cleanup: this app has never shipped a service worker (no
  // next-pwa config, no public/sw.js), but some browsers still have a stale
  // "workbox-*.js" service worker registered from a past deployment that did.
  // That orphaned worker intercepts fetches — including the long-lived SSE
  // notifications stream — and its caching strategy doesn't know how to
  // handle a streaming response, producing repeated
  // "no-response :: notifications/stream" console errors and net::ERR_FAILED
  // on the request itself. Unregister any leftover service worker so the
  // browser stops intercepting requests through it.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          if (key.startsWith('workbox')) caches.delete(key).catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const savedTabs = await getSetting<Array<{ name: string; href: string }>>('tabConfiguration');
      if (savedTabs && Array.isArray(savedTabs)) {
        setTabs(savedTabs.filter((t) => t.href !== '/summary'));
      } else {
        setTabs(defaultTabs);
      }

      if (schema?.objects) {
        const excludedObjects = new Set(['Home', 'TeamMember']);
        
        const builtInRoutes: Record<string, string> = {
          'Property': '/properties',
          'Contact': '/contacts',
          'Account': '/accounts',
          'Product': '/products',
          'Lead': '/leads',
          'Opportunity': '/opportunities',
          'Project': '/projects',
          'Service': '/service',
          'WorkOrder': '/workorders',
          'Quote': '/quotes',
          'Installation': '/installations',
        };
        
        const objectTabs = schema.objects
          .filter(obj => !excludedObjects.has(obj.apiName))
          .map(obj => ({
            name: obj.pluralLabel || obj.label,
            href: builtInRoutes[obj.apiName] || `/objects/${obj.apiName.toLowerCase()}`
          }));
        setAvailableObjects(objectTabs);
      }

      setIsLoaded(true);
    })();
  }, [schema, user]);

  const saveTabConfiguration = (newTabs: Array<{ name: string; href: string }>) => {
    setSetting('tabConfiguration', newTabs);
  };

  // Resolve the display name for a tab from the schema object labels
  // This ensures renamed objects show their updated label in the tab bar
  const resolveTabName = (tab: { name: string; href: string }): string => {
    if (!schema) return tab.name;
    const objectApiName = hrefToObjectMap[tab.href];
    if (!objectApiName) return tab.name;
    const obj = schema.objects.find(o => o.apiName === objectApiName);
    if (!obj) return tab.name;
    return obj.pluralLabel || obj.label || tab.name;
  };

  const handleResetToDefault = () => {
    const accessibleDefaults = defaultTabs.filter(canShowTab);
    setTabs(accessibleDefaults);
    saveTabConfiguration(accessibleDefaults);
  };

  const handleDragStart = (href: string) => {
    setDraggedTabHref(href);
    setLastDragTargetHref(null);
  };

  const handleDragOver = (e: React.DragEvent, targetHref: string) => {
    e.preventDefault();
    if (draggedTabHref === null || draggedTabHref === targetHref || lastDragTargetHref === targetHref) return;

    const newTabs = [...tabs];
    const draggedIndex = newTabs.findIndex((tab) => tab.href === draggedTabHref);
    const targetIndex = newTabs.findIndex((tab) => tab.href === targetHref);
    const draggedTab = newTabs[draggedIndex];
    if (!draggedTab || targetIndex < 0) return;
    newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    setTabs(newTabs);
    setLastDragTargetHref(targetHref);
    saveTabConfiguration(newTabs);
  };

  const handleDragEnd = () => {
    setDraggedTabHref(null);
    setLastDragTargetHref(null);
  };

  const handleAddTab = (tab: { name: string; href: string }) => {
    const newTabs = [...tabs, tab];
    setTabs(newTabs);
    saveTabConfiguration(newTabs);
    setShowAddTab(false);
  };

  const handleRemoveTab = (href: string) => {
    const newTabs = tabs.filter((tab) => tab.href !== href);
    setTabs(newTabs);
    saveTabConfiguration(newTabs);
  };

  const canCustomize = hasAppPermission('customizeApplication');

  const setupObjectTarget = useMemo(() => {
    if (recordSetup?.objectApiName && recordSetup.objectApiName !== 'Home') {
      return {
        objectApiName: recordSetup.objectApiName,
        pageLayoutId: recordSetup.pageLayoutId,
      };
    }
    return resolveListViewObjectSetup(pathname, schema?.objects, {
      profileId: user?.profileId ?? null,
    });
  }, [recordSetup, pathname, schema?.objects, user?.profileId]);

  const showEditObject =
    canCustomize && !!setupObjectTarget?.objectApiName && setupObjectTarget.objectApiName !== 'Home';
  const showEditPage =
    canCustomize && !!setupObjectTarget?.objectApiName && !!setupObjectTarget.pageLayoutId;

  if (!shouldShowHeadbar) {
    return <>{children}</>;
  }

  return (
    <div className="h-dvh flex flex-col bg-brand-light overflow-hidden">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="print:hidden bg-amber-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-between z-[60]">
          <span>You are logged in as <strong>{user?.name ?? user?.email}</strong></span>
          <button
            onClick={() => { returnToAdmin(); window.location.href = '/settings/users'; }}
            className="bg-white/20 hover:bg-white/30 text-white px-3 py-0.5 rounded-full transition-colors"
          >
            Return to Admin
          </button>
        </div>
      )}
      {/* Global Header — Salesforce-style navy bar */}
      <header className="print:hidden bg-brand-navy px-4 py-0 flex items-center justify-between sticky top-0 z-50 h-[48px] shadow-md">
        {/* Left: Logo + App Name */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group" title="Home">
            <div className="w-8 h-8 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
              <Image
                src="/tces-logo.png"
                alt="Tischler"
                width={32}
                height={32}
                priority
                className="object-contain"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
            <span className="text-white/90 text-sm font-semibold tracking-wide hidden sm:inline group-hover:text-white transition-colors">
              Tischler CRM
            </span>
          </Link>
        </div>

        {/* Center: Search (hidden on settings pages — settings has its own sidebar search) */}
        {!pathname?.startsWith('/settings') && (
          <div className="hidden sm:flex flex-1 max-w-xl mx-4">
            <UniversalSearch
              inputClassName="!bg-white/10 !border-white/20 !text-white !placeholder-white/50 focus:!bg-white/20 focus:!border-white/40 focus:!ring-white/30"
              iconClassName="!text-white/50"
            />
          </div>
        )}

        {/* Right: Utilities */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <BellPanel />
          <div className="relative">
            <button
              className="p-2 rounded-md hover:bg-white/10 transition-colors"
              title="Help"
              onClick={() => {
                setShowHelp(!showHelp);
                setShowSetupMenu(false);
              }}
            >
              <HelpCircle className="w-[18px] h-[18px] text-white/80" />
            </button>
            {showHelp && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Help & Support</h3>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setShowHelp(false); setShowSubmitTicket(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <LifeBuoy className="w-4 h-4 text-brand-navy flex-shrink-0" />
                    <span className="flex-1">Submit a ticket</span>
                  </button>
                  <button
                    onClick={() => { setShowHelp(false); setShowMyTickets(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Inbox className="w-4 h-4 text-brand-navy flex-shrink-0" />
                    <span className="flex-1">My tickets</span>
                  </button>
                  {hasAppPermission('manageSupportTickets') && (
                    <button
                      onClick={() => { setShowHelp(false); router.push('/support/tickets'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Users className="w-4 h-4 text-brand-navy flex-shrink-0" />
                      <span className="flex-1">All tickets</span>
                    </button>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setShowHelp(false); router.push('/settings'); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-brand-navy flex-shrink-0" />
                    <span className="flex-1">System settings</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              className="p-2 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Setup menu"
              aria-expanded={showSetupMenu}
              onClick={() => {
                setShowSetupMenu(!showSetupMenu);
                setShowHelp(false);
              }}
            >
              <Cog className="w-[18px] h-[18px] text-white/80" />
            </button>
            {showSetupMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[45] cursor-default bg-black/20"
                  aria-label="Close setup menu"
                  onClick={() => setShowSetupMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Setup Menu</h3>
                    <button
                      type="button"
                      onClick={() => setShowSetupMenu(false)}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSetupMenu(false);
                        router.push('/settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    >
                      <Settings className="w-4 h-4 text-brand-navy flex-shrink-0" />
                      <span className="flex-1">Settings</span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    </button>
                  </div>
                  {(showEditObject || showEditPage) && (
                    <>
                      <div className="border-t border-gray-200 my-1" />
                      <div className="py-1">
                        {showEditPage && setupObjectTarget?.pageLayoutId && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSetupMenu(false);
                              window.open(
                                `/object-manager/${encodeURIComponent(setupObjectTarget.objectApiName)}/page-editor/${encodeURIComponent(setupObjectTarget.pageLayoutId!)}?returnTo=${encodeURIComponent(pathname)}`,
                                '_blank',
                                'noopener,noreferrer'
                              );
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                          >
                            <Edit className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="flex-1">Edit Page</span>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          </button>
                        )}
                        {showEditObject && setupObjectTarget && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSetupMenu(false);
                              window.open(
                                `/object-manager/${encodeURIComponent(setupObjectTarget.objectApiName)}`,
                                '_blank',
                                'noopener,noreferrer'
                              );
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                          >
                            <Database className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="flex-1">Edit Object</span>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* User Menu */}
          {user && (
            <div ref={profileMenuRef} className="relative flex items-center ml-2 pl-2 border-l border-white/20">
              <input
                ref={profilePictureInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={event => { void handleProfilePictureChange(event.target.files?.[0]); }}
              />
              <button
                type="button"
                onClick={() => profilePictureInputRef.current?.click()}
                disabled={savingProfilePicture}
                aria-label="Change profile picture"
                title="Change profile picture"
                className="group relative mr-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-red text-xs font-bold text-white ring-1 ring-white/20 hover:ring-2 hover:ring-white/70 disabled:opacity-60"
              >
                {profilePicture
                  ? <Image src={profilePicture} alt="" width={32} height={32} unoptimized className="h-full w-full object-cover" />
                  : (user.name || user.email || '?').charAt(0).toUpperCase()}
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(open => !open);
                  setShowHelp(false);
                  setShowSetupMenu(false);
                }}
                aria-label="Open user profile menu"
                aria-expanded={showProfileMenu}
                className="min-w-0 rounded-md px-1 py-1 text-left hover:bg-white/10 transition-colors"
              >
                <span className="text-white/90 text-xs font-medium hidden md:inline max-w-[120px] truncate">
                  {user.name || user.email}
                </span>
              </button>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-white/80" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full z-[60] mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-800 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-red text-base font-bold text-white">
                      {profilePicture
                        ? <Image src={profilePicture} alt="Profile" width={48} height={48} unoptimized className="h-full w-full object-cover" />
                        : (user.name || user.email || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{user.name || user.email}</span>
                      <span className="block truncate text-xs text-gray-500">{user.email}</span>
                    </span>
                  </div>
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => profilePictureInputRef.current?.click()}
                      disabled={savingProfilePicture}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4 text-gray-500" />
                      {savingProfilePicture ? 'Saving picture…' : profilePicture ? 'Change profile picture' : 'Set profile picture'}
                    </button>
                    {profilePicture && (
                      <button
                        type="button"
                        onClick={() => { void handleRemoveProfilePicture(); }}
                        disabled={savingProfilePicture}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" /> Remove profile picture
                      </button>
                    )}
                    <p className="px-3 pt-2 text-[10px] text-gray-400">JPG, PNG, or WebP. Images are resized before saving.</p>
                    {profilePictureError && (
                      <p role="alert" className="mx-1 mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                        {profilePictureError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Tab Navigation Row — Salesforce-style app launcher tabs (hidden on settings pages) */}
      {isLoaded && !pathname?.startsWith('/settings') && (
        <nav className="print:hidden bg-white border-b border-gray-200 px-4 flex items-center justify-between sticky top-[48px] z-40 h-[40px]">
          <div className="flex items-center gap-0 overflow-x-auto flex-1 h-full scrollbar-hide">
            {filteredTabs.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative px-2.5 sm:px-4 h-full inline-flex items-center text-[12px] sm:text-[13px] font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'text-brand-navy'
                      : 'text-brand-dark/70 hover:text-brand-navy'
                  )}
                >
                  {resolveTabName(item)}
                  {/* Active indicator — brand red bottom bar */}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[3px] bg-brand-red rounded-t-full" />
                  )}
                </Link>
              );
            })}
          </div>
          <button
            onClick={() => setEditMode(true)}
            className="ml-2 p-1.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
            title="Edit Navigation"
          >
            <Edit3 className="w-3.5 h-3.5 text-brand-dark/50" />
          </button>
        </nav>
      )}

      {/* Content */}
      <div id="app-scroll-container" className={cn('flex-1', allowPageScroll ? 'overflow-y-auto' : 'overflow-hidden')}>
        {children}
      </div>

      {/* Edit Navigation Modal */}
      {editMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditMode(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-brand-dark">Edit Navigation Items</h2>
              <p className="text-sm text-brand-dark/60 mt-1">Reorder, add, or remove tabs for your account.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-brand-dark/60 uppercase tracking-wider">Items ({tabs.length})</h3>
                <button onClick={() => setShowAddTab(true)} className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-brand-dark/80">Add More Items</button>
              </div>
              <div className="space-y-1.5">
                {filteredTabs.map((item) => (
                  <div key={item.href} draggable onDragStart={() => handleDragStart(item.href)} onDragOver={(e) => handleDragOver(e, item.href)} onDragEnd={handleDragEnd} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 cursor-move group transition-colors">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="flex-1 text-sm font-medium text-brand-dark">{resolveTabName(item)}</span>
                    <button onClick={() => handleRemoveTab(item.href)} className="p-1 hover:bg-white rounded transition-colors opacity-0 group-hover:opacity-100" title="Remove"><X className="w-3.5 h-3.5 text-gray-500" /></button>
                  </div>
                ))}
              </div>
              <button onClick={handleResetToDefault} className="mt-4 text-xs font-medium text-brand-navy hover:text-brand-red transition-colors">Reset to Default</button>
            </div>
            <div className="border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
              <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-brand-dark/80">Cancel</button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm font-medium bg-brand-navy text-white rounded-md hover:bg-brand-navy-light transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Support ticket modal + drawer */}
      <SubmitTicketModal
        open={showSubmitTicket}
        onClose={() => setShowSubmitTicket(false)}
        onCreated={(ticket) => {
          setShowSubmitTicket(false);
          router.push(`/support/tickets/${ticket.id}`);
        }}
      />
      <MyTicketsDrawer open={showMyTickets} onClose={() => setShowMyTickets(false)} />

      {/* Add Tab Modal */}
      {showAddTab && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowAddTab(false)}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-brand-dark">Add Navigation Items</h3>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-1.5">
                {defaultTabs.filter(dt => canShowTab(dt) && !tabs.some(t => t.href === dt.href)).map((item) => (
                  <button key={item.href} onClick={() => handleAddTab(item)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brand-light rounded-md border border-gray-200 transition-colors text-left">
                    <span className="text-sm font-medium text-brand-dark">{item.name}</span>
                  </button>
                ))}
                {availableObjects
                  .filter(canShowTab)
                  .filter(obj => !tabs.some(t => t.href === obj.href))
                  .filter(obj => !defaultTabs.some(dt => dt.href === obj.href))
                  .map((obj) => (
                  <button key={obj.href} onClick={() => handleAddTab(obj)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brand-light rounded-md border border-gray-200 transition-colors text-left">
                    <span className="text-sm font-medium text-brand-dark">{obj.name}</span>
                    <span className="text-[10px] text-brand-gray ml-auto px-1.5 py-0.5 bg-gray-100 rounded">Custom</span>
                  </button>
                ))}
                {defaultTabs.filter(dt => canShowTab(dt) && !tabs.some(t => t.href === dt.href)).length === 0 &&
                 availableObjects.filter(obj => canShowTab(obj) && !tabs.some(t => t.href === obj.href) && !defaultTabs.some(dt => dt.href === obj.href)).length === 0 && (
                  <p className="text-brand-dark/50 text-sm py-8 text-center">All available items are already added.</p>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-3">
              <button onClick={() => setShowAddTab(false)} className="w-full px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-brand-dark/70">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  return (
    <RecordSetupProvider>
      <AppWrapperInner>{children}</AppWrapperInner>
    </RecordSetupProvider>
  );
}
