'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink } from 'lucide-react';

interface LocationMapPreviewProps {
  lat: number;
  lng: number;
  address?: string;
  className?: string;
}

const LeafletMap = dynamic(() => import('./leaflet-map-inner'), { ssr: false });

export default function LocationMapPreview({ lat, lng, address, className }: LocationMapPreviewProps) {
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className={className}>
      <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
        <div className="h-[240px] w-full">
          <LeafletMap lat={lat} lng={lng} />
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500 truncate pr-3">
            {address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}
          </div>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap transition-colors"
          >
            Open in Google Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
