// src/server.ts
import path3 from "path";
import dotenv2 from "dotenv";
import { fileURLToPath as fileURLToPath3 } from "url";

// src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import serveStatic from "@fastify/static";
import path2 from "path";
import fs from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
import { dirname } from "path";
import { prisma as prisma8 } from "@crm/db/client";
import { z as z6 } from "zod";

// src/auth.ts
import crypto from "crypto";
import { prisma } from "@crm/db/client";
var ITERATIONS = 31e4;
var KEYLEN = 32;
var DIGEST = "sha256";
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return `pbkdf2$${ITERATIONS}$${DIGEST}$${salt}$${derived}`;
}
function verifyPassword(password, stored) {
  try {
    const parts = stored.split("$");
    if (parts.length !== 5) return false;
    const [algo, iterStr, digest, salt, keyHex] = parts;
    if (!algo || !algo.startsWith("pbkdf2")) return false;
    const iter = Number(iterStr) || ITERATIONS;
    if (!salt || !keyHex) return false;
    const derivedHex = crypto.pbkdf2Sync(password, salt, iter, KEYLEN, digest).toString("hex");
    const keyBuf = new Uint8Array(Buffer.from(keyHex, "hex"));
    const derivedBuf = new Uint8Array(Buffer.from(derivedHex, "hex"));
    if (keyBuf.byteLength !== derivedBuf.byteLength) return false;
    return crypto.timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}
function base64urlStr(str) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64urlBuffer(buf) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function signJwt(payload, secret, ttlSeconds = 3600) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1e3) + ttlSeconds;
  const full = { ...payload, exp };
  const encHeader = base64urlStr(JSON.stringify(header));
  const encPayload = base64urlStr(JSON.stringify(full));
  const data = `${encHeader}.${encPayload}`;
  const signatureRaw = crypto.createHmac("sha256", secret).update(data).digest();
  const signature = base64urlBuffer(signatureRaw);
  return `${data}.${signature}`;
}
function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expectedSig = base64urlBuffer(crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest());
  if (expectedSig !== s) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, "base64").toString("utf8"));
    if (payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
async function authenticate(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return null;
  return verifyPassword(password, user.passwordHash) ? user : null;
}

// src/config.ts
import { z } from "zod";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
var EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.string().optional().default("4000"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL")
});
function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const message = Object.entries(flat).map(([k, v]) => `${k}: ${v?.join(", ")}`).join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return parsed.data;
}

