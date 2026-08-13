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

// Multi-select values are stored either as a ";"-joined string (most widgets)
// or as a raw jsonb string array (some legacy imports / older widgets) —
// handle both so a rename/clear reaches every record regardless of format.
async function renameMultiSelectValueForKey(
  objectId: string,
  key: string,
  oldValue: string,
  newValue: string,
) {
  await prisma.$executeRaw`
    UPDATE "Record"
    SET data = jsonb_set(
      data,
      ARRAY[${key}::text],
      CASE
        WHEN jsonb_typeof(data->${key}) = 'array' THEN (
          SELECT COALESCE(jsonb_agg(CASE WHEN elem = ${oldValue} THEN ${newValue}::text ELSE elem END), '[]'::jsonb)
          FROM jsonb_array_elements_text(data->${key}) AS elem
        )
        ELSE to_jsonb(
          regexp_replace(data->>${key}, '(^|;)' || ${oldValue} || '(;|$)', '\\1' || ${newValue} || '\\2', 'g')
        )
      END
    )
    WHERE "objectId" = ${objectId}
    AND data ? ${key}
    AND (
      (jsonb_typeof(data->${key}) = 'array' AND data->${key} ? ${oldValue})
      OR (jsonb_typeof(data->${key}) <> 'array' AND (
        data->>${key} = ${oldValue}
        OR data->>${key} LIKE ${'%;' + oldValue}
        OR data->>${key} LIKE ${oldValue + ';%'}
        OR data->>${key} LIKE ${'%;' + oldValue + ';%'}
      ))
    )
  `;
}

async function clearMultiSelectValueForKey(objectId: string, key: string, value: string) {
  await prisma.$executeRaw`
    UPDATE "Record"
    SET data = CASE
      WHEN jsonb_typeof(data->${key}) = 'array' THEN
        jsonb_set(data, ARRAY[${key}::text], (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements_text(data->${key}) AS elem
          WHERE elem <> ${value}
        ))
      WHEN regexp_replace(regexp_replace(data->>${key}, '(^|;)' || ${value} || '(;|$)', '\\1\\2', 'g'), '^;|;$', '', 'g') = ''
        THEN data - ${key}
      ELSE jsonb_set(data, ARRAY[${key}::text], to_jsonb(
        regexp_replace(regexp_replace(data->>${key}, '(^|;)' || ${value} || '(;|$)', ';', 'g'), '^;|;$', '', 'g')
      ))
    END
    WHERE "objectId" = ${objectId}
    AND data ? ${key}
    AND (
      (jsonb_typeof(data->${key}) = 'array' AND data->${key} ? ${value})
      OR (jsonb_typeof(data->${key}) <> 'array' AND (
        data->>${key} = ${value}
        OR data->>${key} LIKE ${'%;' + value}
        OR data->>${key} LIKE ${value + ';%'}
        OR data->>${key} LIKE ${'%;' + value + ';%'}
      ))
    )
  `;
}

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
      // Multi-select values may be stored as a ";"-joined string or a jsonb array.
      await renameMultiSelectValueForKey(object.id, fieldApiName, oldValue, newValue);
      if (bareApiName !== fieldApiName) {
        await renameMultiSelectValueForKey(object.id, bareApiName, oldValue, newValue);
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
      // Multi-select values may be stored as a ";"-joined string or a jsonb array.
      await clearMultiSelectValueForKey(object.id, fieldApiName, value);
      if (bareApiName !== fieldApiName) {
        await clearMultiSelectValueForKey(object.id, bareApiName, value);
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

  // Reconcile every record's stored value(s) against the field's current option
  // list. Session-scoped rename/clear detection (above) only catches removals
  // made in the same edit that triggered it — it can't retroactively clean up
  // options that drifted out of the master list in past sessions (e.g. before
  // this sync existed, or before a bug prevented it from running). This purge
  // is unconditional: any stored value not in `validValues` is stripped.
  app.post('/objects/:apiName/fields/:fieldApiName/purge-stale-values', async (req, reply) => {
    const { apiName, fieldApiName } = req.params as { apiName: string; fieldApiName: string };
    const { validValues, isMultiSelect: clientMulti } = req.body as {
      validValues: string[];
      isMultiSelect?: boolean;
    };
    if (!Array.isArray(validValues)) {
      return reply.code(400).send({ error: 'validValues array is required' });
    }

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });
    if (!object) return reply.code(404).send({ error: 'Object not found' });

    let isMultiSelect = clientMulti ?? false;
    if (clientMulti === undefined) {
      const field = await prisma.customField.findFirst({ where: { objectId: object.id, apiName: fieldApiName } });
      if (field) isMultiSelect = field.type === 'MultiPicklist' || field.type === 'MultiSelectPicklist';
    }

    const bareApiName = fieldApiName.replace(/^[A-Za-z]+__/, '');
    const keys = bareApiName !== fieldApiName ? [fieldApiName, bareApiName] : [fieldApiName];
    const validSet = new Set(validValues);

    const records = await prisma.record.findMany({
      where: { objectId: object.id, deletedAt: null },
      select: { id: true, data: true },
    });

    let updatedCount = 0;
    for (const record of records) {
      const data = record.data as Record<string, any>;
      const newData: Record<string, any> = { ...data };
      let changed = false;

      for (const key of keys) {
        if (!(key in data)) continue;
        const raw = data[key];

        if (isMultiSelect) {
          const values: string[] = Array.isArray(raw)
            ? raw.map((v) => String(v))
            : String(raw).split(';');
          const filtered = values.map((v) => v.trim()).filter((v) => v && validSet.has(v));
          const nextValue = filtered.join(';');
          const currentValue = Array.isArray(raw) ? raw.join(';') : String(raw ?? '');
          if (nextValue !== currentValue) {
            newData[key] = nextValue;
            changed = true;
          }
        } else if (raw !== undefined && raw !== null && raw !== '' && !validSet.has(String(raw))) {
          delete newData[key];
          changed = true;
        }
      }

      if (changed) {
        await prisma.record.update({ where: { id: record.id }, data: { data: newData } });
        updatedCount++;
      }
    }

    reply.send({ ok: true, updatedCount });
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
