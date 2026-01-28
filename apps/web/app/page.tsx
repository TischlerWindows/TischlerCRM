'use client';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mt-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Tischler CRM ProtoType
          </h1>
          <div className="mt-2 text-base text-gray-600">
            --<br />Basic prototpye for Tischler CRM software
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