// src/routes/objects.ts
import { prisma as prisma2 } from "@crm/db/client";
import { z as z2 } from "zod";
var createObjectSchema = z2.object({
  apiName: z2.string().min(1).regex(/^[A-Z][A-Za-z0-9_]*$/),
  label: z2.string().min(1),
  pluralLabel: z2.string().min(1),
  description: z2.string().optional(),
  enableHistory: z2.boolean().optional(),
  enableSearch: z2.boolean().optional()
});
var updateObjectSchema = createObjectSchema.partial();
async function objectRoutes(app2) {
  app2.get("/objects", async (req, reply) => {
    const objects = await prisma2.customObject.findMany({
      where: { isActive: true },
      include: {
        fields: {
          where: { isActive: true },
          include: {
            relationship: {
              include: {
                parentObject: true,
                childObject: true
              }
            }
          }
        },
        pageLayouts: {
          where: { isActive: true },
          include: {
            tabs: {
              include: {
                sections: {
                  include: {
                    fields: {
                      include: {
                        field: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { label: "asc" }
    });
    reply.send(objects);
  });
  app2.get("/objects/:apiName", async (req, reply) => {
    const { apiName } = req.params;
    const object = await prisma2.customObject.findUnique({
      where: { apiName },
      include: {
        fields: {
          where: { isActive: true },
          include: {
            relationship: {
              include: {
                parentObject: true,
                childObject: true
              }
            }
          }
        },
        pageLayouts: {
          where: { isActive: true },
          include: {
            tabs: {
              include: {
                sections: {
                  include: {
                    fields: {
                      include: {
                        field: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    reply.send(object);
  });
  app2.post("/objects", async (req, reply) => {
    const parsed = createObjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }
    const userId = req.user.sub;
    const object = await prisma2.customObject.create({
      data: {
        ...parsed.data,
        createdById: userId,
        modifiedById: userId
      },
      include: {
        fields: true,
        pageLayouts: true
      }
    });
    reply.code(201).send(object);
  });
  app2.put("/objects/:apiName", async (req, reply) => {
    const { apiName } = req.params;
    const parsed = updateObjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }
    const userId = req.user.sub;
    const object = await prisma2.customObject.update({
      where: { apiName },
      data: {
        ...parsed.data,
        modifiedById: userId
      },
      include: {
        fields: true,
        pageLayouts: true
      }
    });
    reply.send(object);
  });
  app2.delete("/objects/:apiName", async (req, reply) => {
    const { apiName } = req.params;
    const userId = req.user.sub;
    await prisma2.customObject.update({
      where: { apiName },
      data: {
        isActive: false,
        modifiedById: userId
      }
    });
    reply.code(204).send();
  });
}

// src/routes/fields.ts
import { prisma as prisma3 } from "@crm/db/client";
import { z as z3 } from "zod";
var createFieldSchema = z3.object({
  objectApiName: z3.string(),
  apiName: z3.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z3.string().min(1),
  type: z3.string(),
  description: z3.string().optional(),
  helpText: z3.string().optional(),
  required: z3.boolean().optional(),
  unique: z3.boolean().optional(),
  readOnly: z3.boolean().optional(),
  maxLength: z3.number().optional(),
  minLength: z3.number().optional(),
  scale: z3.number().optional(),
  precision: z3.number().optional(),
  min: z3.number().optional(),
  max: z3.number().optional(),
  picklistValues: z3.array(z3.string()).optional(),
  defaultValue: z3.string().optional()
});
var updateFieldSchema = createFieldSchema.omit({ objectApiName: true }).partial();
async function fieldRoutes(app2) {
  app2.get("/objects/:apiName/fields", async (req, reply) => {
    const { apiName } = req.params;
    const object = await prisma3.customObject.findUnique({
      where: { apiName },
      include: {
        fields: {
          where: { isActive: true },
          include: {
            relationship: {
              include: {
                parentObject: true,
                childObject: true
              }
            }
          },
          orderBy: { label: "asc" }
        }
      }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    reply.send(object.fields);
  });
  app2.post("/objects/:apiName/fields", async (req, reply) => {
    const { apiName } = req.params;
    const parsed = createFieldSchema.safeParse({ ...req.body, objectApiName: apiName });
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }
    const userId = req.user.sub;
    const object = await prisma3.customObject.findUnique({
      where: { apiName }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const field = await prisma3.customField.create({
      data: {
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
        modifiedById: userId
      },
      include: {
        relationship: true
      }
    });
    reply.code(201).send(field);
  });
  app2.put("/objects/:apiName/fields/:fieldApiName", async (req, reply) => {
    const { apiName, fieldApiName } = req.params;
    const parsed = updateFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }
    const userId = req.user.sub;
    const object = await prisma3.customObject.findUnique({
      where: { apiName }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const updateData = {
      ...parsed.data,
      modifiedById: userId
    };
    if (parsed.data.picklistValues) {
      updateData.picklistValues = JSON.stringify(parsed.data.picklistValues);
    }
    const field = await prisma3.customField.update({
      where: {
        objectId_apiName: {
          objectId: object.id,
          apiName: fieldApiName
        }
      },
      data: updateData,
      include: {
        relationship: true
      }
    });
    reply.send(field);
  });
  app2.delete("/objects/:apiName/fields/:fieldApiName", async (req, reply) => {
    const { apiName, fieldApiName } = req.params;
    const userId = req.user.sub;
    const object = await prisma3.customObject.findUnique({
      where: { apiName }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    await prisma3.customField.update({
      where: {
        objectId_apiName: {
          objectId: object.id,
          apiName: fieldApiName
        }
      },
      data: {
        isActive: false,
        modifiedById: userId
      }
    });
    reply.code(204).send();
  });
}

// src/routes/layouts.ts
import { prisma as prisma4 } from "@crm/db/client";
import { z as z4 } from "zod";
var layoutFieldSchema = z4.object({
  fieldApiName: z4.string(),
  column: z4.number(),
  order: z4.number()
});
var layoutSectionSchema = z4.object({
  label: z4.string(),
  columns: z4.number().min(1).max(3),
  order: z4.number(),
  fields: z4.array(layoutFieldSchema)
});
var layoutTabSchema = z4.object({
  label: z4.string(),
  order: z4.number(),
  sections: z4.array(layoutSectionSchema)
});
var createLayoutSchema = z4.object({
  objectApiName: z4.string(),
  name: z4.string().min(1),
  layoutType: z4.string(),
  isDefault: z4.boolean().optional(),
  tabs: z4.array(layoutTabSchema)
});
var updateLayoutSchema = createLayoutSchema.omit({ objectApiName: true }).partial();
async function layoutRoutes(app2) {
  app2.get("/objects/:apiName/layouts", async (req, reply) => {
    const { apiName } = req.params;
    const object = await prisma4.customObject.findUnique({
      where: { apiName },
      include: {
        pageLayouts: {
          where: { isActive: true },
          include: {
            tabs: {
              include: {
                sections: {
                  include: {
                    fields: {
                      include: {
                        field: true
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    reply.send(object.pageLayouts);
  });
  app2.get("/layouts/:layoutId", async (req, reply) => {
    const { layoutId } = req.params;
    const layout = await prisma4.pageLayout.findUnique({
      where: { id: layoutId },
      include: {
        tabs: {
          include: {
            sections: {
              include: {
                fields: {
                  include: {
                    field: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!layout) {
      return reply.code(404).send({ error: "Layout not found" });
    }
    reply.send(layout);
  });
  app2.post("/objects/:apiName/layouts", async (req, reply) => {
    const { apiName } = req.params;
    const parsed = createLayoutSchema.safeParse({ ...req.body, objectApiName: apiName });
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }
    const userId = req.user.sub;
    const object = await prisma4.customObject.findUnique({
      where: { apiName },
      include: {
        fields: true
      }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const layout = await prisma4.pageLayout.create({
      data: {
        objectId: object.id,
        name: parsed.data.name,
        layoutType: parsed.data.layoutType,
        isDefault: parsed.data.isDefault ?? false,
        createdById: userId,
        modifiedById: userId,
        tabs: {
          create: parsed.data.tabs.map((tab) => ({
            label: tab.label,
            order: tab.order,
            sections: {
              create: tab.sections.map((section) => ({
                label: section.label,
                columns: section.columns,
                order: section.order,
                fields: {
                  create: section.fields.map((field) => {
                    const fieldDef = object.fields.find((f) => f.apiName === field.fieldApiName);
                    if (!fieldDef) {
                      throw new Error(`Field ${field.fieldApiName} not found`);
                    }
                    return {
                      fieldId: fieldDef.id,
                      column: field.column,
                      order: field.order
                    };
                  })
                }
              }))
            }
          }))
        }
      },
      include: {
        tabs: {
          include: {
            sections: {
              include: {
                fields: {
                  include: {
                    field: true
                  }
                }
              }
            }
          }
        }
      }
    });
    reply.code(201).send(layout);
  });
  app2.put("/layouts/:layoutId", async (req, reply) => {
    const { layoutId } = req.params;
    const parsed = updateLayoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }
    const userId = req.user.sub;
    const existingLayout = await prisma4.pageLayout.findUnique({
      where: { id: layoutId },
      include: {
        object: {
          include: {
            fields: true
          }
        },
        tabs: {
          include: {
            sections: {
              include: {
                fields: true
              }
            }
          }
        }
      }
    });
    if (!existingLayout) {
      return reply.code(404).send({ error: "Layout not found" });
    }
    await prisma4.layoutTab.deleteMany({
      where: { layoutId }
    });
    const layout = await prisma4.pageLayout.update({
      where: { id: layoutId },
      data: {
        name: parsed.data.name,
        layoutType: parsed.data.layoutType,
        isDefault: parsed.data.isDefault,
        modifiedById: userId,
        ...parsed.data.tabs && {
          tabs: {
            create: parsed.data.tabs.map((tab) => ({
              label: tab.label,
              order: tab.order,
              sections: {
                create: tab.sections.map((section) => ({
                  label: section.label,
                  columns: section.columns,
                  order: section.order,
                  fields: {
                    create: section.fields.map((field) => {
                      const fieldDef = existingLayout.object.fields.find(
                        (f) => f.apiName === field.fieldApiName
                      );
                      if (!fieldDef) {
                        throw new Error(`Field ${field.fieldApiName} not found`);
                      }
                      return {
                        fieldId: fieldDef.id,
                        column: field.column,
                        order: field.order
                      };
                    })
                  }
                }))
              }
            }))
          }
        }
      },
      include: {
        tabs: {
          include: {
            sections: {
              include: {
                fields: {
                  include: {
                    field: true
                  }
                }
              }
            }
          }
        }
      }
    });
    reply.send(layout);
  });
  app2.delete("/layouts/:layoutId", async (req, reply) => {
    const { layoutId } = req.params;
    const userId = req.user.sub;
    await prisma4.pageLayout.update({
      where: { id: layoutId },
      data: {
        isActive: false,
        modifiedById: userId
      }
    });
    reply.code(204).send();
  });
}

// src/routes/records.ts
import { prisma as prisma5 } from "@crm/db/client";
async function recordRoutes(app2) {
  app2.get("/objects/:apiName/records", async (req, reply) => {
    const { apiName } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const object = await prisma5.customObject.findUnique({
      where: { apiName }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const records = await prisma5.record.findMany({
      where: { objectId: object.id },
      include: {
        pageLayout: {
          select: {
            id: true,
            name: true,
            layoutType: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      skip: Number(offset)
    });
    reply.send(records);
  });
  app2.get("/objects/:apiName/records/:recordId", async (req, reply) => {
    const { apiName, recordId } = req.params;
    const object = await prisma5.customObject.findUnique({
      where: { apiName }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const record = await prisma5.record.findFirst({
      where: {
        id: recordId,
        objectId: object.id
      },
      include: {
        pageLayout: {
          select: {
            id: true,
            name: true,
            layoutType: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    if (!record) {
      return reply.code(404).send({ error: "Record not found" });
    }
    reply.send(record);
  });
  app2.post("/objects/:apiName/records", async (req, reply) => {
    const { apiName } = req.params;
    const { data, pageLayoutId } = req.body;
    const userId = req.user.sub;
    const object = await prisma5.customObject.findUnique({
      where: { apiName },
      include: {
        fields: {
          where: { isActive: true }
        }
      }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const requiredFields = object.fields.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !data[f.apiName]);
    if (missingFields.length > 0) {
      return reply.code(400).send({
        error: "Missing required fields",
        fields: missingFields.map((f) => f.apiName)
      });
    }
    if (pageLayoutId) {
      const layout = await prisma5.pageLayout.findFirst({
        where: {
          id: pageLayoutId,
          objectId: object.id
        }
      });
      if (!layout) {
        return reply.code(400).send({
          error: "Invalid page layout for this object"
        });
      }
    }
    const record = await prisma5.record.create({
      data: {
        objectId: object.id,
        data,
        pageLayoutId: pageLayoutId || null,
        createdById: userId,
        modifiedById: userId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    reply.code(201).send(record);
  });
  app2.put("/objects/:apiName/records/:recordId", async (req, reply) => {
    const { apiName, recordId } = req.params;
    const data = req.body;
    const userId = req.user.sub;
    const object = await prisma5.customObject.findUnique({
      where: { apiName },
      include: {
        fields: {
          where: { isActive: true }
        }
      }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const existingRecord = await prisma5.record.findFirst({
      where: {
        id: recordId,
        objectId: object.id
      }
    });
    if (!existingRecord) {
      return reply.code(404).send({ error: "Record not found" });
    }
    const mergedData = {
      ...existingRecord.data,
      ...data
    };
    const record = await prisma5.record.update({
      where: { id: recordId },
      data: {
        data: mergedData,
        modifiedById: userId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    reply.send(record);
  });
  app2.delete("/objects/:apiName/records/:recordId", async (req, reply) => {
    const { apiName, recordId } = req.params;
    const object = await prisma5.customObject.findUnique({
      where: { apiName }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const existingRecord = await prisma5.record.findFirst({
      where: {
        id: recordId,
        objectId: object.id
      }
    });
    if (!existingRecord) {
      return reply.code(404).send({ error: "Record not found" });
    }
    await prisma5.record.delete({
      where: { id: recordId }
    });
    reply.code(204).send();
  });
  app2.get("/objects/:apiName/records/search", async (req, reply) => {
    const { apiName } = req.params;
    const { q } = req.query;
    const object = await prisma5.customObject.findUnique({
      where: { apiName }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    if (!q) {
      return reply.send([]);
    }
    const records = await prisma5.record.findMany({
      where: {
        objectId: object.id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      take: 20
    });
    const searchTerm = q.toLowerCase();
    const filtered = records.filter((record) => {
      const data = record.data;
      return Object.values(data).some(
        (value) => String(value).toLowerCase().includes(searchTerm)
      );
    });
    reply.send(filtered);
  });
}

// src/routes/reports.ts
import { prisma as prisma6 } from "@crm/db/client";
import { z as z5 } from "zod";
var reportSchema = z5.object({
  name: z5.string().min(1),
  description: z5.string().optional(),
  objectType: z5.string(),
  format: z5.enum(["tabular", "summary", "matrix"]),
  fields: z5.array(z5.string()),
  filters: z5.array(z5.any()),
  groupBy: z5.string().optional(),
  sortBy: z5.string().optional(),
  sortOrder: z5.enum(["asc", "desc"]).optional(),
  isPrivate: z5.boolean().optional(),
  sharedWith: z5.array(z5.string()).optional(),
  isFavorite: z5.boolean().optional(),
  folderId: z5.string().optional()
});
async function reportRoutes(app2) {
  app2.get("/reports", async (req, reply) => {
    const {
      objectType,
      format,
      isPrivate,
      isFavorite,
      createdByMe,
      folderId
    } = req.query;
    const userId = req.user?.id || "default-user-id";
    const where = {};
    if (objectType) where.objectType = objectType;
    if (format) where.format = format;
    if (isPrivate) where.isPrivate = isPrivate === "true";
    if (isFavorite) where.isFavorite = isFavorite === "true";
    if (createdByMe === "true") where.createdById = userId;
    if (folderId) where.folderId = folderId;
    const reports = await prisma6.report.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        folder: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });
    reply.send(reports);
  });
  app2.get("/reports/:id", async (req, reply) => {
    const { id } = req.params;
    const report = await prisma6.report.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        folder: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    if (!report) {
      return reply.code(404).send({ error: "Report not found" });
    }
    reply.send(report);
  });
  app2.post("/reports", async (req, reply) => {
    const userId = req.user?.id || "default-user-id";
    try {
      const data = reportSchema.parse(req.body);
      const report = await prisma6.report.create({
        data: {
          ...data,
          sharedWith: data.sharedWith || [],
          createdById: userId,
          modifiedById: userId
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          modifiedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      reply.code(201).send(report);
    } catch (error) {
      if (error instanceof z5.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      throw error;
    }
  });
  app2.put("/reports/:id", async (req, reply) => {
    const { id } = req.params;
    const userId = req.user?.id || "default-user-id";
    try {
      const data = reportSchema.partial().parse(req.body);
      const report = await prisma6.report.update({
        where: { id },
        data: {
          ...data,
          modifiedById: userId
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          modifiedBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      reply.send(report);
    } catch (error) {
      if (error instanceof z5.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      throw error;
    }
  });
  app2.patch("/reports/:id/favorite", async (req, reply) => {
    const { id } = req.params;
    const report = await prisma6.report.findUnique({
      where: { id },
      select: { isFavorite: true }
    });
    if (!report) {
      return reply.code(404).send({ error: "Report not found" });
    }
    const updated = await prisma6.report.update({
      where: { id },
      data: { isFavorite: !report.isFavorite },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    reply.send(updated);
  });
  app2.patch("/reports/:id/private", async (req, reply) => {
    const { id } = req.params;
    const report = await prisma6.report.findUnique({
      where: { id },
      select: { isPrivate: true }
    });
    if (!report) {
      return reply.code(404).send({ error: "Report not found" });
    }
    const updated = await prisma6.report.update({
      where: { id },
      data: { isPrivate: !report.isPrivate },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    reply.send(updated);
  });
  app2.post("/reports/:id/share", async (req, reply) => {
    const { id } = req.params;
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails)) {
      return reply.code(400).send({ error: "emails array is required" });
    }
    const report = await prisma6.report.findUnique({
      where: { id }
    });
    if (!report) {
      return reply.code(404).send({ error: "Report not found" });
    }
    const currentSharedWith = report.sharedWith || [];
    const newSharedWith = [.../* @__PURE__ */ new Set([...currentSharedWith, ...emails])];
    const updated = await prisma6.report.update({
      where: { id },
      data: {
        sharedWith: newSharedWith,
        isPrivate: false
        // Sharing makes it non-private
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    reply.send(updated);
  });
  app2.delete("/reports/:id", async (req, reply) => {
    const { id } = req.params;
    try {
      await prisma6.report.delete({
        where: { id }
      });
      reply.code(204).send();
    } catch (error) {
      return reply.code(404).send({ error: "Report not found" });
    }
  });
  app2.get("/reports/folders", async (req, reply) => {
    const userId = req.user?.id || "default-user-id";
    const folders = await prisma6.reportFolder.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            reports: true,
            children: true
          }
        }
      },
      orderBy: { name: "asc" }
    });
    reply.send(folders);
  });
  app2.post("/reports/folders", async (req, reply) => {
    const userId = req.user?.id || "default-user-id";
    const { name, description, parentId, isPrivate } = req.body;
    if (!name) {
      return reply.code(400).send({ error: "name is required" });
    }
    const folder = await prisma6.reportFolder.create({
      data: {
        name,
        description,
        parentId,
        isPrivate: isPrivate || false,
        createdById: userId,
        modifiedById: userId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    reply.code(201).send(folder);
  });
  app2.put("/reports/folders/:id", async (req, reply) => {
    const { id } = req.params;
    const userId = req.user?.id || "default-user-id";
    const { name, description, parentId, isPrivate } = req.body;
    const folder = await prisma6.reportFolder.update({
      where: { id },
      data: {
        name,
        description,
        parentId,
        isPrivate,
        modifiedById: userId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    reply.send(folder);
  });
  app2.delete("/reports/folders/:id", async (req, reply) => {
    const { id } = req.params;
    try {
      await prisma6.reportFolder.delete({
        where: { id }
      });
      reply.code(204).send();
    } catch (error) {
      return reply.code(404).send({ error: "Folder not found" });
    }
  });
}

// src/routes/dashboards.ts
import { prisma as prisma7 } from "@crm/db/client";
async function dashboardRoutes(app2) {
  app2.get("/dashboards", async (request, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const dashboards = await prisma7.dashboard.findMany({
        where: {
          OR: [
            { createdById: userId },
            { isPrivate: false }
          ]
        },
        include: {
          widgets: {
            orderBy: { positionY: "asc" }
          },
          createdBy: {
            select: { id: true, email: true, name: true }
          }
        },
        orderBy: { updatedAt: "desc" }
      });
      return reply.send(dashboards);
    } catch (error) {
      console.error("Error fetching dashboards:", error);
      return reply.status(500).send({ error: "Failed to fetch dashboards" });
    }
  });
  app2.post("/dashboards", async (request, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { name, description, widgets = [] } = request.body;
      if (!name) {
        return reply.status(400).send({ error: "Dashboard name is required" });
      }
      const dashboard = await prisma7.dashboard.create({
        data: {
          name,
          description,
          createdById: userId,
          modifiedById: userId,
          widgets: {
            create: widgets.map((widget) => ({
              type: widget.type,
              title: widget.title,
              dataSource: widget.dataSource,
              reportId: widget.reportId,
              config: widget.config || {},
              positionX: widget.position?.x || 0,
              positionY: widget.position?.y || 0,
              width: widget.position?.w || 4,
              height: widget.position?.h || 2
            }))
          }
        },
        include: {
          widgets: true,
          createdBy: {
            select: { id: true, email: true, name: true }
          }
        }
      });
      return reply.status(201).send(dashboard);
    } catch (error) {
      console.error("Error creating dashboard:", error);
      return reply.status(500).send({ error: "Failed to create dashboard" });
    }
  });
  app2.get("/dashboards/:id", async (request, reply) => {
    try {
      const userId = request.user?.id;
      const { id } = request.params;
      const dashboard = await prisma7.dashboard.findUnique({
        where: { id },
        include: {
          widgets: {
            orderBy: { positionY: "asc" }
          },
          createdBy: {
            select: { id: true, email: true, name: true }
          }
        }
      });
      if (!dashboard) {
        return reply.status(404).send({ error: "Dashboard not found" });
      }
      if (dashboard.isPrivate && dashboard.createdById !== userId) {
        return reply.status(403).send({ error: "Access denied" });
      }
      return reply.send(dashboard);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      return reply.status(500).send({ error: "Failed to fetch dashboard" });
    }
  });
  app2.put("/dashboards/:id", async (request, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id } = request.params;
      const { name, description, isFavorite, widgets = [] } = request.body;
      const dashboard = await prisma7.dashboard.findUnique({
        where: { id },
        select: { createdById: true }
      });
      if (!dashboard || dashboard.createdById !== userId) {
        return reply.status(403).send({ error: "Access denied" });
      }
      const updated = await prisma7.dashboard.update({
        where: { id },
        data: {
          name,
          description,
          isFavorite,
          modifiedById: userId,
          widgets: {
            deleteMany: {},
            // Delete all existing widgets
            create: widgets.map((widget) => ({
              type: widget.type,
              title: widget.title,
              dataSource: widget.dataSource,
              reportId: widget.reportId,
              config: widget.config || {},
              positionX: widget.position?.x || 0,
              positionY: widget.position?.y || 0,
              width: widget.position?.w || 4,
              height: widget.position?.h || 2
            }))
          }
        },
        include: {
          widgets: true,
          createdBy: {
            select: { id: true, email: true, name: true }
          }
        }
      });
      return reply.send(updated);
    } catch (error) {
      console.error("Error updating dashboard:", error);
      return reply.status(500).send({ error: "Failed to update dashboard" });
    }
  });
  app2.delete("/dashboards/:id", async (request, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      const { id } = request.params;
      const dashboard = await prisma7.dashboard.findUnique({
        where: { id },
        select: { createdById: true }
      });
      if (!dashboard || dashboard.createdById !== userId) {
        return reply.status(403).send({ error: "Access denied" });
      }
      await prisma7.dashboard.delete({
        where: { id }
      });
      return reply.status(204).send();
    } catch (error) {
      console.error("Error deleting dashboard:", error);
      return reply.status(500).send({ error: "Failed to delete dashboard" });
    }
  });
  app2.get(
    "/dashboards/:id/widgets",
    async (request, reply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const { id } = request.params;
        const dashboard = await prisma7.dashboard.findUnique({
          where: { id },
          select: { createdById: true, isPrivate: true }
        });
        if (!dashboard) {
          return reply.status(404).send({ error: "Dashboard not found" });
        }
        if (dashboard.isPrivate && dashboard.createdById !== userId) {
          return reply.status(403).send({ error: "Access denied" });
        }
        const widgets = await prisma7.dashboardWidget.findMany({
          where: { dashboardId: id },
          orderBy: [{ positionY: "asc" }, { positionX: "asc" }]
        });
        return reply.send(widgets);
      } catch (error) {
        console.error("Error fetching widgets:", error);
        return reply.status(500).send({ error: "Failed to fetch widgets" });
      }
    }
  );
  app2.post(
    "/dashboards/:id/widgets",
    async (request, reply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const { id } = request.params;
        const { type, title, dataSource, reportId, config, position } = request.body;
        if (!type || !title || !dataSource) {
          return reply.status(400).send({
            error: "type, title, and dataSource are required"
          });
        }
        const dashboard = await prisma7.dashboard.findUnique({
          where: { id },
          select: { createdById: true }
        });
        if (!dashboard || dashboard.createdById !== userId) {
          return reply.status(403).send({ error: "Access denied" });
        }
        const widget = await prisma7.dashboardWidget.create({
          data: {
            dashboardId: id,
            type,
            title,
            dataSource,
            reportId: reportId || null,
            config: config || {},
            positionX: position?.x || 0,
            positionY: position?.y || 0,
            width: position?.w || 4,
            height: position?.h || 2
          }
        });
        return reply.status(201).send(widget);
      } catch (error) {
        console.error("Error creating widget:", error);
        return reply.status(500).send({ error: "Failed to create widget" });
      }
    }
  );
  app2.put(
    "/dashboards/:id/widgets/:widgetId",
    async (request, reply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const { id, widgetId } = request.params;
        const { type, title, dataSource, reportId, config, position } = request.body;
        const dashboard = await prisma7.dashboard.findUnique({
          where: { id },
          select: { createdById: true }
        });
        if (!dashboard || dashboard.createdById !== userId) {
          return reply.status(403).send({ error: "Access denied" });
        }
        const widget = await prisma7.dashboardWidget.findFirst({
          where: { id: widgetId, dashboardId: id }
        });
        if (!widget) {
          return reply.status(404).send({ error: "Widget not found" });
        }
        const updated = await prisma7.dashboardWidget.update({
          where: { id: widgetId },
          data: {
            ...type && { type },
            ...title && { title },
            ...dataSource && { dataSource },
            ...reportId !== void 0 && { reportId },
            ...config && { config },
            ...position && {
              positionX: position.x,
              positionY: position.y,
              width: position.w,
              height: position.h
            }
          }
        });
        return reply.send(updated);
      } catch (error) {
        console.error("Error updating widget:", error);
        return reply.status(500).send({ error: "Failed to update widget" });
      }
    }
  );
  app2.delete(
    "/dashboards/:id/widgets/:widgetId",
    async (request, reply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const { id, widgetId } = request.params;
        const dashboard = await prisma7.dashboard.findUnique({
          where: { id },
          select: { createdById: true }
        });
        if (!dashboard || dashboard.createdById !== userId) {
          return reply.status(403).send({ error: "Access denied" });
        }
        const widget = await prisma7.dashboardWidget.findFirst({
          where: { id: widgetId, dashboardId: id }
        });
        if (!widget) {
          return reply.status(404).send({ error: "Widget not found" });
        }
        await prisma7.dashboardWidget.delete({
          where: { id: widgetId }
        });
        return reply.status(204).send();
      } catch (error) {
        console.error("Error deleting widget:", error);
        return reply.status(500).send({ error: "Failed to delete widget" });
      }
    }
  );
}

// src/app.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname2 = dirname(__filename);
function buildApp() {
  const app2 = Fastify({ logger: true });
  app2.register(cors, { origin: true });
  const nextStaticPath = path2.join(__dirname2, "../../web/.next/static");
  if (fs.existsSync(nextStaticPath)) {
    app2.register(serveStatic, {
      root: nextStaticPath,
      prefix: "/_next/static/"
    });
  }
  app2.get("/health", async () => ({ ok: true }));
  app2.post("/auth/signup", async (req, reply) => {
    const schema = z6.object({
      name: z6.string().min(1),
      email: z6.string().email(),
      password: z6.string().min(6)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma8.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.code(409).send({ error: "Email already registered" });
    try {
      const passwordHash = hashPassword(parsed.data.password);
      const user = await prisma8.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          passwordHash,
          role: "USER"
        }
      });
      const env = loadEnv();
      const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 8);
      return reply.code(201).send({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
    } catch (err) {
      app2.log.error(err);
      return reply.code(500).send({ error: "Signup failed" });
    }
  });
  app2.post("/auth/login", async (req, reply) => {
    const schema = z6.object({
      email: z6.string().email(),
      password: z6.string().min(6),
      accountId: z6.string().uuid().optional().nullable()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });
    const env = loadEnv();
    const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 8);
    const forwardedFor = req.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const ip = (forwardedIp ? forwardedIp.split(",")[0].trim() : void 0) || req.ip || req.socket?.remoteAddress || "unknown";
    const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
    await prisma8.loginEvent.create({
      data: {
        userId: user.id,
        accountId: parsed.data.accountId ?? null,
        ip,
        userAgent
      }
    });
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
  app2.get("/security/login-events", async (req, reply) => {
    const querySchema = z6.object({
      accountId: z6.string().uuid().optional(),
      take: z6.coerce.number().int().min(1).max(500).optional()
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const events = await prisma8.loginEvent.findMany({
      where: parsed.data.accountId ? { accountId: parsed.data.accountId } : void 0,
      take: parsed.data.take ?? 100,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } }
      }
    });
    reply.send(events);
  });
  app2.addHook("onRequest", async (req, reply) => {
    if (req.routerPath && req.routerPath.startsWith("/auth")) return;
    if (req.routerPath === "/health") return;
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing bearer token" });
    }
    const token = auth.slice("Bearer ".length).trim();
    const env = loadEnv();
    const payload = verifyJwt(token, env.JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: "Invalid token" });
    req.user = payload;
  });
  app2.get("/accounts", async (req, reply) => {
    const accounts = await prisma8.account.findMany({ take: 50, orderBy: { createdAt: "desc" } });
    reply.send(accounts);
  });
  const accountSchema = z6.object({ name: z6.string().min(1), domain: z6.string().optional().nullable(), ownerId: z6.string().uuid() });
  app2.post("/accounts", async (req, reply) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const created = await prisma8.account.create({ data: parsed.data });
    reply.code(201).send(created);
  });
  const accountUpdate = accountSchema.partial();
  app2.put("/accounts/:id", async (req, reply) => {
    const id = req.params.id;
    const parsed = accountUpdate.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const updated = await prisma8.account.update({ where: { id }, data: parsed.data });
    reply.send(updated);
  });
  app2.delete("/accounts/:id", async (req, reply) => {
    const id = req.params.id;
    await prisma8.account.delete({ where: { id } });
    reply.code(204).send();
  });
  app2.register(objectRoutes);
  app2.register(fieldRoutes);
  app2.register(layoutRoutes);
  app2.register(recordRoutes);
  app2.register(reportRoutes);
  app2.register(dashboardRoutes);
  return app2;
}

// src/server.ts
var __dirname3 = path3.dirname(fileURLToPath3(import.meta.url));
dotenv2.config({ path: path3.resolve(__dirname3, "../.env") });
var port = Number(process.env.PORT || 4e3);
var app = buildApp();
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`API listening on ${port}`);
}).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
