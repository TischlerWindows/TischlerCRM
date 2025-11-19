'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Settings,
  Database,
  Users,
  HardDrive,
  Mail,
  Box,
  Calendar,
  Workflow,
  Layout,
  Code,
  Wrench,
  Globe,
  Zap,
  Bell,
  Wifi,
  Building,
  Shield,
  Lock,
  FileText,
  Smartphone,
  BarChart3,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  Home,
  ChevronRight
} from 'lucide-react';

const setupSections = [
  {
    title: 'Quick Start',
    items: [
      { name: 'Setup Home', icon: Home, href: '/settings/setup-home' },
      { name: 'Salesforce Foundations', icon: Building, href: '/settings/foundations' },
      { name: 'Salesforce Go', icon: Zap, href: '/settings/go' },
      { name: 'Service Setup Assistant', icon: CheckCircle, href: '/settings/service-assistant' },
      { name: 'Service Cloud Reports', icon: BarChart3, href: '/settings/service-reports' },
      { name: 'Hyperforce Assistant', icon: Globe, href: '/settings/hyperforce' },
      { name: 'Release Updates', icon: RefreshCw, href: '/settings/releases' },
      { name: 'Salesforce Mobile App', icon: Smartphone, href: '/settings/mobile' },
      { name: 'Lightning Usage', icon: TrendingUp, href: '/settings/lightning-usage' },
      { name: 'Optimizer', icon: TrendingUp, href: '/settings/optimizer' },
      { name: 'Manage Subscription', icon: FileText, href: '/settings/subscription' },
      { name: 'Sales Cloud Everywhere', icon: Globe, href: '/settings/sales-everywhere' },
    ]
  },
  {
    title: 'Administration',
    items: [
      { name: 'Users', icon: Users, href: '/settings/users' },
      { name: 'Data', icon: HardDrive, href: '/settings/data' },
      { name: 'Email', icon: Mail, href: '/settings/email' },
      { name: 'Objects and Fields', icon: Database, href: '/object-manager' },
      { name: 'Events', icon: Calendar, href: '/settings/events' },
    ]
  },
  {
    title: 'Process Automation',
    items: [
      { name: 'Process Automation', icon: Workflow, href: '/settings/automation' },
    ]
  },
  {
    title: 'User Interface',
    items: [
      { name: 'User Interface', icon: Layout, href: '/settings/ui' },
    ]
  },
  {
    title: 'Custom Code',
    items: [
      { name: 'Custom Code', icon: Code, href: '/settings/custom-code' },
    ]
  },
  {
    title: 'Development',
    items: [
      { name: 'Development', icon: Wrench, href: '/settings/development' },
    ]
  },
  {
    title: 'Scale',
    items: [
      { name: 'Environments', icon: Globe, href: '/settings/environments' },
    ]
  },
  {
    title: 'User Engagement',
    items: [
      { name: 'Enablement', icon: CheckCircle, href: '/settings/enablement' },
    ]
  },
  {
    title: 'Integrations',
    items: [
      { name: 'Notification Builder', icon: Bell, href: '/settings/notifications' },
      { name: 'Offline', icon: Wifi, href: '/settings/offline' },
    ]
  },
  {
    title: 'Settings',
    items: [
      { name: 'Company Settings', icon: Building, href: '/settings/company' },
      { name: 'Data Classification', icon: FileText, href: '/settings/data-classification' },
      { name: 'Privacy Center', icon: Shield, href: '/settings/privacy' },
    ]
  },
  {
    title: 'Identity',
    items: [
      { name: 'Identity', icon: Users, href: '/settings/identity' },
    ]
  },
  {
    title: 'Security',
    items: [
      { name: 'Security', icon: Lock, href: '/settings/security' },
    ]
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'object-manager' | 'setup'>('setup');
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-700">
                TCES
              </Link>
              <span className="text-gray-300">|</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Setup</h1>
                <p className="text-sm text-gray-600 mt-1">Configure and customize your CRM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <div className="flex space-x-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('setup')}
              className={cn(
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'setup'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Setup
            </button>
            <button
              onClick={() => setActiveTab('object-manager')}
              className={cn(
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'object-manager'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Object Manager
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'setup' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {setupSections.map((section) => (
              <div key={section.title} className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center space-x-3">
                        <item.icon className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                          {item.name}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="text-center">
              <Database className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Object Manager</h2>
              <p className="text-gray-600 mb-6">
                Manage your custom objects and their configurations
              </p>
              <Link
                href="/object-manager"
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Database className="w-5 h-5 mr-2" />
                Open Object Manager
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
