/**
 * Google Places API proxy routes.
 *
 * Proxies autocomplete and place details requests so the Google Maps API key
 * never leaves the server.  Follows the integration backbone pattern:
 *   prisma.integration.findUnique → decrypt(apiKey) → call Google → return results
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { decrypt } from '../crypto';
import { verifyJwt } from '../auth';
import { loadEnv } from '../config';

interface PlacePrediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
}

/**
 * Parse Google's address_components array into a flat structured object.
 * Gracefully handles missing components (e.g. no postal_code for Caribbean addresses).
 */
function parseAddressComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  geometry: { location: { lat: number; lng: number } } | undefined,
  formattedAddress: string
): ParsedAddress {
  let streetNumber = '';
  let route = '';
  let city = '';
  let state = '';
  let postalCode = '';
  let country = '';

  for (const c of components) {
    const types = c.types;
    if (types.includes('street_number')) {
      streetNumber = c.long_name;
    } else if (types.includes('route')) {
      route = c.long_name;
    } else if (types.includes('locality') || types.includes('postal_town')) {
      city = c.long_name;
    } else if (types.includes('sublocality_level_1') && !city) {
      city = c.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      state = c.short_name;
    } else if (types.includes('postal_code')) {
      postalCode = c.long_name;
    } else if (types.includes('country')) {
      country = c.long_name;
    }
  }

  const street = [streetNumber, route].filter(Boolean).join(' ');

  return {
    street,
    city,
    state,
    postalCode,
    country,
    lat: geometry?.location?.lat ?? null,
    lng: geometry?.location?.lng ?? null,
    formattedAddress,
  };
}

/**
 * Retrieve and decrypt the Google Maps API key.
 * Returns null if the integration is not configured or disabled.
 */
async function getGoogleMapsKey(): Promise<string | null> {
  const integration = await prisma.integration.findUnique({
    where: { provider: 'google_maps' },
  });
  if (!integration?.enabled || !integration.apiKey) return null;
  return decrypt(integration.apiKey);
}

export async function placesRoutes(app: FastifyInstance) {

  // GET /places/autocomplete?input=...&sessionToken=...
  app.get('/places/autocomplete', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const querySchema = z.object({
      input: z.string().min(1),
      sessionToken: z.string().optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const apiKey = await getGoogleMapsKey();
    if (!apiKey) {
      return reply.code(400).send({ error: 'Google Maps integration is not configured or disabled.' });
    }

    const params = new URLSearchParams({
      input: parsed.data.input,
      key: apiKey,
      types: 'address',
    });
    if (parsed.data.sessionToken) {
      params.set('sessiontoken', parsed.data.sessionToken);
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        app.log.warn({ status: data.status, error_message: data.error_message }, 'Places Autocomplete error');
        return reply.code(502).send({ error: `Google Places API error: ${data.status}` });
      }

      const predictions: PlacePrediction[] = (data.predictions || []).map((p: any) => ({
        description: p.description,
        place_id: p.place_id,
        structured_formatting: {
          main_text: p.structured_formatting?.main_text || '',
          secondary_text: p.structured_formatting?.secondary_text || '',
        },
      }));

      reply.send({ predictions });
    } catch (err: any) {
      app.log.error(err, 'Places Autocomplete proxy failed');
      reply.code(502).send({ error: 'Failed to reach Google Places API' });
    }
  });

  // GET /places/static-map?lat=...&lng=...&zoom=...&size=...&token=...
  // Accepts auth token via query param so <img> tags can load the image directly.
  app.get('/places/static-map', async (req, reply) => {
    const query = req.query as Record<string, string>;
    let user = req.user;
    if (!user && query.token) {
      const env = loadEnv();
      user = verifyJwt(query.token, env.JWT_SECRET) as any;
    }
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const querySchema = z.object({
      lat: z.string().min(1),
      lng: z.string().min(1),
      zoom: z.string().optional(),
      size: z.string().optional(),
      token: z.string().optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const apiKey = await getGoogleMapsKey();
    if (!apiKey) {
      return reply.code(400).send({ error: 'Google Maps integration is not configured or disabled.' });
    }

    const { lat, lng, zoom = '15', size = '600x300' } = parsed.data;
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom,
      size,
      maptype: 'roadmap',
      markers: `color:red|${lat},${lng}`,
      key: apiKey,
    });

    try {
      const url = `https://maps.googleapis.com/maps/api/staticmap?${params}`;
      const res = await fetch(url);

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        app.log.warn(
          { status: res.status, contentType },
          'Static Maps API returned non-OK status (enable Maps Static API and billing for this key)'
        );
        return reply.code(502).send({ error: 'Google Static Maps API error' });
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      reply
        .header('Content-Type', res.headers.get('content-type') || 'image/png')
        .header('Cache-Control', 'public, max-age=86400')
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .send(buffer);
    } catch (err: any) {
      app.log.error(err, 'Static Maps proxy failed');
      reply.code(502).send({ error: 'Failed to reach Google Static Maps API' });
    }
  });

  // GET /places/details?placeId=...&sessionToken=...
  app.get('/places/details', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const querySchema = z.object({
      placeId: z.string().min(1),
      sessionToken: z.string().optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const apiKey = await getGoogleMapsKey();
    if (!apiKey) {
      return reply.code(400).send({ error: 'Google Maps integration is not configured or disabled.' });
    }

    const params = new URLSearchParams({
      place_id: parsed.data.placeId,
      key: apiKey,
      fields: 'address_components,geometry,formatted_address',
    });
    if (parsed.data.sessionToken) {
      params.set('sessiontoken', parsed.data.sessionToken);
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== 'OK') {
        app.log.warn({ status: data.status, error_message: data.error_message }, 'Place Details error');
        return reply.code(502).send({ error: `Google Places API error: ${data.status}` });
      }

      const result = data.result;
      const address = parseAddressComponents(
        result.address_components || [],
        result.geometry,
        result.formatted_address || ''
      );

      reply.send({ address });
    } catch (err: any) {
      app.log.error(err, 'Place Details proxy failed');
      reply.code(502).send({ error: 'Failed to reach Google Places API' });
    }
  });
}
