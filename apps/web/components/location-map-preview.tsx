'use client';

import React, { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

interface LocationMapPreviewProps {
  lat: number;
  lng: number;
  address?: string;
  className?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LocationMapPreview({ lat, lng, address, className }: LocationMapPreviewProps) {
  const [imgError, setImgError] = useState(false);
  const googleMapsQuery = address || `${lat},${lng}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleMapsQuery)}`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const staticMapUrl = token
    ? `${API_BASE}/places/static-map?lat=${lat}&lng=${lng}&zoom=15&size=600x300&token=${encodeURIComponent(token)}`
    : '';

  return (
    <div className={className}>
      <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
        {!imgError && staticMapUrl ? (
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={staticMapUrl}
              alt={address || `Map at ${lat.toFixed(6)}, ${lng.toFixed(6)}`}
              className="w-full h-[240px] object-cover"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          </a>
        ) : (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-[240px] bg-gray-50 text-gray-400 hover:text-gray-500 transition-colors"
          >
            <div className="text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2" />
              <span className="text-sm">Map preview unavailable. Click to open in Google Maps.</span>
            </div>
          </a>
        )}
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
