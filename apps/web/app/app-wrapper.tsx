'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { HelpCircle, Cog, Edit3, GripVertical, X, LogOut } from 'lucide-react';
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

  // Check if we should show the headbar (exclude only object-manager pages and auth pages)
  const shouldShowHeadbar = !pathname?.startsWith('/object-manager') && !pathname?.startsWith('/login') && !pathname?.startsWith('/signup');

  useEffect(() => {
    // Load schema if not already loaded
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

    // Load available objects from schema
    if (schema?.objects) {
      // Exclude system objects like 'Home'
      const excludedObjects = new Set(['Home']);
      
      // Built-in objects that have dedicated routes
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
          // Use built-in route if available, otherwise use /objects/[slug]
          href: builtInRoutes[obj.apiName] || `/objects/${obj.apiName.toLowerCase()}`
        }));
      setAvailableObjects(objectTabs);
    } else {
      // Fallback to old customObjects storage
      const storedObjects = localStorage.getItem('customObjects');
      if (storedObjects) {
        try {
          const objects = JSON.parse(storedObjects);
          const objectTabs = objects.map((obj: any) => ({
            name: obj.label,
            // Custom objects always use /objects/[slug]
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
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="bg-[#9f9fa2] border-b border-black px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/tces-logo.png"
              alt="TCES"
              width={40}
              height={40}
              priority
            />
          </Link>
        </div>
        <div className="flex-1 max-w-2xl mx-8">
          <UniversalSearch inputClassName={allowPageScroll ? 'bg-white' : ''} />
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-black/5 rounded-lg transition-colors">
            <HelpCircle className="w-5 h-5 text-[#151f6d]" />
          </button>
          <Link
            href="/settings"
            className="p-2 hover:bg-black/5 rounded-lg transition-colors"
            aria-label="Settings"
          >
            <Cog className="w-5 h-5 text-[#151f6d]" />
          </Link>
          {user && (
            <>
              <div className="text-sm text-gray-600 px-3 py-1">
                {user.name || user.email}
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="p-2 hover:bg-black/5 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-[#151f6d]" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation Row */}
      {isLoaded && (
        <div className="bg-[#f5f5f4] border-b border-black px-6 flex items-center justify-between sticky top-[60px] z-40">
          <div className="flex items-center gap-1 overflow-x-auto flex-1">
            {tabs.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors text-[#151f6d]',
                    isActive
                      ? 'border-[#151f6d]'
                      : 'border-transparent hover:text-[#da291c] hover:border-[#da291c]'
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
          <button
            onClick={() => setEditMode(true)}
            className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Edit Navigation"
          >
            <Edit3 className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className={cn('flex-1', allowPageScroll ? 'overflow-y-auto' : 'overflow-hidden')}>
        {children}
      </div>

      {/* Edit Navigation Modal */}
      {editMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditMode(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900">Edit Tischler App App Navigation Items</h2>
              <p className="text-sm text-gray-600 mt-1">Personalize your nav bar for this app. Reorder items, and rename or remove items you've added.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700 uppercase">Navigation Items ({tabs.length})</h3>
                <button onClick={() => setShowAddTab(true)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Add More Items</button>
              </div>
              <div className="space-y-2">
                {tabs.map((item, index) => (
                  <div key={item.name} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDragEnd={handleDragEnd} className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 cursor-move group">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                    <span className="flex-1 text-sm font-medium text-gray-900">{item.name}</span>
                    <button onClick={() => handleRemoveTab(index)} className="p-1 hover:bg-white rounded transition-colors opacity-0 group-hover:opacity-100" title="Remove"><X className="w-4 h-4 text-gray-500" /></button>
                  </div>
                ))}
              </div>
              <button onClick={handleResetToDefault} className="mt-6 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">Reset Navigation to Default</button>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setEditMode(false)} className="px-6 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => setEditMode(false)} className="px-6 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tab Modal */}
      {showAddTab && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowAddTab(false)}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Navigation Items</h3>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {/* Show default tabs that aren't already in the nav */}
                {defaultTabs.filter(dt => !tabs.some(t => t.href === dt.href)).map((item) => (
                  <button key={item.href} onClick={() => handleAddTab(item)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded border border-gray-200 transition-colors text-left">
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  </button>
                ))}
                {/* Show schema objects that aren't in tabs AND aren't in defaultTabs */}
                {availableObjects
                  .filter(obj => !tabs.some(t => t.href === obj.href))
                  .filter(obj => !defaultTabs.some(dt => dt.href === obj.href))
                  .map((obj) => (
                  <button key={obj.href} onClick={() => handleAddTab(obj)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded border border-gray-200 transition-colors text-left">
                    <span className="text-sm font-medium text-gray-900">{obj.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">Custom Object</span>
                  </button>
                ))}
                {defaultTabs.filter(dt => !tabs.some(t => t.href === dt.href)).length === 0 && 
                 availableObjects.filter(obj => !tabs.some(t => t.href === obj.href) && !defaultTabs.some(dt => dt.href === obj.href)).length === 0 && (
                  <p className="text-gray-500 text-sm py-8 text-center">All available items are already added to navigation.</p>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4">
              <button onClick={() => setShowAddTab(false)} className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
