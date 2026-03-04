'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { HelpCircle, Cog, Edit3, GripVertical, X, LogOut, ChevronDown, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import UniversalSearch from '@/components/universal-search';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { useAuth } from '@/lib/auth-context';
import { useSchemaStore } from '@/lib/schema-store';

const defaultTabs = DEFAULT_TAB_ORDER;

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { schema, loadSchema } = useSchemaStore();
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  const allowPageScroll = pathname === '/' || 
    pathname?.includes('/[id]') || 
    pathname?.includes('/new') ||
    pathname?.startsWith('/contacts') ||
    pathname?.startsWith('/leads') ||
    pathname?.startsWith('/opportunities') ||
    pathname?.startsWith('/properties') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/deals') ||
    pathname?.startsWith('/projects') ||
    pathname?.startsWith('/installations') ||
    pathname?.startsWith('/products') ||
    pathname?.startsWith('/quotes') ||
    pathname?.startsWith('/reports') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/service') ||
    pathname?.startsWith('/summary') ||
    pathname?.startsWith('/dashboard') ||
    pathname?.includes('demo');

  const shouldShowHeadbar = !pathname?.startsWith('/object-manager') && !pathname?.startsWith('/login') && !pathname?.startsWith('/signup');

  useEffect(() => {
    if (!schema) {
      loadSchema();
    }
  }, [schema, loadSchema]);

  useEffect(() => {
    const savedTabsStr = localStorage.getItem('tabConfiguration');
    if (savedTabsStr) {
      try {
        const savedTabs = JSON.parse(savedTabsStr);
        setTabs(savedTabs);
      } catch (e) {
        setTabs(defaultTabs);
      }
    } else {
      setTabs(defaultTabs);
    }

    if (schema?.objects) {
      const excludedObjects = new Set(['Home']);
      
      const builtInRoutes: Record<string, string> = {
        'Property': '/properties',
        'Contact': '/contacts',
        'Account': '/accounts',
        'Product': '/products',
        'Lead': '/leads',
        'Deal': '/deals',
        'Project': '/projects',
        'Service': '/service',
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
    } else {
      const storedObjects = localStorage.getItem('customObjects');
      if (storedObjects) {
        try {
          const objects = JSON.parse(storedObjects);
          const objectTabs = objects.map((obj: any) => ({
            name: obj.label,
            href: `/objects/${obj.apiName.toLowerCase()}`
          }));
          setAvailableObjects(objectTabs);
        } catch (e) {
          console.error('Error loading custom objects:', e);
        }
      }
    }

    setIsLoaded(true);
  }, [schema]);

  const saveTabConfiguration = (newTabs: Array<{ name: string; href: string }>) => {
    localStorage.setItem('tabConfiguration', JSON.stringify(newTabs));
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

  if (!shouldShowHeadbar) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen flex flex-col bg-brand-light overflow-hidden">
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

        {/* Center: Search */}
        <div className="flex-1 max-w-xl mx-4">
          <UniversalSearch
            inputClassName="!bg-white/10 !border-white/20 !text-white !placeholder-white/50 focus:!bg-white/20 focus:!border-white/40 focus:!ring-white/30"
            iconClassName="!text-white/50"
          />
        </div>

        {/* Right: Utilities */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-2 rounded-md hover:bg-white/10 transition-colors"
            title="Notifications"
          >
            <Bell className="w-[18px] h-[18px] text-white/80" />
          </button>
          <button
            className="p-2 rounded-md hover:bg-white/10 transition-colors"
            title="Help"
          >
            <HelpCircle className="w-[18px] h-[18px] text-white/80" />
          </button>
          <Link
            href="/settings"
            className="p-2 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Settings"
          >
            <Cog className="w-[18px] h-[18px] text-white/80" />
          </Link>

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

      {/* Tab Navigation Row — Salesforce-style app launcher tabs */}
      {isLoaded && (
        <nav className="bg-white border-b border-gray-200 px-4 flex items-center justify-between sticky top-[48px] z-40 h-[40px]">
          <div className="flex items-center gap-0 overflow-x-auto flex-1 h-full scrollbar-hide">
            {tabs.map((item) => {
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
                  {item.name}
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
                    <span className="flex-1 text-sm font-medium text-brand-dark">{item.name}</span>
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
