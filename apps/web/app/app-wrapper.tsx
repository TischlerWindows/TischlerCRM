'use client';

import { useEffect, useState, useMemo } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UniversalSearch from '@/components/universal-search';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions-context';
import { useSchemaStore } from '@/lib/schema-store';
import { getSetting, setSetting } from '@/lib/preferences';
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showSetupMenu, setShowSetupMenu] = useState(false);
  const [showSubmitTicket, setShowSubmitTicket] = useState(false);
  const [showMyTickets, setShowMyTickets] = useState(false);

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
  const filteredTabs = useMemo(() => {
    return tabs.filter((tab) => {
      // Check object-level permissions
      const objectApiName = hrefToObjectMap[tab.href];
      if (objectApiName) return canAccess(objectApiName, 'read');

      // Check app-level permissions for Reports/Dashboards
      const appPerm = hrefToAppPermMap[tab.href];
      if (appPerm) return hasAppPermission(appPerm as any);

      // Non-object, non-restricted tabs (Settings, etc.) are always shown
      return true;
    });
  }, [tabs, canAccess, hasAppPermission, schema]);
  const allowPageScroll = pathname === '/' || 
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
    pathname?.includes('demo');

  const shouldShowHeadbar = !pathname?.startsWith('/object-manager') && !pathname?.startsWith('/login') && !pathname?.startsWith('/signup');

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

  useEffect(() => {
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
  }, [schema]);

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
    setTabs(defaultTabs);
    saveTabConfiguration(defaultTabs);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTabs = [...tabs];
    const draggedTab = newTabs[draggedIndex];
    if (!draggedTab) return;
    newTabs.splice(draggedIndex, 1);
    newTabs.splice(index, 0, draggedTab);

    setTabs(newTabs);
    setDraggedIndex(index);
    saveTabConfiguration(newTabs);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleAddTab = (tab: { name: string; href: string }) => {
    const newTabs = [...tabs, tab];
    setTabs(newTabs);
    saveTabConfiguration(newTabs);
    setShowAddTab(false);
  };

  const handleRemoveTab = (index: number) => {
    const newTabs = tabs.filter((_, i) => i !== index);
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
    return resolveListViewObjectSetup(pathname, schema?.objects);
  }, [recordSetup, pathname, schema?.objects]);

  const showEditObject =
    canCustomize && !!setupObjectTarget?.objectApiName && setupObjectTarget.objectApiName !== 'Home';
  const showEditPage =
    canCustomize && !!setupObjectTarget?.objectApiName && !!setupObjectTarget.pageLayoutId;

  if (!shouldShowHeadbar) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen flex flex-col bg-brand-light overflow-hidden">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-between z-[60]">
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
      <header className="bg-brand-navy px-4 py-0 flex items-center justify-between sticky top-0 z-50 h-[48px] shadow-md">
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
          <div className="flex-1 max-w-xl mx-4">
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
                              router.push(
                                `/object-manager/${encodeURIComponent(setupObjectTarget.objectApiName)}/page-editor/${encodeURIComponent(setupObjectTarget.pageLayoutId!)}?returnTo=${encodeURIComponent(pathname)}`
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
                              router.push(
                                `/object-manager/${encodeURIComponent(setupObjectTarget.objectApiName)}`
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
            <div className="flex items-center ml-2 pl-2 border-l border-white/20">
              <div className="w-7 h-7 rounded-full bg-brand-red flex items-center justify-center text-white text-xs font-bold mr-2">
                {(user.name || user.email || '?').charAt(0).toUpperCase()}
              </div>
              <span className="text-white/90 text-xs font-medium mr-1 hidden md:inline max-w-[120px] truncate">
                {user.name || user.email}
              </span>
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
            </div>
          )}
        </div>
      </header>

      {/* Tab Navigation Row — Salesforce-style app launcher tabs (hidden on settings pages) */}
      {isLoaded && !pathname?.startsWith('/settings') && (
        <nav className="bg-white border-b border-gray-200 px-4 flex items-center justify-between sticky top-[48px] z-40 h-[40px]">
          <div className="flex items-center gap-0 overflow-x-auto flex-1 h-full scrollbar-hide">
            {filteredTabs.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative px-4 h-full inline-flex items-center text-[13px] font-medium whitespace-nowrap transition-colors',
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
      <div className={cn('flex-1', allowPageScroll ? 'overflow-y-auto' : 'overflow-hidden')}>
        {children}
      </div>

      {/* Edit Navigation Modal */}
      {editMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditMode(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-brand-dark">Edit Navigation Items</h2>
              <p className="text-sm text-brand-dark/60 mt-1">Reorder, add, or remove navigation tabs.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-brand-dark/60 uppercase tracking-wider">Items ({tabs.length})</h3>
                <button onClick={() => setShowAddTab(true)} className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-brand-dark/80">Add More Items</button>
              </div>
              <div className="space-y-1.5">
                {tabs.map((item, index) => (
                  <div key={item.name} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDragEnd={handleDragEnd} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 cursor-move group transition-colors">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="flex-1 text-sm font-medium text-brand-dark">{resolveTabName(item)}</span>
                    <button onClick={() => handleRemoveTab(index)} className="p-1 hover:bg-white rounded transition-colors opacity-0 group-hover:opacity-100" title="Remove"><X className="w-3.5 h-3.5 text-gray-500" /></button>
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
                {defaultTabs.filter(dt => !tabs.some(t => t.href === dt.href)).map((item) => (
                  <button key={item.href} onClick={() => handleAddTab(item)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brand-light rounded-md border border-gray-200 transition-colors text-left">
                    <span className="text-sm font-medium text-brand-dark">{item.name}</span>
                  </button>
                ))}
                {availableObjects
                  .filter(obj => !tabs.some(t => t.href === obj.href))
                  .filter(obj => !defaultTabs.some(dt => dt.href === obj.href))
                  .map((obj) => (
                  <button key={obj.href} onClick={() => handleAddTab(obj)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brand-light rounded-md border border-gray-200 transition-colors text-left">
                    <span className="text-sm font-medium text-brand-dark">{obj.name}</span>
                    <span className="text-[10px] text-brand-gray ml-auto px-1.5 py-0.5 bg-gray-100 rounded">Custom</span>
                  </button>
                ))}
                {defaultTabs.filter(dt => !tabs.some(t => t.href === dt.href)).length === 0 && 
                 availableObjects.filter(obj => !tabs.some(t => t.href === obj.href) && !defaultTabs.some(dt => dt.href === obj.href)).length === 0 && (
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
