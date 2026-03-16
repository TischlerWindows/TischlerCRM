/**
 * Google Maps geocoding proxy.
 *
 * Keeps the API key server-side — the frontend never sees it.
 * The frontend sends an address string, we forward to Google's
 * Geocoding API, and return lat/lng + formatted address.
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { decrypt } from '../crypto';

export async function geocodeRoutes(app: FastifyInstance) {
  // GET /geocode?address=123+Main+St,+Richmond,+VA
  app.get('/geocode', async (req, reply) => {
    const user = (req as any).user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const querySchema = z.object({
      address: z.string().min(1, 'Address is required'),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    try {
      // Get the Google Maps integration
      const integration = await prisma.integration.findUnique({
        where: { provider: 'google_maps' },
      });

      if (!integration || !integration.enabled) {
        return reply.code(400).send({ error: 'Google Maps integration is not enabled' });
      }
      if (!integration.apiKey) {
        return reply.code(400).send({ error: 'Google Maps API key is not configured' });
      }

      const apiKey = decrypt(integration.apiKey);
      const encoded = encodeURIComponent(parsed.data.address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results?.length) {
        return reply.send({
          success: false,
          status: data.status,
          error: data.error_message || 'No results found',
        });
      }

      const result = data.results[0];
      reply.send({
        success: true,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
      });
    } catch (err: any) {
      app.log.error(err, 'GET /geocode failed');
      reply.code(500).send({ error: 'Geocoding failed' });
    }
  });
}
