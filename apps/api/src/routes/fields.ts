import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const createFieldSchema = z.object({
  objectApiName: z.string(),
  apiName: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1),
  type: z.string(),
  description: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  maxLength: z.number().optional(),
  minLength: z.number().optional(),
  scale: z.number().optional(),
  precision: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  picklistValues: z.array(z.string()).optional(),
  defaultValue: z.string().optional(),
});

const updateFieldSchema = createFieldSchema.omit({ objectApiName: true }).partial();

export async function fieldRoutes(app: FastifyInstance) {
  // Get all fields for an object
  app.get('/objects/:apiName/fields', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      include: {
        fields: {
          where: { isActive: true },
          include: {
            relationship: {
              include: {
                parentObject: true,
                childObject: true,
              },
            },
          },
          orderBy: { label: 'asc' },
        },
      },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    reply.send(object.fields);
  });

  // Create new field
  app.post('/objects/:apiName/fields', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const parsed = createFieldSchema.safeParse({ ...req.body, objectApiName: apiName });
    
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const userId = req.user!.sub;

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    const field = await prisma.customField.create({
      data: {
        id: generateId('CustomField'),
        objectId: object.id,
        apiName: parsed.data.apiName,
        label: parsed.data.label,
        type: parsed.data.type,
        description: parsed.data.description,
        helpText: parsed.data.helpText,
        required: parsed.data.required ?? false,
        unique: parsed.data.unique ?? false,
        readOnly: parsed.data.readOnly ?? false,
        maxLength: parsed.data.maxLength,
        minLength: parsed.data.minLength,
        scale: parsed.data.scale,
        precision: parsed.data.precision,
        min: parsed.data.min,
        max: parsed.data.max,
        picklistValues: parsed.data.picklistValues ? JSON.stringify(parsed.data.picklistValues) : null,
        defaultValue: parsed.data.defaultValue,
        createdById: userId,
        modifiedById: userId,
      },
      include: {
        relationship: true,
      },
    });

    reply.code(201).send(field);
  });

  // Update field
  app.put('/objects/:apiName/fields/:fieldApiName', async (req, reply) => {
    const { apiName, fieldApiName } = req.params as { apiName: string; fieldApiName: string };
    const parsed = updateFieldSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const userId = req.user!.sub;

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    const updateData: any = {
      ...parsed.data,
      modifiedById: userId,
    };

    if (parsed.data.picklistValues) {
      updateData.picklistValues = JSON.stringify(parsed.data.picklistValues);
    }

    const field = await prisma.customField.update({
      where: {
        objectId_apiName: {
          objectId: object.id,
          apiName: fieldApiName,
        },
      },
      data: updateData,
      include: {
        relationship: true,
      },
    });

    reply.send(field);
  });

  // Rename a picklist value across all records for this field
  app.post('/objects/:apiName/fields/:fieldApiName/rename-value', async (req, reply) => {
    const { apiName, fieldApiName } = req.params as { apiName: string; fieldApiName: string };
    const { oldValue, newValue, isMultiSelect: clientMulti } = req.body as { oldValue: string; newValue: string; isMultiSelect?: boolean };
    if (!oldValue || !newValue || oldValue === newValue) {
      return reply.code(400).send({ error: 'oldValue and newValue are required and must differ' });
    }

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });
    if (!object) return reply.code(404).send({ error: 'Object not found' });

    // Use client-provided type hint when available; fall back to DB lookup
    let isMultiSelect = clientMulti ?? false;
    if (clientMulti === undefined) {
      const field = await prisma.customField.findFirst({ where: { objectId: object.id, apiName: fieldApiName } });
      if (field) isMultiSelect = field.type === 'MultiPicklist' || field.type === 'MultiSelectPicklist';
    }

    // Records store values under BOTH the prefixed key (e.g. "Account__status")
    // AND the bare key (e.g. "status"). Update both so they stay consistent.
    const bareApiName = fieldApiName.replace(/^[A-Za-z]+__/, '');

    if (isMultiSelect) {
      // Multi-select values are stored as semicolon-separated strings — replace the token in-place.
      await prisma.$executeRaw`
        UPDATE "Record"
        SET data = jsonb_set(
          data,
          ARRAY[${fieldApiName}::text],
          to_jsonb(
            regexp_replace(
              data->>${fieldApiName},
              '(^|;)' || ${oldValue} || '(;|$)',
              '\\1' || ${newValue} || '\\2',
              'g'
            )
          )
        )
        WHERE "objectId" = ${object.id}
        AND data ? ${fieldApiName}
        AND (
          data->>${fieldApiName} = ${oldValue}
          OR data->>${fieldApiName} LIKE ${'%;' + oldValue}
          OR data->>${fieldApiName} LIKE ${oldValue + ';%'}
          OR data->>${fieldApiName} LIKE ${'%;' + oldValue + ';%'}
        )
      `;
      if (bareApiName !== fieldApiName) {
        await prisma.$executeRaw`
          UPDATE "Record"
          SET data = jsonb_set(
            data,
            ARRAY[${bareApiName}::text],
            to_jsonb(
              regexp_replace(
                data->>${bareApiName},
                '(^|;)' || ${oldValue} || '(;|$)',
                '\\1' || ${newValue} || '\\2',
                'g'
              )
            )
          )
          WHERE "objectId" = ${object.id}
          AND data ? ${bareApiName}
          AND (
            data->>${bareApiName} = ${oldValue}
            OR data->>${bareApiName} LIKE ${'%;' + oldValue}
            OR data->>${bareApiName} LIKE ${oldValue + ';%'}
            OR data->>${bareApiName} LIKE ${'%;' + oldValue + ';%'}
          )
        `;
      }
    } else {
      // Single-select: exact match replace for both key forms
      await prisma.$executeRaw`
        UPDATE "Record"
        SET data = jsonb_set(data, ARRAY[${fieldApiName}::text], to_jsonb(${newValue}::text))
        WHERE "objectId" = ${object.id}
        AND data->>${fieldApiName} = ${oldValue}
      `;
      if (bareApiName !== fieldApiName) {
        await prisma.$executeRaw`
          UPDATE "Record"
          SET data = jsonb_set(data, ARRAY[${bareApiName}::text], to_jsonb(${newValue}::text))
          WHERE "objectId" = ${object.id}
          AND data->>${bareApiName} = ${oldValue}
        `;
      }
    }

    reply.send({ ok: true });
  });

  // Remove a deleted picklist value from all existing records
  app.post('/objects/:apiName/fields/:fieldApiName/clear-value', async (req, reply) => {
    const { apiName, fieldApiName } = req.params as { apiName: string; fieldApiName: string };
    const { value, isMultiSelect: clientMulti } = req.body as { value: string; isMultiSelect?: boolean };
    if (!value) return reply.code(400).send({ error: 'value is required' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });
    if (!object) return reply.code(404).send({ error: 'Object not found' });

    // Use client-provided type hint when available; fall back to DB lookup
    let isMultiSelect = clientMulti ?? false;
    if (clientMulti === undefined) {
      const field = await prisma.customField.findFirst({ where: { objectId: object.id, apiName: fieldApiName } });
      if (field) isMultiSelect = field.type === 'MultiPicklist' || field.type === 'MultiSelectPicklist';
    }

    // Records store values under BOTH the prefixed key AND the bare key — clear both.
    const bareApiName = fieldApiName.replace(/^[A-Za-z]+__/, '');

    if (isMultiSelect) {
      // Remove token from semicolon-separated string; clean up leading/trailing semicolons
      await prisma.$executeRaw`
        UPDATE "Record"
        SET data = CASE
          WHEN regexp_replace(regexp_replace(data->>${fieldApiName}, '(^|;)' || ${value} || '(;|$)', '\\1\\2', 'g'), '^;|;$', '', 'g') = ''
            THEN data - ${fieldApiName}
          ELSE jsonb_set(data, ARRAY[${fieldApiName}::text], to_jsonb(
            regexp_replace(regexp_replace(data->>${fieldApiName}, '(^|;)' || ${value} || '(;|$)', ';', 'g'), '^;|;$', '', 'g')
          ))
        END
        WHERE "objectId" = ${object.id}
        AND data ? ${fieldApiName}
        AND (
          data->>${fieldApiName} = ${value}
          OR data->>${fieldApiName} LIKE ${'%;' + value}
          OR data->>${fieldApiName} LIKE ${value + ';%'}
          OR data->>${fieldApiName} LIKE ${'%;' + value + ';%'}
        )
      `;
      if (bareApiName !== fieldApiName) {
        await prisma.$executeRaw`
          UPDATE "Record"
          SET data = CASE
            WHEN regexp_replace(regexp_replace(data->>${bareApiName}, '(^|;)' || ${value} || '(;|$)', '\\1\\2', 'g'), '^;|;$', '', 'g') = ''
              THEN data - ${bareApiName}
            ELSE jsonb_set(data, ARRAY[${bareApiName}::text], to_jsonb(
              regexp_replace(regexp_replace(data->>${bareApiName}, '(^|;)' || ${value} || '(;|$)', ';', 'g'), '^;|;$', '', 'g')
            ))
          END
          WHERE "objectId" = ${object.id}
          AND data ? ${bareApiName}
          AND (
            data->>${bareApiName} = ${value}
            OR data->>${bareApiName} LIKE ${'%;' + value}
            OR data->>${bareApiName} LIKE ${value + ';%'}
            OR data->>${bareApiName} LIKE ${'%;' + value + ';%'}
          )
        `;
      }
    } else {
      // Single-select: remove both key forms entirely when value matches
      await prisma.$executeRaw`
        UPDATE "Record"
        SET data = data - ${fieldApiName}
        WHERE "objectId" = ${object.id}
        AND data->>${fieldApiName} = ${value}
      `;
      if (bareApiName !== fieldApiName) {
        await prisma.$executeRaw`
          UPDATE "Record"
          SET data = data - ${bareApiName}
          WHERE "objectId" = ${object.id}
          AND data->>${bareApiName} = ${value}
        `;
      }
    }

    reply.send({ ok: true });
  });

  // Delete field (soft delete)
  app.delete('/objects/:apiName/fields/:fieldApiName', async (req, reply) => {
    const { apiName, fieldApiName } = req.params as { apiName: string; fieldApiName: string };
    const userId = req.user!.sub;

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    await prisma.customField.update({
      where: {
        objectId_apiName: {
          objectId: object.id,
          apiName: fieldApiName,
        },
      },
      data: {
        isActive: false,
        modifiedById: userId,
      },
    });

    reply.code(204).send();
  });
}
