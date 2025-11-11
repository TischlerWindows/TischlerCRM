'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, HelpCircle } from 'lucide-react';

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
              <Link href="/" className="text-2xl font-bold text-indigo-600">TCP</Link>
            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                <>
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
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Core Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              title="Accounts"
              description="Manage your customer accounts and company relationships in one place."
              icon=""
            />
            <FeatureCard
              title="Contacts"
              description="Track all your contacts with detailed profiles and communication history."
              icon=""
            />
            <FeatureCard
              title="Opportunities"
              description="Pipeline management with stages, amounts, and probability tracking."
              icon=""
            />
            <FeatureCard
              title="Activities"
              description="Log calls, emails, meetings, notes, and tasks linked to your records."
              icon=""
            />
            <FeatureCard
              title="Dropbox Files"
              description={<span>Possible link to Tischler dropbox here:<br /><a href="https://www.dropbox.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Fast link to Dropbox homepage</a></span>}
              icon=""
            />
            <FeatureCard
              title="Reports & Search"
              description="Search by name, email, stage, owner. Pipeline reports by stage/owner."
              icon=""
            />
          </div>
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
