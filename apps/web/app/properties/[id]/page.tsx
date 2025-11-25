'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  MapPin, 
  ArrowLeft, 
  Edit, 
  Trash2,
  Calendar,
  User,
  Clock,
  Layout
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';

interface Property {
  id: string;
  propertyNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  status: 'Active' | 'Inactive';
  contacts: string[];
  accounts: string[];
  lastActivity: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  sharepointFolder?: string;
  [key: string]: any; // Allow dynamic fields
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { schema } = useSchemaStore();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);

  const propertyObject = schema?.objects.find(obj => obj.apiName === 'Property');
  const pageLayouts = propertyObject?.pageLayouts || [];
  const hasPageLayout = pageLayouts.length > 0;

  useEffect(() => {
    // Load from localStorage
    const storedProperties = localStorage.getItem('properties');
    if (storedProperties) {
      const properties: Property[] = JSON.parse(storedProperties);
      const foundProperty = properties.find(p => p.id === params.id);
      setProperty(foundProperty || null);
    } else {
      setProperty(null);
    }
    setLoading(false);
  }, [params.id]);

  const handleEdit = () => {
    if (!hasPageLayout) {
      alert('No page layouts configured. Please create a page layout in the Object Manager.');
      return;
    }

    if (pageLayouts.length === 1 && pageLayouts[0]) {
      setSelectedLayoutId(pageLayouts[0].id);
      setShowEditForm(true);
    } else {
      setShowLayoutSelector(true);
    }
  };

  const handleEditSubmit = (data: Record<string, any>) => {
    // Update property with new data
    if (property) {
      const updatedProperty: Property = {
        ...property,
        ...data,
        lastModifiedBy: 'Development User',
        lastModifiedAt: new Date().toISOString().split('T')[0] || property.lastModifiedAt
      };
      
      // Update in localStorage
      const storedProperties = localStorage.getItem('properties');
      if (storedProperties) {
        const properties: Property[] = JSON.parse(storedProperties);
        const updatedProperties = properties.map(p => 
          p.id === property.id ? updatedProperty : p
        );
        localStorage.setItem('properties', JSON.stringify(updatedProperties));
      }
      
      setProperty(updatedProperty);
      console.log('Property updated:', updatedProperty);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this property?')) {
      // Delete from localStorage
      const storedProperties = localStorage.getItem('properties');
      if (storedProperties && property) {
        const properties: Property[] = JSON.parse(storedProperties);
        const updatedProperties = properties.filter(p => p.id !== property.id);
        localStorage.setItem('properties', JSON.stringify(updatedProperties));
      }
      
      // Navigate back to properties list
      router.push('/properties');
    }
  };

  const convertPropertyToFormData = (prop: Property): Record<string, any> => {
    const formData: Record<string, any> = {};
    
    // Map all property fields to form data
    Object.keys(prop).forEach(key => {
      formData[key] = prop[key];
    });
    
    return formData;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading property...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Property Not Found</h2>
          <p className="text-gray-600 mb-6">The property you're looking for doesn't exist.</p>
          <Link
            href="/properties"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Link>
        </div>
      </div>
    );
  }

  // Get all fields from the property object to display dynamically
  const displayFields = propertyObject?.fields || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/properties"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Properties
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{property.propertyNumber}</h1>
                  <p className="text-gray-600">{property.address}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleEdit}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dynamic Field Display */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Property Information</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {displayFields
                    .filter(field => {
                      // Filter out system fields and fields that should be in sidebar
                      const excludeFields = ['id', 'createdBy', 'createdAt', 'lastModifiedBy', 'lastModifiedAt'];
                      return !excludeFields.includes(field.apiName);
                    })
                    .map(field => {
                      const value = property[field.apiName];
                      const displayValue = Array.isArray(value) 
                        ? value.join(', ') 
                        : typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : value || '-';

                      return (
                        <div key={field.apiName}>
                          <dt className="text-sm font-medium text-gray-500 mb-1">{field.label}</dt>
                          <dd className="text-sm text-gray-900">
                            {field.apiName === 'status' ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                value === 'Active' 
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {displayValue}
                              </span>
                            ) : (
                              displayValue
                            )}
                          </dd>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Related Records Section */}
            {(property.contacts.length > 0 || property.accounts.length > 0) && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Related Records</h2>
                </div>
                <div className="p-6 space-y-4">
                  {property.contacts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Contacts</h3>
                      <div className="space-y-1">
                        {property.contacts.map((contact, idx) => (
                          <div key={idx} className="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer">
                            {contact}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {property.accounts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Accounts</h3>
                      <div className="space-y-1">
                        {property.accounts.map((account, idx) => (
                          <div key={idx} className="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer">
                            {account}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* System Information */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">System Information</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">Created By</div>
                    <div className="text-sm text-gray-900">{property.createdBy}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(property.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">Last Modified By</div>
                    <div className="text-sm text-gray-900">{property.lastModifiedBy}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(property.lastModifiedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">Last Activity</div>
                    <div className="text-sm text-gray-900">
                      {new Date(property.lastActivity).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layout Selector Dialog */}
      {showLayoutSelector && pageLayouts.length > 1 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Select a Layout</h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose which form layout to use for editing this property
              </p>
            </div>
            <div className="p-6 space-y-3">
              {pageLayouts.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => {
                    setSelectedLayoutId(layout.id);
                    setShowLayoutSelector(false);
                    setShowEditForm(true);
                  }}
                  className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Layout className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{layout.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {layout.tabs.length} {layout.tabs.length === 1 ? 'tab' : 'tabs'} • {' '}
                      {layout.tabs.reduce((acc, tab) => acc + tab.sections.length, 0)} sections
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowLayoutSelector(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Dialog */}
      {hasPageLayout && selectedLayoutId && (
        <DynamicFormDialog
          open={showEditForm}
          onOpenChange={(open) => {
            setShowEditForm(open);
            if (!open) setSelectedLayoutId(null);
          }}
          objectApiName="Property"
          layoutType="edit"
          layoutId={selectedLayoutId}
          recordData={convertPropertyToFormData(property)}
          onSubmit={handleEditSubmit}
          title={`Edit ${property.propertyNumber}`}
        />
      )}
    </div>
  );
}
