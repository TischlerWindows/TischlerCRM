'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
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

interface Account {
  id: string;
  recordTypeId?: string;
  pageLayoutId?: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  status: 'Active' | 'Inactive';
  website: string;
  primaryEmail: string;
  secondaryEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  accountNotes: string;
  shippingAddress: string;
  billingAddress: string;
  accountOwner: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  [key: string]: any;
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { schema } = useSchemaStore();
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  // Get Account object from schema
  const accountObject = schema?.objects.find(obj => obj.apiName === 'Account');

  // Load account from localStorage
  useEffect(() => {
    const storedAccounts = localStorage.getItem('accounts');
    if (storedAccounts && params?.id) {
      const accounts: Account[] = JSON.parse(storedAccounts);
      const foundAccount = accounts.find(a => a.id === params.id as string);
      setAccount(foundAccount || null);
    }
    setLoading(false);
  }, [params?.id]);

  // Get the layout based on account's pageLayoutId or recordTypeId
  const getLayoutForAccount = () => {
    if (!account || !accountObject) return null;

    // First, try to use the layout stored on the record itself
    if (account.pageLayoutId) {
      const pageLayout = accountObject.pageLayouts?.find(l => l.id === account.pageLayoutId);
      if (pageLayout) {
        return pageLayout;
      }
    }

    // Fall back to the layout from the record type
    const recordTypeId = account.recordTypeId;
    const recordType = recordTypeId
      ? accountObject.recordTypes?.find(rt => rt.id === recordTypeId)
      : accountObject.recordTypes?.[0];

    // Get page layout from record type
    const pageLayoutId = recordType?.pageLayoutId;
    const pageLayout = pageLayoutId
      ? accountObject.pageLayouts?.find(l => l.id === pageLayoutId)
      : accountObject.pageLayouts?.[0];

    return pageLayout;
  };

  const pageLayout = getLayoutForAccount();

  // Get fields to display from the layout
  const getFieldsFromLayout = () => {
    if (!pageLayout || !accountObject) return [];

    const layoutFieldApiNames = new Set<string>();
    
    pageLayout.tabs?.forEach((tab: any) => {
      tab.sections?.forEach((section: any) => {
        section.fields?.forEach((field: any) => {
          layoutFieldApiNames.add(field.apiName);
        });
      });
    });

    // Only return fields that are in the layout
    if (layoutFieldApiNames.size === 0) return [];
    
    return (accountObject.fields || []).filter(field => 
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
    if (account) {
      const currentUserName = user?.name || user?.email || 'System';
      const updatedAccount: Account = {
        ...account,
        ...data,
        lastModifiedBy: currentUserName,
        lastModifiedAt: new Date().toISOString().split('T')[0]
      };
      
      const storedAccounts = localStorage.getItem('accounts');
      if (storedAccounts) {
        const accounts: Account[] = JSON.parse(storedAccounts);
        const updatedAccounts = accounts.map(a => 
          a.id === account.id ? updatedAccount : a
        );
        localStorage.setItem('accounts', JSON.stringify(updatedAccounts));
      }
      
      setAccount(updatedAccount);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this account?')) {
      const storedAccounts = localStorage.getItem('accounts');
      if (storedAccounts && account) {
        const accounts: Account[] = JSON.parse(storedAccounts);
        const updatedAccounts = accounts.filter(a => a.id !== account.id);
        localStorage.setItem('accounts', JSON.stringify(updatedAccounts));
      }
      router.push('/accounts');
    }
  };

  const convertAccountToFormData = (acc: Account): Record<string, any> => {
    const formData: Record<string, any> = {};
    Object.keys(acc).forEach(key => {
      formData[key] = acc[key];
    });
    return formData;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading account...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Not Found</h2>
          <p className="text-gray-600 mb-6">The account you're looking for doesn't exist.</p>
          <Link
            href="/accounts"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Accounts
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
            href="/accounts"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Accounts
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{account.accountNumber}</h1>
                  <p className="text-gray-600">
                    {account.accountName}
                    {account.accountType && <> ({account.accountType})</>}
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
                        // Normalize field name - remove object prefix like "Account__"
                        const normalizedFieldName = layoutField.apiName.replace(/^[^_]+__/, '');
                        
                        const fieldDef = accountObject?.fields?.find(
                          f => f.apiName === layoutField.apiName || f.apiName === normalizedFieldName
                        );
                        const value = account[normalizedFieldName] || account[layoutField.apiName];
                        
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

          {/* Fallback if no layout sections */}
          {(!pageLayout?.tabs || pageLayout.tabs.length === 0) && displayFields.length > 0 && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayFields.map((field, index) => (
                  <div key={index}>
                    <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatFieldValue(account[field.apiName], field.type) || '-'}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No layout configured */}
          {!pageLayout && (
            <div className="p-6 text-center text-gray-500">
              No page layout configured for this account's record type.
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
              <span className="text-gray-900">{account.createdBy}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Created:</span>
              <span className="text-gray-900">{account.createdAt}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Modified by:</span>
              <span className="text-gray-900">{account.lastModifiedBy}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Modified:</span>
              <span className="text-gray-900">{account.lastModifiedAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form Dialog */}
      {pageLayout && (
        <DynamicFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          objectApiName="Account"
          layoutType="edit"
          layoutId={pageLayout.id}
          recordData={convertAccountToFormData(account)}
          onSubmit={handleEditSubmit}
          title={`Edit ${account.accountNumber}`}
        />
      )}
    </div>
  );
}
