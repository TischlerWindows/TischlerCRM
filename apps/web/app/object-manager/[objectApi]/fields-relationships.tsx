'use client';

import React, { useState } from 'react';
import { useSchemaStore } from '@/lib/schema-store';
import { FieldDef, FieldType } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Info,
  Hash,
  Calculator,
  TrendingUp,
  Link as LinkIcon,
  ExternalLink,
  CheckSquare,
  DollarSign,
  Calendar,
  Mail,
  MapPin,
  Percent,
  Phone,
  List,
  FileText,
  Lock,
  Eye,
  Clock,
  Globe,
  X,
  Save,
  AlertCircle,
} from 'lucide-react';
interface FieldsRelationshipsProps {
  objectApiName: string;
}

interface FieldTypeOption {
  value: FieldType;
  label: string;
  description: string;
  category: 'None' | 'System' | 'Relationship' | 'Standard';
  icon: any;
}

const FIELD_TYPES: FieldTypeOption[] = [
  { value: 'Text', label: 'None Selected', description: 'Select one of the data types below.', category: 'None', icon: null },
  
  // System
  { value: 'AutoNumber', label: 'Auto Number', description: 'A system-generated sequence number that uses a display format you define. The number is automatically incremented for each new record.', category: 'System', icon: Hash },
  { value: 'Formula', label: 'Formula', description: 'A read-only field that derives its value from a formula expression you define. The formula field is updated when any of the source fields change.', category: 'System', icon: Calculator },
  { value: 'RollupSummary', label: 'Roll-Up Summary', description: 'A read-only field that displays the sum, minimum, or maximum value of a field in a related list or the record count of all records listed in a related list.', category: 'System', icon: TrendingUp },
  
  // Relationship
  { value: 'Lookup', label: 'Lookup Relationship', description: 'Creates a relationship that links this object to another object. The relationship field allows users to click on a lookup icon to select a value from a popup list. The other object is the source of the values in the list.', category: 'Relationship', icon: LinkIcon },
  { value: 'ExternalLookup', label: 'External Lookup Relationship', description: 'Creates a relationship that links this object to an external object whose data is stored outside the Salesforce org.', category: 'Relationship', icon: ExternalLink },
  
  // Standard
  { value: 'Checkbox', label: 'Checkbox', description: 'Allows users to select a True (checked) or False (unchecked) value.', category: 'Standard', icon: CheckSquare },
  { value: 'Currency', label: 'Currency', description: 'Allows users to enter a dollar or other currency amount and automatically formats the field as a currency amount. This can be useful if you export data to Excel or another spreadsheet.', category: 'Standard', icon: DollarSign },
  { value: 'Date', label: 'Date', description: 'Allows users to enter a date or pick a date from a popup calendar.', category: 'Standard', icon: Calendar },
  { value: 'DateTime', label: 'Date/Time', description: 'Allows users to enter a date and time, or pick a date from a popup calendar. When users click a date in the pop-up, that date and the current time are entered into the Date/Time field.', category: 'Standard', icon: Calendar },
  { value: 'Email', label: 'Email', description: 'Allows users to enter an email address, which is validated to ensure proper format. If this field is specified for a contact or lead, users can choose the address when clicking Send an Email. Note that custom email addresses cannot be used for mass emails.', category: 'Standard', icon: Mail },
  { value: 'Geolocation', label: 'Geolocation', description: 'Allows users to define locations. Includes latitude and longitude components, and can be used to calculate distance.', category: 'Standard', icon: MapPin },
  { value: 'Number', label: 'Number', description: 'Allows users to enter any number. Leading zeros are removed.', category: 'Standard', icon: Hash },
  { value: 'Percent', label: 'Percent', description: 'Allows users to enter a percentage number, for example, \'10\' and automatically adds the percent sign to the number.', category: 'Standard', icon: Percent },
  { value: 'Phone', label: 'Phone', description: 'Allows users to enter any phone number. Automatically formats it as a phone number.', category: 'Standard', icon: Phone },
  { value: 'Picklist', label: 'Picklist', description: 'Allows users to select a value from a list you define.', category: 'Standard', icon: List },
  { value: 'MultiPicklist', label: 'Picklist (Multi-Select)', description: 'Allows users to select multiple values from a list you define.', category: 'Standard', icon: List },
  { value: 'Text', label: 'Text', description: 'Allows users to enter any combination of letters and numbers.', category: 'Standard', icon: FileText },
  { value: 'TextArea', label: 'Text Area', description: 'Allows users to enter up to 255 characters on separate lines.', category: 'Standard', icon: FileText },
  { value: 'LongTextArea', label: 'Text Area (Long)', description: 'Allows users to enter up to 131,072 characters on separate lines.', category: 'Standard', icon: FileText },
  { value: 'RichTextArea', label: 'Text Area (Rich)', description: 'Allows users to enter formatted text, add images and links. Up to 131,072 characters on separate lines.', category: 'Standard', icon: FileText },
  { value: 'EncryptedText', label: 'Text (Encrypted)', description: 'Allows users to enter any combination of letters and numbers and store them in encrypted form.', category: 'Standard', icon: Lock },
  { value: 'Time', label: 'Time', description: 'Allows users to enter a local time. For example, "2:40 PM", "14:40", "14:40:00", and "14:40:50.600" are all valid times for this field.', category: 'Standard', icon: Clock },
  { value: 'URL', label: 'URL', description: 'Allows users to enter any valid website address. When users click on the field, the URL will open in a separate browser window.', category: 'Standard', icon: Globe },
  { value: 'Address', label: 'Address', description: 'Allows users to enter a street, city, state/province, zip/postal code, and country, or to search for an address with an external tool. When a user selects an address using the tool, the street, city, state/province, zip/postal code, and country are populated.', category: 'Standard', icon: MapPin },
];

