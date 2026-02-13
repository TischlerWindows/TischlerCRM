'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Folder, 
  ArrowLeft, 
  Edit, 
  Trash2,
  Calendar,
  User,
  Clock
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { useAuth } from '@/lib/auth-context';
import { formatFieldValue } from '@/lib/utils';

interface Project {
  id: string;
  recordTypeId?: string;
  pageLayoutId?: string;
  projectNumber: string;
  projectName: string;
  status: string;
  manager: string;
  accountName: string;
  startDate: string;
  endDate: string;
  budget: number;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  description?: string;
  isFavorite?: boolean;
  [key: string]: any;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { schema } = useSchemaStore();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  // Get Project object from schema
  const projectObject = schema?.objects.find(obj => obj.apiName === 'Project');

  // Load project from localStorage
  useEffect(() => {
    const storedProjects = localStorage.getItem('projects');
    if (storedProjects && params?.id) {
      const projects: Project[] = JSON.parse(storedProjects);
      const foundProject = projects.find(p => p.id === params.id as string);
      setProject(foundProject || null);
    }
    setLoading(false);
  }, [params?.id]);

  // Get the layout based on project's pageLayoutId or recordTypeId
  const getLayoutForProject = () => {
    if (!project || !projectObject) return null;

    if (project.pageLayoutId) {
      const pageLayout = projectObject.pageLayouts?.find(l => l.id === project.pageLayoutId);
      if (pageLayout) {
        return pageLayout;
      }
    }

    const recordTypeId = project.recordTypeId;
    const recordType = recordTypeId
      ? projectObject.recordTypes?.find(rt => rt.id === recordTypeId)
      : projectObject.recordTypes?.[0];

    const pageLayoutId = recordType?.pageLayoutId;
    const pageLayout = pageLayoutId
      ? projectObject.pageLayouts?.find(l => l.id === pageLayoutId)
      : projectObject.pageLayouts?.[0];

    return pageLayout;
  };

  const pageLayout = getLayoutForProject();

  const getFieldsFromLayout = () => {
    if (!pageLayout || !projectObject) return [];

    const layoutFieldApiNames = new Set<string>();
    
    pageLayout.tabs?.forEach((tab: any) => {
      tab.sections?.forEach((section: any) => {
        section.fields?.forEach((field: any) => {
          layoutFieldApiNames.add(field.apiName);
        });
      });
    });

    if (layoutFieldApiNames.size === 0) return [];
    
    return (projectObject.fields || []).filter(field => 
      layoutFieldApiNames.has(field.apiName)
    );
  };

  const displayFields = getFieldsFromLayout();

  const handleEdit = () => {
    if (!pageLayout) {
      alert('No page layout configured for this record type.');
      return;
    }
    setShowEditForm(true);
  };

  const handleEditSubmit = (data: Record<string, any>) => {
    if (project) {
      const currentUserName = user?.name || user?.email || 'System';
      const updatedProject: Project = {
        ...project,
        ...data,
        lastModifiedBy: currentUserName,
        lastModifiedAt: new Date().toISOString().split('T')[0]
      };
      
      const storedProjects = localStorage.getItem('projects');
      if (storedProjects) {
        const projects: Project[] = JSON.parse(storedProjects);
        const updatedProjects = projects.map(p => 
          p.id === project.id ? updatedProject : p
        );
        localStorage.setItem('projects', JSON.stringify(updatedProjects));
      }
      
      setProject(updatedProject);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this project?')) {
      const storedProjects = localStorage.getItem('projects');
      if (storedProjects && project) {
        const projects: Project[] = JSON.parse(storedProjects);
        const updatedProjects = projects.filter(p => p.id !== project.id);
        localStorage.setItem('projects', JSON.stringify(updatedProjects));
      }
      router.push('/projects');
    }
  };

  const convertProjectToFormData = (p: Project): Record<string, any> => {
    const formData: Record<string, any> = {};
    Object.keys(p).forEach(key => {
      formData[key] = p[key];
    });
    return formData;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Not Found</h2>
          <p className="text-gray-600 mb-6">The project you're looking for doesn't exist.</p>
          <Link
            href="/projects"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/projects"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Projects
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Folder className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{project.projectNumber}</h1>
                  <p className="text-gray-600">
                    {project.projectName}
                    {project.status && <> - {project.status}</>}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleEdit}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Layout Info */}
        {pageLayout && (
          <div className="mb-4 text-sm text-gray-500">
            Using layout: <span className="font-medium">{pageLayout.name}</span>
            {displayFields.length > 0 && (
              <span className="ml-2">({displayFields.length} fields)</span>
            )}
          </div>
        )}

        {/* Content based on layout */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {pageLayout?.tabs?.map((tab: any, tabIndex: number) => (
            <div key={tabIndex}>
              {tab.sections?.map((section: any, sectionIndex: number) => (
                <div key={sectionIndex} className="border-b border-gray-200 last:border-b-0">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900">{section.name}</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {section.fields?.map((layoutField: any, fieldIndex: number) => {
                        const normalizedFieldName = layoutField.apiName.replace(/^[^_]+__/, '');
                        
                        const fieldDef = projectObject?.fields?.find(
                          f => f.apiName === layoutField.apiName || f.apiName === normalizedFieldName
                        );
                        const value = project[normalizedFieldName] || project[layoutField.apiName];
                        
                        return (
                          <div key={fieldIndex}>
                            <dt className="text-sm font-medium text-gray-500">
                              {fieldDef?.label || layoutField.apiName}
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {formatFieldValue(value, fieldDef?.type) || '-'}
                            </dd>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {(!pageLayout?.tabs || pageLayout.tabs.length === 0) && displayFields.length > 0 && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayFields.map((field, index) => (
                  <div key={index}>
                    <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatFieldValue(project[field.apiName], field.type) || '-'}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!pageLayout && (
            <div className="p-6 text-center text-gray-500">
              No page layout configured for this project's record type.
            </div>
          )}
        </div>

        {/* System Info */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium text-gray-900 mb-4">System Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Created by:</span>
              <span className="text-gray-900">{project.createdBy}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Created:</span>
              <span className="text-gray-900">{project.createdAt}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Modified by:</span>
              <span className="text-gray-900">{project.lastModifiedBy}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Modified:</span>
              <span className="text-gray-900">{project.lastModifiedAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form Dialog */}
      {pageLayout && (
        <DynamicFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          objectApiName="Project"
          layoutType="edit"
          layoutId={pageLayout.id}
          recordData={convertProjectToFormData(project)}
          onSubmit={handleEditSubmit}
          title={`Edit ${project.projectNumber}`}
        />
      )}
    </div>
  );
}
