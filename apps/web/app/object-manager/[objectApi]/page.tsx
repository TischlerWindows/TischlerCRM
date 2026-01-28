'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Database, 
  ChevronLeft, 
  Settings,
  Grid3x3,
  Layout,
  Zap,
  Square,
  List,
  Search as SearchIcon,
  BarChart3,
  Shield,
  Code,
  GitBranch,
  CheckCircle2,
  Palette
} from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';
import PageEditor from './page-editor';
import FieldsRelationships from './fields-relationships';

const SIDEBAR_SECTIONS = [
  // Data Model
  { 
    id: 'fields', 
    label: 'Fields & Relationships', 
    icon: Grid3x3,
    description: 'Manage fields and relationships',
    category: 'Data Model',
    featured: true
  },
  { 
    id: 'record-types', 
    label: 'Record Types', 
    icon: GitBranch,
    description: 'Manage record types',
    category: 'Data Model'
  },
  { 
    id: 'field-sets', 
    label: 'Field Sets', 
    icon: List,
    description: 'Reusable field groups',
    category: 'Data Model'
  },
  { 
    id: 'lookup-filters', 
    label: 'Related Lookup Filters', 
    icon: SearchIcon,
    description: 'Configure lookup filters',
    category: 'Data Model'
  },
  
  // Layouts & UI
  { 
    id: 'page-editor', 
    label: 'Page Editor', 
    icon: Palette,
    description: 'Visual page editor',
    category: 'Layouts & UI',
    featured: true
  },
  { 
    id: 'compact-layouts', 
    label: 'Compact Layouts', 
    icon: Square,
    description: 'Compact view configuration',
    category: 'Layouts & UI'
  },
  { 
    id: 'conditional-formatting', 
    label: 'Conditional Field Formatting', 
    icon: Palette,
    description: 'Dynamic field styling',
    category: 'Layouts & UI'
  },
  
  // Automation
  { 
    id: 'workflow-triggers', 
    label: 'Workflow Triggers', 
    icon: Zap,
    description: 'Workflow automation',
    category: 'Automation'
  },
  { 
    id: 'functions', 
    label: 'Functions / Scripts', 
    icon: Code,
    description: 'Custom functions and scripts',
    category: 'Automation'
  },
  
  // Security & Access
  { 
    id: 'permissions', 
    label: 'Permissions', 
    icon: Shield,
    description: 'Manage permissions',
    category: 'Security & Access'
  },
  { 
    id: 'object-access', 
    label: 'Object Access', 
    icon: Shield,
    description: 'Object-level access control',
    category: 'Security & Access'
  },
  { 
    id: 'validation-rules', 
    label: 'Validation Rules', 
    icon: CheckCircle2,
    description: 'Field validation rules',
    category: 'Security & Access'
  },
];

export default function ObjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const objectApi = params.objectApi as string;
  const { schema, loading, setSelectedObject } = useSchemaStore();
  const [activeSection, setActiveSection] = useState('details');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSelectedObject(objectApi);
  }, [objectApi, setSelectedObject]);

  const object = schema?.objects.find(obj => obj.apiName === objectApi);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading object...</div>
      </div>
    );
  }

  if (!object) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Object Not Found</h2>
          <p className="text-gray-600 mb-4">The object "{objectApi}" does not exist.</p>
          <Link 
            href="/object-manager"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Object Manager
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-50',
          sidebarCollapsed ? 'w-16' : 'w-72'
        )}
      >
        {/* Header */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4">
          {!sidebarCollapsed && (
            <Link href="/object-manager" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Object Manager</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 hover:bg-gray-100 rounded"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Object Info */}
        {!sidebarCollapsed && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-gray-900 truncate">{object.label}</h2>
                <p className="text-xs text-gray-500 truncate">{object.apiName}</p>
              </div>
            </div>
            {object.description && (
              <p className="text-xs text-gray-600 line-clamp-2">{object.description}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="p-2 overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
          {!sidebarCollapsed && (
            <>
              {['Data Model', 'Layouts & UI', 'Automation', 'Security & Access'].map((category) => {
                const categoryItems = SIDEBAR_SECTIONS.filter(s => s.category === category);
                if (categoryItems.length === 0) return null;
                
                return (
                  <div key={category} className="mb-4">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {category}
                    </div>
                    {categoryItems.map((section) => {
                      const Icon = section.icon;
                      const isActive = activeSection === section.id;
                      
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveSection(section.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mb-1 text-left',
                            isActive
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'text-gray-700 hover:bg-gray-100',
                            section.featured && !isActive && 'font-medium'
                          )}
                        >
                          <Icon className={cn('w-5 h-5 flex-shrink-0', section.featured && 'text-indigo-600')} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm truncate">{section.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
          
          {sidebarCollapsed && (
            <>
              {SIDEBAR_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center justify-center p-2.5 rounded-lg transition-colors mb-1',
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                    title={section.label}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-72'
        )}
      >
        {/* Header Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {SIDEBAR_SECTIONS.find(s => s.id === activeSection)?.label}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {SIDEBAR_SECTIONS.find(s => s.id === activeSection)?.description}
              </p>
            </div>
            {activeSection !== 'details' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {object.fields.length} fields • {object.pageLayouts.length} layouts
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {activeSection === 'details' && (
            <div className="max-w-4xl">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Object Information</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Label</dt>
                    <dd className="text-sm text-gray-900 mt-1">{object.label}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">API Name</dt>
                    <dd className="text-sm font-mono text-gray-900 mt-1">{object.apiName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Fields</dt>
                    <dd className="text-sm text-gray-900 mt-1">{object.fields.length}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Record Types</dt>
                    <dd className="text-sm text-gray-900 mt-1">{object.recordTypes.length}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Page Layouts</dt>
                    <dd className="text-sm text-gray-900 mt-1">{object.pageLayouts.length}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Validation Rules</dt>
                    <dd className="text-sm text-gray-900 mt-1">{object.validationRules.length}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                    <dd className="text-sm text-gray-900 mt-1">{object.description || 'No description'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {new Date(object.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Modified</dt>
                    <dd className="text-sm text-gray-900 mt-1">
                      {new Date(object.updatedAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeSection === 'fields' && (
            <div className="px-6 py-6">
              <FieldsRelationships objectApiName={objectApi} />
            </div>
          )}

          {activeSection === 'page-editor' && (
            <div className="h-[calc(100vh-200px)]">
              <PageEditor objectApiName={objectApi} />
            </div>
          )}

          {activeSection !== 'details' && activeSection !== 'fields' && activeSection !== 'page-editor' && (
            <div className="max-w-6xl">
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {(() => {
                    const Icon = SIDEBAR_SECTIONS.find(s => s.id === activeSection)?.icon || Database;
                    return <Icon className="w-8 h-8 text-gray-400" />;
                  })()}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {SIDEBAR_SECTIONS.find(s => s.id === activeSection)?.label}
                </h3>
                <p className="text-gray-600 mb-6">
                  This section is under construction. It will allow you to{' '}
                  {SIDEBAR_SECTIONS.find(s => s.id === activeSection)?.description?.toLowerCase()}.
                </p>
                <div className="inline-flex items-center gap-2 text-sm text-indigo-600">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                  Coming soon
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