export default function FieldsRelationships({ objectApiName }: FieldsRelationshipsProps) {
  const { schema, addField, updateField, deleteField } = useSchemaStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);
  const [selectedType, setSelectedType] = useState<FieldType | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [showVisibilityEditor, setShowVisibilityEditor] = useState(false);
  
  const [formData, setFormData] = useState({
    label: '',
    apiName: '',
    type: 'Text' as FieldType,
    required: false,
    unique: false,
    helpText: '',
    defaultValue: '',
    maxLength: 255,
    precision: 18,
    scale: 2,
    displayFormat: '',
    formulaExpr: '',
    picklistValues: [] as string[],
    relationshipName: '',
    lookupObject: '',
  });

  const object = schema?.objects.find(o => o.apiName === objectApiName);
  let fields = object?.fields || [];

  // Add hardcoded Name field for Contact objects
  if (objectApiName === 'Contact') {
    const nameField = {
      id: 'hardcoded-name-field',
      apiName: 'Contact__name',
      label: 'Name',
      type: 'Text' as FieldType,
      readOnly: true,
      custom: false,
      required: false,
      maxLength: 255,
      helpText: 'Auto-summarized full name (Salutation, First Name, Last Name)'
    };
    // Add at the beginning if not already present
    if (!fields.find(f => f.apiName === 'Contact__name')) {
      fields = [nameField, ...fields];
    }
  }

  const filteredFields = fields.filter(field =>
    field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.apiName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTypeSelect = (type: FieldType) => {
    setSelectedType(type);
    setFormData({ ...formData, type });
    setShowTypeSelector(false);
  };

  const handleCreateField = () => {
    setShowCreateDialog(true);
    setEditingField(null);
    setSelectedType(null);
    setShowTypeSelector(true);
    setFormData({
      label: '',
      apiName: '',
      type: 'Text',
      required: false,
      unique: false,
      helpText: '',
      defaultValue: '',
      maxLength: 255,
      precision: 18,
      scale: 2,
      displayFormat: '',
      formulaExpr: '',
      picklistValues: [],
      relationshipName: '',
      lookupObject: '',
    });
  };

  const handleEditField = (field: FieldDef) => {
    setEditingField(field);
    setSelectedType(field.type);
    setShowTypeSelector(false);
    setFormData({
      label: field.label,
      apiName: field.apiName,
      type: field.type,
      required: field.required || false,
      unique: field.unique || false,
      helpText: field.helpText || '',
      defaultValue: field.defaultValue || '',
      maxLength: field.maxLength || 255,
      precision: field.precision || 18,
      scale: field.scale || 2,
      displayFormat: field.autoNumber?.displayFormat || '',
      formulaExpr: field.formulaExpr || '',
      picklistValues: field.picklistValues || [],
      relationshipName: field.relationshipName || '',
      lookupObject: field.lookupObject || '',
    });
    setShowCreateDialog(true);
  };

  const handleDeleteField = (fieldApiName: string) => {
    if (confirm(`Are you sure you want to delete the field "${fieldApiName}"?`)) {
      deleteField(objectApiName, fieldApiName);
    }
  };

  const handleSaveField = () => {
    if (!formData.label || !formData.apiName) {
      alert('Please fill in the required fields: Label and API Name');
      return;
    }

    const newField: Partial<FieldDef> = {
      apiName: formData.apiName,
      label: formData.label,
      type: formData.type,
      required: formData.required,
      unique: formData.unique,
      helpText: formData.helpText,
      defaultValue: formData.defaultValue,
      maxLength: formData.maxLength,
      precision: formData.precision,
      scale: formData.scale,
      formulaExpr: formData.formulaExpr,
      picklistValues: formData.picklistValues,
      relationshipName: formData.relationshipName,
      lookupObject: formData.lookupObject,
    };

    // Add autoNumber config if applicable
    if (formData.type === 'AutoNumber' && formData.displayFormat) {
      (newField as any).autoNumber = {
        displayFormat: formData.displayFormat,
        startingNumber: 1,
      };
    }

    if (editingField) {
      updateField(objectApiName, editingField.apiName, newField as FieldDef);
    } else {
      addField(objectApiName, newField as Omit<FieldDef, 'id'>);
    }

    setShowCreateDialog(false);
  };

  const handleLabelChange = (label: string) => {
    // Auto-generate API name from label
    const apiName = `${objectApiName}__${label.replace(/\s+/g, '_').toLowerCase()}`;
    setFormData({
      ...formData,
      label,
      apiName,
    });
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max">
        {/* Header Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Button onClick={handleCreateField} className="ml-4">
            <Plus className="w-4 h-4 mr-2" />
            New Field
          </Button>
        </div>

        {/* Fields Table */}
        <div className="bg-white rounded-lg border border-gray-200">
          <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Field Label
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                API Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Required
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredFields.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  {searchTerm ? 'No fields match your search.' : 'No fields created yet.'}
                </td>
              </tr>
            ) : (
              filteredFields.map((field) => {
                return (
                  <tr key={field.apiName} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{field.label}</div>
                        {field.helpText && (
                          <div className="text-xs text-gray-500 line-clamp-1">{field.helpText}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {field.apiName}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{field.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {field.required ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Optional
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditField(field)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteField(field.apiName)}
                        disabled={!field.custom}
                        className={`${
                          field.custom
                            ? 'text-red-600 hover:text-red-900 cursor-pointer'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={field.custom ? 'Delete field' : 'System fields cannot be deleted'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Field Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingField ? 'Edit Field' : 'Create New Field'}
              </h2>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {showTypeSelector ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Field Type</h3>
                  
                  {/* None Selected Option */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">Choose a Data Type</p>
                        <p>Select one of the data types below to continue creating your field.</p>
                      </div>
                    </div>
                  </div>

                  {/* All Field Types in Single Column */}
                  <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
                    {/* System Fields */}
                    {FIELD_TYPES.filter(t => t.category === 'System').map((type, index) => {
                      return (
                        <button
                          key={type.value}
                          onClick={() => handleTypeSelect(type.value)}
                          className="w-full flex items-start p-4 hover:bg-indigo-50 transition-all text-left border-b border-gray-200 last:border-b-0"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-1">{type.label}</div>
                            <div className="text-sm text-gray-600">{type.description}</div>
                          </div>
                        </button>
                      );
                    })}

                    {/* Divider */}
                    <div className="h-2 bg-gray-100"></div>

                    {/* Relationship Fields */}
                    {FIELD_TYPES.filter(t => t.category === 'Relationship').map((type) => {
                      return (
                        <button
                          key={type.value}
                          onClick={() => handleTypeSelect(type.value)}
                          className="w-full flex items-start p-4 hover:bg-indigo-50 transition-all text-left border-b border-gray-200 last:border-b-0"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-1">{type.label}</div>
                            <div className="text-sm text-gray-600">{type.description}</div>
                          </div>
                        </button>
                      );
                    })}

                    {/* Divider */}
                    <div className="h-2 bg-gray-100"></div>

                    {/* Standard Fields */}
                    {FIELD_TYPES.filter(t => t.category === 'Standard').map((type) => {
                      return (
                        <button
                          key={type.value}
                          onClick={() => handleTypeSelect(type.value)}
                          className="w-full flex items-start p-4 hover:bg-indigo-50 transition-all text-left border-b border-gray-200 last:border-b-0"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-1">{type.label}</div>
                            <div className="text-sm text-gray-600">{type.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Selected Type Badge */}
                  <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="text-sm text-gray-600 mr-2">Field Type:</div>
                      <span className="font-semibold text-indigo-900">
                        {FIELD_TYPES.find(t => t.value === selectedType)?.label}
                      </span>
                    </div>
                    {!editingField && (
                      <button
                        onClick={() => setShowTypeSelector(true)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Change Type
                      </button>
                    )}
                  </div>

                  {/* Basic Information */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="label">Field Label *</Label>
                        <Input
                          id="label"
                          value={formData.label}
                          onChange={(e) => handleLabelChange(e.target.value)}
                          placeholder="e.g., Customer Name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="apiName">API Name *</Label>
                        <Input
                          id="apiName"
                          value={formData.apiName}
                          onChange={(e) => setFormData({ ...formData, apiName: e.target.value })}
                          placeholder="e.g., customer_name"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="helpText">Help Text</Label>
                        <Input
                          id="helpText"
                          value={formData.helpText}
                          onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
                          placeholder="Guidance text shown to users"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Field Options */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Field Options</h4>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="required"
                          checked={formData.required}
                          onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                        <Label htmlFor="required" className="ml-2 mb-0">
                          Required field
                        </Label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="unique"
                          checked={formData.unique}
                          onChange={(e) => setFormData({ ...formData, unique: e.target.checked })}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                        <Label htmlFor="unique" className="ml-2 mb-0">
                          Unique values only
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* type-specific-fields */}
                  {(selectedType === 'Text' || selectedType === 'TextArea' || selectedType === 'EncryptedText') && (
                    <div>
                      <Label htmlFor="maxLength">Maximum Length</Label>
                      <Input
                        id="maxLength"
                        type="number"
                        value={formData.maxLength}
                        onChange={(e) => setFormData({ ...formData, maxLength: parseInt(e.target.value) || 255 })}
                        min={1}
                        max={selectedType === 'TextArea' ? 255 : 255}
                      />
                    </div>
                  )}

                  {(selectedType === 'Number' || selectedType === 'Currency' || selectedType === 'Percent') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="precision">Length (Total Digits)</Label>
                        <Input
                          id="precision"
                          type="number"
                          value={formData.precision}
                          onChange={(e) => setFormData({ ...formData, precision: parseInt(e.target.value) || 18 })}
                          min={1}
                          max={18}
                        />
                      </div>
                      <div>
                        <Label htmlFor="scale">Decimal Places</Label>
                        <Input
                          id="scale"
                          type="number"
                          value={formData.scale}
                          onChange={(e) => setFormData({ ...formData, scale: parseInt(e.target.value) || 2 })}
                          min={0}
                          max={17}
                        />
                      </div>
                    </div>
                  )}

                  {selectedType === 'AutoNumber' && (
                    <div>
                      <Label htmlFor="displayFormat">Display Format</Label>
                      <Input
                        id="displayFormat"
                        value={formData.displayFormat}
                        onChange={(e) => setFormData({ ...formData, displayFormat: e.target.value })}
                        placeholder="e.g., INV-{0000}"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use {'{0000}'} for numbers. Example: INV-{'{0000}'} creates INV-0001, INV-0002, etc.
                      </p>
                    </div>
                  )}

                  {selectedType === 'Formula' && (
                    <div>
                      <Label htmlFor="formulaExpr">Formula Expression</Label>
                      <Textarea
                        id="formulaExpr"
                        value={formData.formulaExpr}
                        onChange={(e) => setFormData({ ...formData, formulaExpr: e.target.value })}
                        placeholder="e.g., Amount * 0.1"
                        rows={3}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the formula expression to calculate the field value.
                      </p>
                    </div>
                  )}

                  {(selectedType === 'Lookup' || selectedType === 'ExternalLookup') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="lookupObject">Related To</Label>
                        <Input
                          id="lookupObject"
                          value={formData.lookupObject}
                          onChange={(e) => setFormData({ ...formData, lookupObject: e.target.value })}
                          placeholder="e.g., Account"
                        />
                      </div>
                      <div>
                        <Label htmlFor="relationshipName">Relationship Name</Label>
                        <Input
                          id="relationshipName"
                          value={formData.relationshipName}
                          onChange={(e) => setFormData({ ...formData, relationshipName: e.target.value })}
                          placeholder="e.g., account"
                        />
                      </div>
                    </div>
                  )}

                  {(selectedType === 'Picklist' || selectedType === 'MultiPicklist') && (
                    <div>
                      <Label htmlFor="picklistValues">Picklist Values</Label>
                      <Textarea
                        id="picklistValues"
                        value={formData.picklistValues.join('\n')}
                        onChange={(e) => setFormData({ ...formData, picklistValues: e.target.value.split('\n').filter(v => v.trim()) })}
                        placeholder="Enter one value per line"
                        rows={5}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter each option on a new line.
                      </p>
                    </div>
                  )}

                  {selectedType !== 'Formula' && selectedType !== 'RollupSummary' && selectedType !== 'AutoNumber' && (
                    <div>
                      <Label htmlFor="defaultValue">Default Value</Label>
                      <Input
                        id="defaultValue"
                        value={formData.defaultValue}
                        onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                        placeholder="Optional default value"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!showTypeSelector && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveField}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingField ? 'Update Field' : 'Create Field'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
