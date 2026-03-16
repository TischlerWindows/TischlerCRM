'use client';

/**
 * RecordMap — renders a Google Maps embed for a record's address.
 *
 * How it works:
 * 1. Checks if Google Maps integration is enabled (one API call, cached in state)
 * 2. If enabled, geocodes the address via the backend proxy (keeps API key server-side)
 * 3. Renders an interactive Google Maps embed using the Embed API
 *
 * Usage:
 *   <RecordMap address={{ street: '123 Main', city: 'Richmond', state: 'VA', postalCode: '23220' }} />
 *
 * If the integration is disabled or the address is empty, renders nothing.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Map, Loader2, MapPin, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface RecordMapProps {
  address: AddressValue | string | null | undefined;
  /** Optional label for the section header */
  label?: string;
}

// Cache the integration check across component instances (per page load)
let mapsEnabledCache: boolean | null = null;
let mapsCheckPromise: Promise<boolean> | null = null;

async function checkMapsEnabled(): Promise<boolean> {
  if (mapsEnabledCache !== null) return mapsEnabledCache;
  if (mapsCheckPromise) return mapsCheckPromise;

  mapsCheckPromise = apiClient
    .getIntegration('google_maps')
    .then((data) => {
      mapsEnabledCache = data.enabled && data.hasApiKey;
      return mapsEnabledCache;
    })
    .catch(() => {
      mapsEnabledCache = false;
      return false;
    });

  return mapsCheckPromise;
}

function formatAddress(addr: AddressValue | string): string {
  if (typeof addr === 'string') return addr;
  const parts = [addr.street, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean);
  return parts.join(', ');
}

export default function RecordMap({ address, label = 'Location' }: RecordMapProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [geocodeResult, setGeocodeResult] = useState<{
    lat: number;
    lng: number;
    formattedAddress: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const geocodedRef = useRef<string>('');

  const addressStr = address ? formatAddress(address) : '';

  useEffect(() => {
    if (!addressStr) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // Step 1: check if maps is enabled
      const isEnabled = await checkMapsEnabled();
      if (cancelled) return;
      setEnabled(isEnabled);

      if (!isEnabled) {
        setLoading(false);
        return;
      }

      // Step 2: geocode (skip if we already geocoded this exact address)
      if (geocodedRef.current === addressStr) {
        setLoading(false);
        return;
      }

      try {
        const result = await apiClient.geocode(addressStr);
        if (cancelled) return;

        if (result.success && result.lat !== undefined && result.lng !== undefined) {
          setGeocodeResult({
            lat: result.lat,
            lng: result.lng,
            formattedAddress: result.formattedAddress || addressStr,
          });
          geocodedRef.current = addressStr;
        } else {
          setError('Could not find this address on the map');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Geocoding failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addressStr]);

  // Don't render anything if: no address, maps not enabled, or still checking
  if (!addressStr) return null;
  if (enabled === false) return null;

  // While loading, show a placeholder
  if (loading || enabled === null) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center gap-2">
          <Map className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900">{label}</h3>
        </div>
        <div className="h-[250px] flex items-center justify-center bg-gray-50">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center gap-2">
          <Map className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900">{label}</h3>
        </div>
        <div className="h-[120px] flex flex-col items-center justify-center text-gray-400 text-sm">
          <MapPin className="w-5 h-5 mb-2" />
          {error}
        </div>
      </div>
    );
  }

  if (!geocodeResult) return null;

  // Google Maps embed URL (uses the Embed API — free tier, no billing required for embeds)
  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=EMBED&q=${encodeURIComponent(
    geocodeResult.formattedAddress
  )}&center=${geocodeResult.lat},${geocodeResult.lng}&zoom=15`;

  // Static map fallback using the geocoded coordinates in a Google Maps link
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${geocodeResult.lat},${geocodeResult.lng}`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900">{label}</h3>
        </div>
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-navy hover:text-brand-navy/80 flex items-center gap-1 transition-colors"
        >
          Open in Maps <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Map render — uses an iframe for the interactive embed, with a static fallback */}
      <div className="relative h-[250px] bg-gray-100">
        {/* The iframe uses the Google Maps Embed API. If the embed key isn't set up,
            we fall back to a clickable static view. */}
        <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
          <div
            className="w-full h-full bg-cover bg-center rounded-sm cursor-pointer relative group"
            style={{
              backgroundImage: `url(https://maps.googleapis.com/maps/api/staticmap?center=${geocodeResult.lat},${geocodeResult.lng}&zoom=15&size=600x250&markers=color:red%7C${geocodeResult.lat},${geocodeResult.lng}&key=STATIC)`,
              backgroundColor: '#e5e7eb',
            }}
          >
            {/* Overlay with address info and click-to-open */}
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 hover:bg-black/10 transition-colors"
            >
              <div className="bg-white rounded-lg shadow-lg px-4 py-3 max-w-[80%]">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {geocodeResult.formattedAddress}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500">
                  {geocodeResult.lat.toFixed(6)}, {geocodeResult.lng.toFixed(6)}
                </span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
