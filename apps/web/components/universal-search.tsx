'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Users, Building2, Lightbulb, Target, Briefcase, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'property' | 'account' | 'contact' | 'lead' | 'deal' | 'project';
  title: string;
  subtitle: string;
  url: string;
  matchedFields: string[];
}

const typeConfig = {
  property: {
    icon: MapPin,
    label: 'Property',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  account: {
    icon: Building2,
    label: 'Account',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  contact: {
    icon: Users,
    label: 'Contact',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  lead: {
    icon: Lightbulb,
    label: 'Lead',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  deal: {
    icon: Target,
    label: 'Deal',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  project: {
    icon: Briefcase,
    label: 'Project',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
};

export default function UniversalSearch({ inputClassName }: { inputClassName?: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Search across all record types
  const performSearch = (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const allResults: SearchResult[] = [];

    // Search Properties
    const storedProperties = localStorage.getItem('properties');
    if (storedProperties) {
      const properties = JSON.parse(storedProperties);
      properties.forEach((property: any) => {
        const matchedFields: string[] = [];
        const searchableFields = {
          propertyNumber: property.propertyNumber,
          address: property.address,
          city: property.city,
          state: property.state,
          zipCode: property.zipCode,
          status: property.status,
        };

        Object.entries(searchableFields).forEach(([field, value]) => {
          if (value && String(value).toLowerCase().includes(lowerQuery)) {
            matchedFields.push(field);
          }
        });

        if (matchedFields.length > 0) {
          allResults.push({
            id: property.id,
            type: 'property',
            title: property.propertyNumber,
            subtitle: `${property.address}, ${property.city}, ${property.state}`,
            url: `/properties/${property.id}`,
            matchedFields,
          });
        }
      });
    }

    // Search Accounts
    const storedAccounts = localStorage.getItem('accounts');
    if (storedAccounts) {
      const accounts = JSON.parse(storedAccounts);
      accounts.forEach((account: any) => {
        const matchedFields: string[] = [];
        const searchableFields = {
          name: account.name,
          domain: account.domain,
          industry: account.industry,
          type: account.type,
        };

        Object.entries(searchableFields).forEach(([field, value]) => {
          if (value && String(value).toLowerCase().includes(lowerQuery)) {
            matchedFields.push(field);
          }
        });

        if (matchedFields.length > 0) {
          allResults.push({
            id: account.id,
            type: 'account',
            title: account.name,
            subtitle: account.domain || account.industry || 'Account',
            url: `/accounts/${account.id}`,
            matchedFields,
          });
        }
      });
    }

    // Search Contacts
    const storedContacts = localStorage.getItem('contacts');
    if (storedContacts) {
      const contacts = JSON.parse(storedContacts);
      contacts.forEach((contact: any) => {
        const matchedFields: string[] = [];
        const fullName = `${contact.firstName} ${contact.lastName}`;
        const searchableFields = {
          name: fullName,
          email: contact.email,
          phone: contact.phone,
          title: contact.title,
          company: contact.company,
        };

        Object.entries(searchableFields).forEach(([field, value]) => {
          if (value && String(value).toLowerCase().includes(lowerQuery)) {
            matchedFields.push(field);
          }
        });

        if (matchedFields.length > 0) {
          allResults.push({
            id: contact.id,
            type: 'contact',
            title: fullName,
            subtitle: contact.email || contact.title || 'Contact',
            url: `/contacts/${contact.id}`,
            matchedFields,
          });
        }
      });
    }

    // Search Leads
    const storedLeads = localStorage.getItem('leads');
    if (storedLeads) {
      const leads = JSON.parse(storedLeads);
      leads.forEach((lead: any) => {
        const matchedFields: string[] = [];
        const fullName = `${lead.firstName} ${lead.lastName}`;
        const searchableFields = {
          name: fullName,
          email: lead.email,
          company: lead.company,
          status: lead.status,
          source: lead.source,
        };

        Object.entries(searchableFields).forEach(([field, value]) => {
          if (value && String(value).toLowerCase().includes(lowerQuery)) {
            matchedFields.push(field);
          }
        });

        if (matchedFields.length > 0) {
          allResults.push({
            id: lead.id,
            type: 'lead',
            title: fullName,
            subtitle: lead.company || lead.email || 'Lead',
            url: `/leads/${lead.id}`,
            matchedFields,
          });
        }
      });
    }

    // Search Deals
    const storedDeals = localStorage.getItem('deals');
    if (storedDeals) {
      const deals = JSON.parse(storedDeals);
      deals.forEach((deal: any) => {
        const matchedFields: string[] = [];
        const searchableFields = {
          name: deal.name,
          accountName: deal.accountName,
          stage: deal.stage,
          amount: deal.amount?.toString(),
        };

        Object.entries(searchableFields).forEach(([field, value]) => {
          if (value && String(value).toLowerCase().includes(lowerQuery)) {
            matchedFields.push(field);
          }
        });

        if (matchedFields.length > 0) {
          allResults.push({
            id: deal.id,
            type: 'deal',
            title: deal.name,
            subtitle: `${deal.accountName} - ${deal.stage}`,
            url: `/deals/${deal.id}`,
            matchedFields,
          });
        }
      });
    }

    // Search Projects
    const storedProjects = localStorage.getItem('projects');
    if (storedProjects) {
      const projects = JSON.parse(storedProjects);
      projects.forEach((project: any) => {
        const matchedFields: string[] = [];
        const searchableFields = {
          name: project.name,
          status: project.status,
          client: project.client,
          type: project.type,
        };

        Object.entries(searchableFields).forEach(([field, value]) => {
          if (value && String(value).toLowerCase().includes(lowerQuery)) {
            matchedFields.push(field);
          }
        });

        if (matchedFields.length > 0) {
          allResults.push({
            id: project.id,
            type: 'project',
            title: project.name,
            subtitle: project.client || project.status || 'Project',
            url: `/projects/${project.id}`,
            matchedFields,
          });
        }
      });
    }

    setResults(allResults);
  };

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchTerm);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && searchTerm) {
      setIsOpen(true);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.url);
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  return (
    <div ref={searchRef} className="relative flex-1 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => searchTerm && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search properties, accounts, contacts, leads, deals, projects..."
          className={cn(
            'w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 dark:text-white text-sm',
            inputClassName
          )}
          aria-label="Universal search"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && searchTerm && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No results found for "{searchTerm}"
            </div>
          ) : (
            <div className="py-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </div>
              {results.map((result, index) => {
                const config = typeConfig[result.type];
                const Icon = config.icon;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        config.bgColor,
                        'dark:bg-opacity-20'
                      )}
                    >
                      <Icon className={cn('w-5 h-5', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {result.title}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            config.bgColor,
                            config.color,
                            'dark:bg-opacity-20'
                          )}
                        >
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {result.subtitle}
                      </p>
                      {result.matchedFields.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Matches: {result.matchedFields.join(', ')}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
