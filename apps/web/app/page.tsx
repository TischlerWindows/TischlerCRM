'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  User, 
  HelpCircle, 
  Building2, 
  Users, 
  Target, 
  CheckSquare, 
  FolderOpen, 
  BarChart3, 
  Search,
  Cog,
  MapPin,
  Briefcase,
  Lightbulb,
  Wrench,
  FileText,
  HardHat,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Information Modules - Reference and context data
const informationModules = [
  { name: 'Properties', href: '/properties', icon: MapPin },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Accounts', href: '/accounts', icon: Building2 },
  { name: 'Products', href: '/products', icon: Package },
];

// Pipeline Modules - Business activities tracking
const pipelineModules = [
  { name: 'Leads', href: '/leads', icon: Lightbulb },
  { name: 'Deals', href: '/deals', icon: Target },
  { name: 'Projects', href: '/projects', icon: Briefcase },
  { name: 'Service', href: '/service', icon: Wrench },
];

// Financial Tool Modules - Price breakdowns
const financialModules = [
  { name: 'Quotes', href: '/quotes', icon: FileText },
  { name: 'Installations', href: '/installations', icon: HardHat },
];

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
              <Link href="/" className="text-2xl font-bold text-indigo-600">TCES</Link>
            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                <>
                  <Link
                    href="/object-manager"
                    className="p-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none flex items-center"
                    aria-label="Object Manager"
                    title="Object Manager"
                  >
                    <Cog className="w-6 h-6" />
                  </Link>
                  <button
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 focus:outline-none flex items-center"
                    onClick={() => window.location.href = '/help'}
                    aria-label="Help"
                  >
                    <HelpCircle className="w-6 h-6" />
                  </button>
                  <div className="relative group ml-2">
                    <button className="p-2 bg-gray-100 text-gray-900 rounded-full hover:bg-gray-200 focus:outline-none flex items-center" aria-label="Profile">
                      <User className="w-6 h-6" />
                    </button>
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          localStorage.removeItem('token');
                          localStorage.removeItem('user');
                          document.cookie = 'token=; Max-Age=0; path=/;';
                          window.location.href = '/login';
                        }}
                      >
                        Logout
                      </button>
                      <button
                        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => window.location.href = '/settings'}
                      >
                        Profile Settings
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <Link href="/login" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Tabs Navigation - Only show when logged in */}
        {isLoggedIn && (
          <div className="border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-1 overflow-x-auto py-2">
                {[...informationModules, ...pipelineModules, ...financialModules].map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
                        isActive
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Tischler CRM ProtoType
          </h1>
          <div className="mt-2 text-base text-gray-600">
            --<br />Basic prototpye for Tischler CRM software
          </div>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-indigo-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                View Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md bg-indigo-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Get Started
                </Link>
                <a href="#features" className="text-lg font-semibold leading-6 text-gray-900">
                  Learn more <span aria-hidden="true">→</span>
                </a>
              </>
            )}
          </div>
        </div>

        <div id="features" className="mt-24">
          {/* Core Features section removed */}
        </div>

        {/* CTA Banner (removed Phase 0 message) */}
      </main>

      <footer className="mt-24 bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>michael's notes: Built with Next.js, Fastify, Prisma, SQLite (dev), and AWS Lambdaready, through VSCode IDE</p>
          {/* Removed explicit phase completion note */}
        </div>
      </footer>
    </div>
  );
}

import { ReactNode } from 'react';
function FeatureCard({ title, description, icon }: { title: string; description: ReactNode; icon: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
