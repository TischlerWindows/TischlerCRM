'use client';

import { useState } from 'react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { Button } from '@/components/ui/button';
import { useSchemaStore } from '@/lib/schema-store';
import { Sparkles, FileText, Users } from 'lucide-react';

export default function DynamicFormDemo() {
  const [showContactCreate, setShowContactCreate] = useState(false);
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [showOpportunityCreate, setShowOpportunityCreate] = useState(false);
  const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);
  const { schema } = useSchemaStore();

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    setSubmittedData(data);
  };

  const contactObject = schema?.objects.find(obj => obj.apiName === 'Contact');
  const opportunityObject = schema?.objects.find(obj => obj.apiName === 'Opportunity');

  const contactCreateLayout = contactObject?.pageLayouts?.some(l => l.layoutType === 'create');
  const contactEditLayout = contactObject?.pageLayouts?.some(l => l.layoutType === 'edit');
  const opportunityCreateLayout = opportunityObject?.pageLayouts?.some(l => l.layoutType === 'create');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-12 h-12 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-900">Dynamic Form Renderer</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Demonstration of the dynamic form system that reads PageLayout configurations from Object Manager
            and renders fully-functional forms with validation, conditional logic, and all 24 field types.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-lg mb-2 text-indigo-600">Layout-Driven</h3>
            <p className="text-sm text-gray-600">
              Forms are generated from Page Editor configurations. Change the layout, and the form updates automatically.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-lg mb-2 text-indigo-600">24 Field Types</h3>
            <p className="text-sm text-gray-600">
              Supports all field types: Text, Number, Currency, Date, Picklist, Lookup, Address, Geolocation, and more.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-lg mb-2 text-indigo-600">Smart Validation</h3>
            <p className="text-sm text-gray-600">
              Built-in validation for required fields, email format, URL format, min/max values, and custom rules.
            </p>
          </div>
        </div>

        {/* Demo Buttons */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Try It Out</h2>
          
          <div className="space-y-6">
            {/* Contact Forms */}
            <div className="border-b pb-6">
              <div className="flex items-start gap-4 mb-4">
                <Users className="w-6 h-6 text-indigo-600 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Contact Forms</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {contactObject 
                      ? `Contact object has ${contactObject.fields.length} fields. Configure layouts in Object Manager → Contact → Page Editor.`
                      : 'Contact object not found in schema.'}
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => setShowContactCreate(true)}
                      disabled={!contactCreateLayout}
                    >
                      Create New Contact
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowContactEdit(true)}
                      disabled={!contactEditLayout}
                    >
                      Edit Contact (Demo)
                    </Button>
                  </div>
                  {!contactCreateLayout && contactObject && (
                    <p className="text-sm text-amber-600 mt-2">
                      ⚠️ No "New Record" layout configured. Go to Object Manager → Contact → Page Editor to create one.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Opportunity Forms */}
            <div>
              <div className="flex items-start gap-4">
                <FileText className="w-6 h-6 text-indigo-600 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Opportunity Forms</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {opportunityObject 
                      ? `Opportunity object has ${opportunityObject.fields.length} fields. Configure layouts in Object Manager → Opportunity → Page Editor.`
                      : 'Opportunity object not found in schema.'}
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => setShowOpportunityCreate(true)}
                      disabled={!opportunityCreateLayout}
                    >
                      Create New Opportunity
                    </Button>
                  </div>
                  {!opportunityCreateLayout && opportunityObject && (
                    <p className="text-sm text-amber-600 mt-2">
                      ⚠️ No "New Record" layout configured. Go to Object Manager → Opportunity → Page Editor to create one.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submitted Data Display */}
        {submittedData && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">✅ Form Submitted Successfully!</h3>
            <pre className="bg-white p-4 rounded border border-green-200 overflow-x-auto text-sm">
              {JSON.stringify(submittedData, null, 2)}
            </pre>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setSubmittedData(null)}
            >
              Clear
            </Button>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-8">
          <h3 className="font-semibold text-blue-900 mb-3">📋 How to Use</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Go to <strong>Object Manager</strong> and select an object (Contact or Opportunity)</li>
            <li>Click <strong>Page Editor</strong> in the sidebar</li>
            <li>Choose <strong>"New"</strong> mode to create a layout for new records</li>
            <li>Drag fields from the left palette onto the canvas</li>
            <li>Organize them into sections with 1, 2, or 3 columns</li>
            <li>Click <strong>Save Layout</strong></li>
            <li>Return to this page and click the "Create" button to see your form!</li>
          </ol>
        </div>
      </div>

      {/* Dialogs */}
      {contactObject && contactCreateLayout && (
        <DynamicFormDialog
          open={showContactCreate}
          onOpenChange={setShowContactCreate}
          objectApiName="Contact"
          layoutType="create"
          onSubmit={handleSubmit}
          title="Create New Contact"
        />
      )}

      {contactObject && contactEditLayout && (
        <DynamicFormDialog
          open={showContactEdit}
          onOpenChange={setShowContactEdit}
          objectApiName="Contact"
          layoutType="edit"
          recordData={{
            'Contact__firstName': 'John',
            'Contact__lastName': 'Smith',
            'Contact__email': 'john.smith@example.com',
            'Contact__phone': '555-1234',
          }}
          onSubmit={handleSubmit}
          title="Edit Contact"
        />
      )}

      {opportunityObject && opportunityCreateLayout && (
        <DynamicFormDialog
          open={showOpportunityCreate}
          onOpenChange={setShowOpportunityCreate}
          objectApiName="Opportunity"
          layoutType="create"
          onSubmit={handleSubmit}
          title="Create New Opportunity"
        />
      )}
    </div>
  );
}
