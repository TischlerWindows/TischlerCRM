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
import { prisma as prisma17 } from "@crm/db/client";
import { z as z11 } from "zod";

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
    const object = await prisma2.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } },
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
    try {
      const allDepts = await prisma2.department.findMany({ select: { id: true, permissions: true } });
      const fullPerms = { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true };
      for (const dept of allDepts) {
        const perms = dept.permissions || {};
        if (perms.isAdmin) {
          const objPerms = perms.objectPermissions || {};
          objPerms[object.apiName] = fullPerms;
          await prisma2.department.update({
            where: { id: dept.id },
            data: { permissions: { ...perms, objectPermissions: objPerms } }
          });
        }
      }
    } catch (err) {
      console.error("Failed to auto-grant admin department permissions:", err);
    }
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
    const object = await prisma3.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } },
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
    const object = await prisma3.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } }
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
    const object = await prisma3.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } }
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
    const object = await prisma3.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } }
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
    const object = await prisma4.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } },
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
    const object = await prisma4.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } },
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
async function checkObjectPermission(userId, userRole, objectApiName, action) {
  if (userRole === "ADMIN") return true;
  const user = await prisma5.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      orgRole: true
    }
  });
  if (!user) return false;
  if (!user.department && !user.orgRole) return true;
  const deptRaw = user.department?.permissions || {};
  if (deptRaw.isAdmin) return true;
  const deptPerms = deptRaw.objectPermissions?.[objectApiName];
  if (user.department && deptPerms && action in deptPerms && !deptPerms[action]) {
    return false;
  }
  if (deptPerms?.[action]) return true;
  const rolePerms = user.orgRole?.permissions?.objectPermissions?.[objectApiName];
  if (rolePerms?.[action]) return true;
  return false;
}
async function recordRoutes(app2) {
  app2.get("/objects/:apiName/records", async (req, reply) => {
    const { apiName } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.sub;
    const userRole = req.user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, "read");
    if (!allowed) return reply.code(403).send({ error: "You do not have permission to view this object" });
    const object = await prisma5.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } }
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
    const userId = req.user.sub;
    const userRole = req.user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, "read");
    if (!allowed) return reply.code(403).send({ error: "You do not have permission to view this object" });
    const object = await prisma5.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } }
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
    req.log.info({ apiName, dataKeys: Object.keys(data || {}) }, "CREATE RECORD request");
    const userId = req.user.sub;
    const userRole = req.user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, "create");
    if (!allowed) return reply.code(403).send({ error: "You do not have permission to create records for this object" });
    const object = await prisma5.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } },
      include: {
        fields: {
          where: { isActive: true }
        }
      }
    });
    if (!object) {
      return reply.code(404).send({ error: "Object not found" });
    }
    const normalizedData = {};
    for (const [key, value] of Object.entries(data)) {
      normalizedData[key] = value;
      const stripped = key.replace(/^[A-Za-z]+__/, "");
      if (stripped !== key) {
        normalizedData[stripped] = value;
      }
    }
    const autoNumberFormats = {
      accountNumber: "A",
      propertyNumber: "P",
      contactNumber: "C",
      leadNumber: "LEAD",
      dealNumber: "DEAL",
      productCode: "PROD",
      projectNumber: "PRJ",
      quoteNumber: "QTE",
      serviceNumber: "SRV",
      installationNumber: "INST"
    };
    for (const field of object.fields) {
      if (field.apiName in autoNumberFormats && !normalizedData[field.apiName]) {
        const prefix = autoNumberFormats[field.apiName];
        const existing = await prisma5.record.findMany({
          where: { objectId: object.id },
          select: { data: true }
        });
        let maxNum = 0;
        for (const rec of existing) {
          const recData = rec.data;
          if (!recData) continue;
          const val = recData[field.apiName];
          if (typeof val === "string" && val.startsWith(`${prefix}-`)) {
            const num = parseInt(val.replace(`${prefix}-`, ""), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
        normalizedData[field.apiName] = `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
      }
    }
    const autoGeneratedFieldNames = new Set(Object.keys(autoNumberFormats));
    const requiredFields = object.fields.filter(
      (f) => f.required && !autoGeneratedFieldNames.has(f.apiName)
    );
    const camelPrefix = apiName.charAt(0).toLowerCase() + apiName.slice(1);
    const missingFields = requiredFields.filter((f) => {
      const nd = normalizedData;
      const direct = nd[f.apiName];
      const unprefixedKey = f.apiName.replace(/^[A-Za-z]+__/, "");
      const unprefixed = nd[unprefixedKey];
      const objectPrefixed = nd[`${apiName}__${f.apiName}`];
      const camelKey = `${camelPrefix}${f.apiName.charAt(0).toUpperCase()}${f.apiName.slice(1)}`;
      const camelCased = nd[camelKey];
      const compositeMatch = Object.keys(nd).some(
        (k) => k.endsWith(`_${f.apiName}`) && k.startsWith(`${apiName}__`) && nd[k] !== void 0 && nd[k] !== null
      );
      const hasValue = (v) => v !== void 0 && v !== null;
      return !hasValue(direct) && !hasValue(unprefixed) && !hasValue(objectPrefixed) && !hasValue(camelCased) && !compositeMatch;
    });
    if (missingFields.length > 0) {
      return reply.code(400).send({
        error: "Missing required fields",
        fields: missingFields.map((f) => f.apiName)
      });
    }
    const isValidUuid = pageLayoutId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageLayoutId);
    const record = await prisma5.record.create({
      data: {
        objectId: object.id,
        data: { ...normalizedData, ...pageLayoutId ? { _pageLayoutId: pageLayoutId } : {} },
        ...isValidUuid ? { pageLayoutId } : {},
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
    const body = req.body;
    const updateData = body.data || body;
    const userId = req.user.sub;
    const userRole = req.user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, "edit");
    if (!allowed) return reply.code(403).send({ error: "You do not have permission to edit records for this object" });
    const object = await prisma5.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } },
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
      ...updateData
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
    const userId = req.user.sub;
    const userRole = req.user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, "delete");
    if (!allowed) return reply.code(403).send({ error: "You do not have permission to delete records for this object" });
    const object = await prisma5.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } }
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
    const userId = req.user.sub;
    const userRole = req.user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, "read");
    if (!allowed) return reply.code(403).send({ error: "You do not have permission to view this object" });
    const object = await prisma5.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: "insensitive" } }
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

// src/routes/backup.ts
import { prisma as prisma8 } from "@crm/db/client";
async function backupRoutes(app2) {
  async function exportAllData() {
    const [
      users,
      objects,
      fields,
      relationships,
      layouts,
      layoutTabs,
      layoutSections,
      layoutFields,
      records,
      reports,
      dashboards,
      loginEvents
    ] = await Promise.all([
      prisma8.user.findMany(),
      prisma8.customObject.findMany(),
      prisma8.customField.findMany(),
      prisma8.relationship.findMany(),
      prisma8.pageLayout.findMany(),
      prisma8.layoutTab.findMany(),
      prisma8.layoutSection.findMany(),
      prisma8.layoutField.findMany(),
      prisma8.record.findMany(),
      prisma8.report.findMany(),
      prisma8.dashboard.findMany(),
      prisma8.loginEvent.findMany()
    ]);
    const tables = {
      users,
      objects,
      fields,
      relationships,
      layouts,
      layoutTabs,
      layoutSections,
      layoutFields,
      records,
      reports,
      dashboards,
      loginEvents
    };
    const counts = {};
    for (const [key, arr] of Object.entries(tables)) {
      counts[key] = arr.length;
    }
    return { tables, counts };
  }
  async function ensureBackupTable() {
    await prisma8.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BackupSnapshot" (
        "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "name"        TEXT NOT NULL,
        "data"        JSONB NOT NULL DEFAULT '{}',
        "sizeMB"      TEXT NOT NULL DEFAULT '0',
        "tables"      JSONB NOT NULL DEFAULT '{}',
        "status"      TEXT NOT NULL DEFAULT 'completed',
        "createdById" TEXT NOT NULL,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  app2.post("/admin/backup", async (req, reply) => {
    const userId = req.user.sub;
    try {
      await ensureBackupTable();
      const { tables, counts } = await exportAllData();
      const jsonStr = JSON.stringify(tables);
      const sizeMB = (Buffer.byteLength(jsonStr, "utf8") / 1024 / 1024).toFixed(2);
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const name = `backup-${timestamp}`;
      await prisma8.$executeRawUnsafe(
        `INSERT INTO "BackupSnapshot" ("id", "name", "data", "sizeMB", "tables", "status", "createdById", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2::jsonb, $3, $4::jsonb, 'completed', $5, NOW())`,
        name,
        jsonStr,
        sizeMB,
        JSON.stringify(counts),
        userId
      );
      await prisma8.$executeRawUnsafe(`
        DELETE FROM "BackupSnapshot"
        WHERE "id" NOT IN (
          SELECT "id" FROM "BackupSnapshot"
          ORDER BY "createdAt" DESC
          LIMIT 30
        )
      `);
      reply.send({
        success: true,
        name,
        sizeMB,
        tables: counts
      });
    } catch (error) {
      req.log.error(error, "Backup failed");
      reply.code(500).send({ error: error.message });
    }
  });
  app2.get("/admin/backups", async (req, reply) => {
    try {
      await ensureBackupTable();
      const backups = await prisma8.$queryRawUnsafe(`
        SELECT "id", "name", "sizeMB", "tables", "status", "createdById", "createdAt"
        FROM "BackupSnapshot"
        ORDER BY "createdAt" DESC
        LIMIT 50
      `);
      reply.send({ backups });
    } catch (error) {
      req.log.error(error, "Failed to list backups");
      reply.code(500).send({ error: error.message });
    }
  });
  app2.get("/admin/backups/:backupId", async (req, reply) => {
    const { backupId } = req.params;
    try {
      await ensureBackupTable();
      const rows = await prisma8.$queryRawUnsafe(
        `SELECT "id", "name", "data", "sizeMB", "tables", "status", "createdAt"
         FROM "BackupSnapshot" WHERE "id" = $1 LIMIT 1`,
        backupId
      );
      if (!rows.length) {
        return reply.code(404).send({ error: "Backup not found" });
      }
      const backup = rows[0];
      reply.header("Content-Type", "application/json").header("Content-Disposition", `attachment; filename="${backup.name}.json"`).send(backup.data);
    } catch (error) {
      req.log.error(error, "Failed to download backup");
      reply.code(500).send({ error: error.message });
    }
  });
  app2.delete("/admin/backups/:backupId", async (req, reply) => {
    const { backupId } = req.params;
    try {
      await ensureBackupTable();
      const result = await prisma8.$executeRawUnsafe(
        `DELETE FROM "BackupSnapshot" WHERE "id" = $1`,
        backupId
      );
      if (result === 0) {
        return reply.code(404).send({ error: "Backup not found" });
      }
      reply.send({ success: true });
    } catch (error) {
      req.log.error(error, "Failed to delete backup");
      reply.code(500).send({ error: error.message });
    }
  });
  app2.post("/admin/backups/:backupId/restore", async (req, reply) => {
    const { backupId } = req.params;
    try {
      await ensureBackupTable();
      const rows = await prisma8.$queryRawUnsafe(
        `SELECT "data" FROM "BackupSnapshot" WHERE "id" = $1 LIMIT 1`,
        backupId
      );
      if (!rows.length) {
        return reply.code(404).send({ error: "Backup not found" });
      }
      const data = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
      await prisma8.$transaction([
        prisma8.loginEvent.deleteMany(),
        prisma8.record.deleteMany(),
        prisma8.layoutField.deleteMany(),
        prisma8.layoutSection.deleteMany(),
        prisma8.layoutTab.deleteMany(),
        prisma8.pageLayout.deleteMany(),
        prisma8.relationship.deleteMany(),
        prisma8.customField.deleteMany(),
        prisma8.customObject.deleteMany(),
        prisma8.dashboard.deleteMany(),
        prisma8.report.deleteMany()
        // Note: Users are NOT deleted — we keep current users intact
      ]);
      if (data.objects?.length) {
        await prisma8.customObject.createMany({ data: data.objects, skipDuplicates: true });
      }
      if (data.fields?.length) {
        await prisma8.customField.createMany({ data: data.fields, skipDuplicates: true });
      }
      if (data.relationships?.length) {
        await prisma8.relationship.createMany({ data: data.relationships, skipDuplicates: true });
      }
      if (data.layouts?.length) {
        await prisma8.pageLayout.createMany({ data: data.layouts, skipDuplicates: true });
      }
      if (data.layoutTabs?.length) {
        await prisma8.layoutTab.createMany({ data: data.layoutTabs, skipDuplicates: true });
      }
      if (data.layoutSections?.length) {
        await prisma8.layoutSection.createMany({ data: data.layoutSections, skipDuplicates: true });
      }
      if (data.layoutFields?.length) {
        await prisma8.layoutField.createMany({ data: data.layoutFields, skipDuplicates: true });
      }
      if (data.records?.length) {
        await prisma8.record.createMany({ data: data.records, skipDuplicates: true });
      }
      if (data.reports?.length) {
        await prisma8.report.createMany({ data: data.reports, skipDuplicates: true });
      }
      if (data.dashboards?.length) {
        await prisma8.dashboard.createMany({ data: data.dashboards, skipDuplicates: true });
      }
      reply.send({ success: true, message: `Database restored from backup` });
    } catch (error) {
      req.log.error(error, "Restore failed");
      reply.code(500).send({ error: error.message });
    }
  });
}

// src/routes/settings.ts
import { prisma as prisma9 } from "@crm/db/client";
async function settingRoutes(app2) {
  app2.get("/settings", async (_req, reply) => {
    try {
      const settings = await prisma9.setting.findMany();
      const result = {};
      for (const s of settings) {
        result[s.key] = s.value;
      }
      reply.send(result);
    } catch (err) {
      app2.log.error(err, "GET /settings failed");
      reply.code(500).send({ error: "Failed to load settings", detail: err?.message });
    }
  });
  app2.get("/settings/:key", async (req, reply) => {
    try {
      const { key } = req.params;
      const setting = await prisma9.setting.findUnique({ where: { key } });
      if (!setting) {
        return reply.code(404).send({ error: "Setting not found" });
      }
      reply.send({ key: setting.key, value: setting.value });
    } catch (err) {
      app2.log.error(err, "GET /settings/:key failed");
      reply.code(500).send({ error: "Failed to load setting", detail: err?.message });
    }
  });
  app2.put("/settings/:key", async (req, reply) => {
    try {
      const { key } = req.params;
      const body = req.body;
      const setting = await prisma9.setting.upsert({
        where: { key },
        create: { key, value: body.value },
        update: { value: body.value }
      });
      reply.send({ key: setting.key, value: setting.value });
    } catch (err) {
      app2.log.error(err, "PUT /settings/:key failed");
      reply.code(500).send({ error: "Failed to save setting", detail: err?.message });
    }
  });
  app2.delete("/settings/:key", async (req, reply) => {
    const { key } = req.params;
    try {
      await prisma9.setting.delete({ where: { key } });
      reply.code(204).send();
    } catch {
      reply.code(404).send({ error: "Setting not found" });
    }
  });
}

// src/routes/preferences.ts
import { prisma as prisma10 } from "@crm/db/client";
async function preferenceRoutes(app2) {
  app2.get("/user/preferences", async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    try {
      const prefs = await prisma10.userPreference.findMany({
        where: { userId }
      });
      const result = {};
      for (const p of prefs) {
        result[p.key] = p.value;
      }
      reply.send(result);
    } catch (err) {
      app2.log.error(err, "GET /user/preferences failed");
      reply.code(500).send({ error: "Failed to load preferences", detail: err?.message });
    }
  });
  app2.get("/user/preferences/:key", async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const { key } = req.params;
    const pref = await prisma10.userPreference.findUnique({
      where: { userId_key: { userId, key } }
    });
    if (!pref) {
      return reply.code(404).send({ error: "Preference not found" });
    }
    reply.send({ key: pref.key, value: pref.value });
  });
  app2.put("/user/preferences/:key", async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const { key } = req.params;
    const body = req.body;
    const pref = await prisma10.userPreference.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value: body.value },
      update: { value: body.value }
    });
    reply.send({ key: pref.key, value: pref.value });
  });
  app2.delete("/user/preferences/:key", async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const { key } = req.params;
    try {
      await prisma10.userPreference.delete({
        where: { userId_key: { userId, key } }
      });
      reply.code(204).send();
    } catch {
      reply.code(404).send({ error: "Preference not found" });
    }
  });
  app2.put("/user/preferences", async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });
    const body = req.body;
    const results = {};
    for (const [key, value] of Object.entries(body)) {
      const pref = await prisma10.userPreference.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, value },
        update: { value }
      });
      results[pref.key] = pref.value;
    }
    reply.send(results);
  });
}

// src/routes/departments.ts
import { prisma as prisma12 } from "@crm/db/client";
import { z as z6 } from "zod";

// src/audit.ts
import { prisma as prisma11 } from "@crm/db/client";
var SENSITIVE_KEYS = /* @__PURE__ */ new Set([
  "passwordHash",
  "password",
  "token",
  "refreshToken",
  "secret",
  "apiKey",
  "api_key",
  "creditCard"
]);
function sanitize(obj) {
  if (!obj) return void 0;
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      cleaned[key] = "[REDACTED]";
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
function extractIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (forwardedStr ? forwardedStr.split(",")[0].trim() : void 0) || req.ip || req.socket?.remoteAddress || "unknown";
}
async function logAudit(params) {
  try {
    await prisma11.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        objectType: params.objectType,
        objectId: params.objectId,
        objectName: params.objectName,
        before: sanitize(params.before),
        after: sanitize(params.after),
        ipAddress: params.ipAddress
      }
    });
  } catch (err) {
    console.error("[Audit] Failed to write audit log:", err);
  }
}

// src/routes/departments.ts
var departmentSchema = z6.object({
  name: z6.string().min(1).max(200).trim(),
  description: z6.string().max(1e3).optional().nullable(),
  parentId: z6.string().uuid().optional().nullable(),
  isActive: z6.boolean().optional(),
  permissions: z6.any().optional()
});
var uuidParam = z6.object({ id: z6.string().uuid() });
async function departmentRoutes(app2) {
  app2.get("/departments", async (req, reply) => {
    const departments = await prisma12.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { users: true } }
      }
    });
    reply.send(departments.map((d) => ({ ...d, permissions: d.permissions || {} })));
  });
  app2.get("/departments/:id", async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid department ID" });
    const { id } = pp.data;
    const dept = await prisma12.department.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
          orderBy: { name: "asc" }
        },
        users: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true, isActive: true, title: true },
          orderBy: { name: "asc" }
        },
        _count: { select: { users: true } }
      }
    });
    if (!dept) return reply.code(404).send({ error: "Department not found" });
    reply.send(dept);
  });
  app2.post("/departments", async (req, reply) => {
    const parsed = departmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const dept = await prisma12.department.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        parentId: parsed.data.parentId,
        isActive: parsed.data.isActive ?? true,
        permissions: parsed.data.permissions || {}
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { users: true } }
      }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "CREATE",
      objectType: "Department",
      objectId: dept.id,
      objectName: dept.name,
      after: { name: dept.name, description: dept.description, parentId: dept.parentId },
      ipAddress: extractIp(req)
    });
    reply.code(201).send(dept);
  });
  app2.put("/departments/:id", async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid department ID" });
    const { id } = pp.data;
    const parsed = departmentSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma12.department.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Department not found" });
    if (parsed.data.parentId === id) {
      return reply.code(400).send({ error: "Department cannot be its own parent" });
    }
    const before = {};
    const after = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== void 0) {
        before[key] = existing[key];
        after[key] = value;
      }
    }
    const dept = await prisma12.department.update({
      where: { id },
      data: parsed.data,
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { users: true } }
      }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "UPDATE",
      objectType: "Department",
      objectId: dept.id,
      objectName: dept.name,
      before,
      after,
      ipAddress: extractIp(req)
    });
    reply.send(dept);
  });
  app2.delete("/departments/:id", async (req, reply) => {
    const pp = uuidParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid department ID" });
    const { id } = pp.data;
    const existing = await prisma12.department.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Department not found" });
    if (existing.deletedAt) return reply.code(400).send({ error: "Department is already deleted" });
    const userCount = await prisma12.user.count({ where: { departmentId: id, deletedAt: null } });
    if (userCount > 0) {
      return reply.code(409).send({ error: `Cannot delete department: ${userCount} users are assigned. Reassign them first.` });
    }
    const actorId = req.user.sub;
    await prisma12.department.update({
      where: { id },
      data: { deletedAt: /* @__PURE__ */ new Date(), deletedById: actorId, isActive: false }
    });
    await logAudit({
      actorId,
      action: "DELETE",
      objectType: "Department",
      objectId: id,
      objectName: existing.name,
      before: { name: existing.name, description: existing.description, isActive: existing.isActive },
      ipAddress: extractIp(req)
    });
    reply.code(204).send();
  });
}

// src/routes/users-admin.ts
import { prisma as prisma13 } from "@crm/db/client";
import { z as z7 } from "zod";
var createUserSchema = z7.object({
  name: z7.string().min(1).max(200).trim(),
  email: z7.string().email().max(255).toLowerCase(),
  password: z7.string().min(6).max(128),
  roleId: z7.string().uuid().optional().nullable(),
  departmentId: z7.string().uuid().optional().nullable(),
  managerId: z7.string().uuid().optional().nullable(),
  title: z7.string().max(200).optional().nullable(),
  phone: z7.string().max(50).optional().nullable(),
  mobilePhone: z7.string().max(50).optional().nullable(),
  timezone: z7.string().max(100).optional().nullable(),
  locale: z7.string().max(20).optional().nullable(),
  isActive: z7.boolean().optional()
}).strict();
var updateUserSchema = z7.object({
  name: z7.string().min(1).max(200).trim().optional(),
  roleId: z7.string().uuid().optional().nullable(),
  departmentId: z7.string().uuid().optional().nullable(),
  managerId: z7.string().uuid().optional().nullable(),
  title: z7.string().max(200).optional().nullable(),
  phone: z7.string().max(50).optional().nullable(),
  mobilePhone: z7.string().max(50).optional().nullable(),
  timezone: z7.string().max(100).optional().nullable(),
  locale: z7.string().max(20).optional().nullable(),
  isActive: z7.boolean().optional()
}).strict();
var uuidParam2 = z7.object({ id: z7.string().uuid() });
var listQuerySchema = z7.object({ includeDeleted: z7.enum(["true", "false"]).optional() });
var roleSelect = { select: { id: true, name: true, label: true } };
async function resolveSystemRole(roleId) {
  if (!roleId) return "USER";
  const orgRole = await prisma13.role.findUnique({ where: { id: roleId }, select: { name: true } });
  return orgRole?.name === "system_administrator" ? "ADMIN" : "USER";
}
async function usersAdminRoutes(app2) {
  app2.get("/admin/users", async (req, reply) => {
    const qParsed = listQuerySchema.safeParse(req.query);
    const includeDeleted = qParsed.success && qParsed.data.includeDeleted === "true";
    const where = includeDeleted ? {} : { deletedAt: null };
    const users = await prisma13.user.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        title: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        deletedAt: true,
        orgRole: roleSelect,
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } }
      }
    });
    reply.send(users);
  });
  app2.get("/admin/users/:id", async (req, reply) => {
    const pp = uuidParam2.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid user ID" });
    const { id } = pp.data;
    const user = await prisma13.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        title: true,
        phone: true,
        mobilePhone: true,
        timezone: true,
        locale: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        roleId: true,
        departmentId: true,
        managerId: true,
        deletedAt: true,
        orgRole: { select: { id: true, name: true, label: true, permissions: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } }
      }
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    reply.send(user);
  });
  app2.post("/admin/users", async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma13.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.code(409).send({ error: "Email already registered" });
    const passwordHash = hashPassword(parsed.data.password);
    const systemRole = await resolveSystemRole(parsed.data.roleId);
    const user = await prisma13.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: systemRole,
        roleId: parsed.data.roleId,
        departmentId: parsed.data.departmentId,
        managerId: parsed.data.managerId,
        title: parsed.data.title,
        phone: parsed.data.phone,
        mobilePhone: parsed.data.mobilePhone,
        timezone: parsed.data.timezone || "America/New_York",
        locale: parsed.data.locale || "en_US",
        isActive: parsed.data.isActive ?? true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        orgRole: roleSelect,
        department: { select: { id: true, name: true } }
      }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "CREATE",
      objectType: "User",
      objectId: user.id,
      objectName: user.name || user.email,
      after: { email: parsed.data.email, name: parsed.data.name, roleId: parsed.data.roleId, departmentId: parsed.data.departmentId },
      ipAddress: extractIp(req)
    });
    reply.code(201).send(user);
  });
  app2.put("/admin/users/:id", async (req, reply) => {
    const pp = uuidParam2.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid user ID" });
    const { id } = pp.data;
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma13.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "User not found" });
    const before = {};
    const after = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== void 0) {
        before[key] = existing[key];
        after[key] = value;
      }
    }
    const roleUpdate = {};
    if (parsed.data.roleId !== void 0) {
      roleUpdate.role = await resolveSystemRole(parsed.data.roleId);
    }
    const user = await prisma13.user.update({
      where: { id },
      data: { ...parsed.data, ...roleUpdate },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        title: true,
        orgRole: roleSelect,
        department: { select: { id: true, name: true } }
      }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "UPDATE",
      objectType: "User",
      objectId: user.id,
      objectName: user.name || user.email,
      before,
      after,
      ipAddress: extractIp(req)
    });
    reply.send(user);
  });
  app2.post("/admin/users/:id/reset-password", async (req, reply) => {
    const pp = uuidParam2.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid user ID" });
    const { id } = pp.data;
    const bodySchema = z7.object({ password: z7.string().min(6).max(128) });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Password must be at least 6 characters" });
    const existing = await prisma13.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "User not found" });
    const passwordHash = hashPassword(parsed.data.password);
    await prisma13.user.update({ where: { id }, data: { passwordHash } });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "RESET_PASSWORD",
      objectType: "User",
      objectId: id,
      objectName: existing.name || existing.email,
      ipAddress: extractIp(req)
    });
    reply.send({ success: true });
  });
  app2.delete("/admin/users/:id", async (req, reply) => {
    const pp = uuidParam2.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid user ID" });
    const { id } = pp.data;
    const existing = await prisma13.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "User not found" });
    if (existing.deletedAt) return reply.code(400).send({ error: "User is already deleted" });
    const actorId = req.user.sub;
    await prisma13.user.update({
      where: { id },
      data: { deletedAt: /* @__PURE__ */ new Date(), deletedById: actorId, isActive: false }
    });
    await logAudit({
      actorId,
      action: "DELETE",
      objectType: "User",
      objectId: id,
      objectName: existing.name || existing.email,
      before: { email: existing.email, name: existing.name, isActive: existing.isActive },
      ipAddress: extractIp(req)
    });
    reply.code(204).send();
  });
  app2.post("/admin/users/:id/freeze", async (req, reply) => {
    const pp = uuidParam2.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid user ID" });
    const { id } = pp.data;
    const existing = await prisma13.user.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "User not found" });
    const newActive = !existing.isActive;
    const user = await prisma13.user.update({
      where: { id },
      data: { isActive: newActive },
      select: { id: true, isActive: true }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: newActive ? "UNFREEZE" : "FREEZE",
      objectType: "User",
      objectId: id,
      objectName: existing.name || existing.email,
      before: { isActive: existing.isActive },
      after: { isActive: newActive },
      ipAddress: extractIp(req)
    });
    reply.send(user);
  });
  app2.get("/admin/users/:id/permissions", async (req, reply) => {
    const pp = uuidParam2.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: "Invalid user ID" });
    const { id } = pp.data;
    const user = await prisma13.user.findUnique({
      where: { id },
      include: {
        orgRole: true,
        department: true
      }
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    const rolePerms = user.orgRole?.permissions || {};
    const objectPerms = { ...rolePerms.objectPermissions || {} };
    const appPerms = { ...rolePerms.appPermissions || {} };
    const deptPerms = user.department?.permissions || {};
    if (deptPerms.isAdmin) {
      const allActions = ["read", "create", "edit", "delete", "viewAll", "modifyAll"];
      const customObjects = await prisma13.customObject.findMany({ select: { apiName: true } });
      for (const obj of customObjects) {
        objectPerms[obj.apiName] = Object.fromEntries(allActions.map((a) => [a, true]));
      }
      const allAppPermKeys = ["manageUsers", "manageRoles", "manageDepartments", "exportData", "importData", "manageReports", "manageDashboards", "viewSummary", "viewSetup", "customizeApplication", "manageSharing", "viewAllData", "modifyAllData"];
      for (const p of allAppPermKeys) {
        appPerms[p] = true;
      }
    } else {
      if (deptPerms.objectPermissions) {
        for (const [obj, perms] of Object.entries(deptPerms.objectPermissions)) {
          if (!objectPerms[obj]) objectPerms[obj] = {};
          for (const [action, granted] of Object.entries(perms)) {
            if (!granted) {
              objectPerms[obj][action] = false;
            } else if (!(obj in objectPerms) || !(action in objectPerms[obj])) {
              objectPerms[obj][action] = true;
            }
          }
        }
      }
      if (deptPerms.appPermissions) {
        for (const [perm, granted] of Object.entries(deptPerms.appPermissions)) {
          if (!granted) {
            appPerms[perm] = false;
          } else if (!(perm in appPerms)) {
            appPerms[perm] = true;
          }
        }
      }
    }
    reply.send({
      userId: id,
      roleName: user.orgRole?.label || "No Role",
      departmentName: user.department?.name || "No Department",
      effectivePermissions: {
        objectPermissions: objectPerms,
        appPermissions: appPerms
      }
    });
  });
}

// src/routes/roles.ts
import { prisma as prisma14 } from "@crm/db/client";
import { z as z8 } from "zod";
var createRoleSchema = z8.object({
  name: z8.string().min(1).max(100).trim(),
  label: z8.string().min(1).max(200).trim(),
  description: z8.string().max(1e3).optional().nullable(),
  level: z8.number().int().min(1).max(99),
  parentId: z8.string().uuid().optional().nullable(),
  permissions: z8.record(z8.any()).optional(),
  visibility: z8.record(z8.any()).optional()
}).strict();
var updateRoleSchema = createRoleSchema.partial().strict();
var uuidParam3 = z8.object({ id: z8.string().uuid() });
async function rolesRoutes(app2) {
  app2.get("/admin/roles", async (req, reply) => {
    const roles = await prisma14.role.findMany({
      orderBy: [{ level: "asc" }, { name: "asc" }],
      include: {
        parent: { select: { id: true, name: true, label: true } },
        children: { select: { id: true, name: true, label: true, level: true } },
        _count: { select: { users: true } }
      }
    });
    reply.send(roles);
  });
  app2.get("/admin/roles/:id", async (req, reply) => {
    const paramParsed = uuidParam3.safeParse(req.params);
    if (!paramParsed.success) return reply.code(400).send({ error: "Invalid role ID" });
    const { id } = paramParsed.data;
    const role = await prisma14.role.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, label: true } },
        children: { select: { id: true, name: true, label: true, level: true } },
        users: {
          select: { id: true, name: true, email: true, isActive: true },
          take: 100
        },
        _count: { select: { users: true } }
      }
    });
    if (!role) return reply.code(404).send({ error: "Role not found" });
    reply.send(role);
  });
  app2.post("/admin/roles", async (req, reply) => {
    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    const existing = await prisma14.role.findUnique({ where: { name: parsed.data.name } });
    if (existing) return reply.code(409).send({ error: `A role named "${parsed.data.name}" already exists` });
    const role = await prisma14.role.create({
      data: {
        name: parsed.data.name,
        label: parsed.data.label,
        description: parsed.data.description,
        level: parsed.data.level,
        parentId: parsed.data.parentId,
        permissions: parsed.data.permissions || {},
        visibility: parsed.data.visibility || {}
      },
      include: {
        parent: { select: { id: true, name: true, label: true } },
        _count: { select: { users: true } }
      }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "CREATE",
      objectType: "Role",
      objectId: role.id,
      objectName: role.label,
      after: { name: role.name, label: role.label, level: role.level },
      ipAddress: extractIp(req)
    });
    reply.code(201).send(role);
  });
  app2.put("/admin/roles/:id", async (req, reply) => {
    const paramParsed = uuidParam3.safeParse(req.params);
    if (!paramParsed.success) return reply.code(400).send({ error: "Invalid role ID" });
    const { id } = paramParsed.data;
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    const existing = await prisma14.role.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Role not found" });
    if (parsed.data.name && parsed.data.name !== existing.name) {
      const dup = await prisma14.role.findUnique({ where: { name: parsed.data.name } });
      if (dup) return reply.code(409).send({ error: `A role named "${parsed.data.name}" already exists` });
    }
    if (parsed.data.parentId === id) {
      return reply.code(400).send({ error: "Role cannot be its own parent" });
    }
    const role = await prisma14.role.update({
      where: { id },
      data: parsed.data,
      include: {
        parent: { select: { id: true, name: true, label: true } },
        _count: { select: { users: true } }
      }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "UPDATE",
      objectType: "Role",
      objectId: role.id,
      objectName: role.label,
      before: { name: existing.name, label: existing.label, level: existing.level },
      after: { name: role.name, label: role.label, level: role.level },
      ipAddress: extractIp(req)
    });
    reply.send(role);
  });
  app2.delete("/admin/roles/:id", async (req, reply) => {
    const paramParsed = uuidParam3.safeParse(req.params);
    if (!paramParsed.success) return reply.code(400).send({ error: "Invalid role ID" });
    const { id } = paramParsed.data;
    const existing = await prisma14.role.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Role not found" });
    if (existing.isSystem) {
      return reply.code(403).send({ error: "Cannot delete a system role" });
    }
    const userCount = await prisma14.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      return reply.code(409).send({ error: `Cannot delete role: ${userCount} users are assigned. Reassign them first.` });
    }
    await prisma14.role.delete({ where: { id } });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "DELETE",
      objectType: "Role",
      objectId: id,
      objectName: existing.label,
      before: { name: existing.name, label: existing.label, level: existing.level },
      ipAddress: extractIp(req)
    });
    reply.code(204).send();
  });
}

// src/routes/audit-log.ts
import { prisma as prisma15 } from "@crm/db/client";
import { z as z9 } from "zod";
var querySchema = z9.object({
  actorId: z9.string().uuid().optional(),
  objectType: z9.string().max(100).optional(),
  objectId: z9.string().uuid().optional(),
  action: z9.string().max(50).optional(),
  from: z9.coerce.date().optional(),
  to: z9.coerce.date().optional(),
  page: z9.coerce.number().int().min(1).default(1),
  pageSize: z9.coerce.number().int().min(1).max(200).default(50)
});
async function auditLogRoutes(app2) {
  app2.get("/admin/audit-log", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    const { actorId, objectType, objectId, action, from, to, page, pageSize } = parsed.data;
    const where = {};
    if (actorId) where.actorId = actorId;
    if (objectType) where.objectType = objectType;
    if (objectId) where.objectId = objectId;
    if (action) where.action = action;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }
    const [items, total] = await Promise.all([
      prisma15.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma15.auditLog.count({ where })
    ]);
    reply.send({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  });
}

// src/routes/recycle-bin.ts
import { prisma as prisma16 } from "@crm/db/client";
import { z as z10 } from "zod";
var uuidParam4 = z10.object({ id: z10.string().uuid() });
async function recycleBinRoutes(app2) {
  app2.get("/admin/recycle-bin", async (req, reply) => {
    const [deletedUsers, deletedDepartments] = await Promise.all([
      prisma16.user.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          deletedAt: true,
          deletedBy: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma16.department.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          deletedAt: true,
          deletedBy: { select: { id: true, name: true, email: true } }
        }
      })
    ]);
    reply.send({ users: deletedUsers, departments: deletedDepartments });
  });
  app2.post("/admin/recycle-bin/users/:id/restore", async (req, reply) => {
    const parsed = uuidParam4.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid user ID" });
    const user = await prisma16.user.findUnique({ where: { id: parsed.data.id } });
    if (!user) return reply.code(404).send({ error: "User not found" });
    if (!user.deletedAt) return reply.code(400).send({ error: "User is not deleted" });
    const restored = await prisma16.user.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null, deletedById: null, isActive: true },
      select: { id: true, name: true, email: true, isActive: true }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "RESTORE",
      objectType: "User",
      objectId: restored.id,
      objectName: restored.name || restored.email,
      ipAddress: extractIp(req)
    });
    reply.send(restored);
  });
  app2.post("/admin/recycle-bin/departments/:id/restore", async (req, reply) => {
    const parsed = uuidParam4.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid department ID" });
    const dept = await prisma16.department.findUnique({ where: { id: parsed.data.id } });
    if (!dept) return reply.code(404).send({ error: "Department not found" });
    if (!dept.deletedAt) return reply.code(400).send({ error: "Department is not deleted" });
    const restored = await prisma16.department.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null, deletedById: null, isActive: true },
      select: { id: true, name: true }
    });
    const actorId = req.user.sub;
    await logAudit({
      actorId,
      action: "RESTORE",
      objectType: "Department",
      objectId: restored.id,
      objectName: restored.name,
      ipAddress: extractIp(req)
    });
    reply.send(restored);
  });
}

// src/app.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname2 = dirname(__filename);
function buildApp() {
  const app2 = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });
  app2.register(cors, { origin: true });
  const nextStaticPath = path2.join(__dirname2, "../../web/.next/static");
  if (fs.existsSync(nextStaticPath)) {
    app2.register(serveStatic, {
      root: nextStaticPath,
      prefix: "/_next/static/"
    });
  }
  app2.get("/health", async () => ({ ok: true, version: "2026-03-09-v8-summary-perms" }));
  app2.post("/auth/signup", async (req, reply) => {
    const schema = z11.object({
      name: z11.string().min(1),
      email: z11.string().email(),
      password: z11.string().min(6)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma17.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.code(409).send({ error: "Email already registered" });
    try {
      const passwordHash = hashPassword(parsed.data.password);
      const user = await prisma17.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          passwordHash,
          role: "USER"
        }
      });
      const env = loadEnv();
      const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 24 * 7);
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
    const schema = z11.object({
      email: z11.string().email(),
      password: z11.string().min(6),
      accountId: z11.string().uuid().optional().nullable()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) return reply.code(401).send({ error: "Invalid credentials" });
    const env = loadEnv();
    const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 24 * 7);
    const forwardedFor = req.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const ip = (forwardedIp ? forwardedIp.split(",")[0].trim() : void 0) || req.ip || req.socket?.remoteAddress || "unknown";
    const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
    await prisma17.loginEvent.create({
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
    const querySchema2 = z11.object({
      accountId: z11.string().uuid().optional(),
      take: z11.coerce.number().int().min(1).max(500).optional()
    });
    const parsed = querySchema2.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const events = await prisma17.loginEvent.findMany({
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
  app2.get("/me/permissions", async (req, reply) => {
    const userId = req.user.sub;
    const user = await prisma17.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        orgRole: true
      }
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    const deptRaw = user.department?.permissions || {};
    const isAdminDept = !!deptRaw.isAdmin;
    const deptObjPerms = deptRaw.objectPermissions || {};
    const deptAppPerms = deptRaw.appPermissions || {};
    const grantedObjPerms = {};
    const grantedAppPerms = {};
    const rolePerms = user.orgRole?.permissions || {};
    if (rolePerms.objectPermissions) {
      for (const [obj, perms] of Object.entries(rolePerms.objectPermissions)) {
        if (!grantedObjPerms[obj]) grantedObjPerms[obj] = {};
        for (const [action, granted] of Object.entries(perms)) {
          if (granted) grantedObjPerms[obj][action] = true;
        }
      }
    }
    if (rolePerms.appPermissions) {
      for (const [perm, granted] of Object.entries(rolePerms.appPermissions)) {
        if (granted) grantedAppPerms[perm] = true;
      }
    }
    const objectPerms = {};
    const allObjKeys = /* @__PURE__ */ new Set([...Object.keys(deptObjPerms), ...Object.keys(grantedObjPerms)]);
    for (const obj of allObjKeys) {
      objectPerms[obj] = {};
      const deptObj = deptObjPerms[obj] || {};
      const grantedObj = grantedObjPerms[obj] || {};
      const allActions = /* @__PURE__ */ new Set([...Object.keys(deptObj), ...Object.keys(grantedObj)]);
      for (const action of allActions) {
        if (user.department && obj in deptObjPerms && action in deptObj && !deptObj[action]) {
          objectPerms[obj][action] = false;
        } else {
          objectPerms[obj][action] = !!(deptObj[action] || grantedObj[action]);
        }
      }
    }
    const appPerms = {};
    const allAppKeys = /* @__PURE__ */ new Set([...Object.keys(deptAppPerms), ...Object.keys(grantedAppPerms)]);
    for (const perm of allAppKeys) {
      if (user.department && perm in deptAppPerms && !deptAppPerms[perm]) {
        appPerms[perm] = false;
      } else {
        appPerms[perm] = !!(deptAppPerms[perm] || grantedAppPerms[perm]);
      }
    }
    if (isAdminDept || user.role === "ADMIN") {
      const allActions = ["read", "create", "edit", "delete", "viewAll", "modifyAll"];
      const customObjects = await prisma17.customObject.findMany({ select: { apiName: true } });
      for (const obj of customObjects) {
        objectPerms[obj.apiName] = Object.fromEntries(allActions.map((a) => [a, true]));
      }
      const allAppPermKeys = ["manageUsers", "manageRoles", "manageDepartments", "exportData", "importData", "manageReports", "manageDashboards", "viewSummary", "viewSetup", "customizeApplication", "manageSharing", "viewAllData", "modifyAllData"];
      for (const p of allAppPermKeys) {
        appPerms[p] = true;
      }
    }
    let homePageLayout = null;
    const homePageLayoutId = deptRaw.homePageLayoutId;
    if (homePageLayoutId) {
      try {
        const templatesSetting = await prisma17.setting.findUnique({ where: { key: "homeLayoutTemplates" } });
        if (templatesSetting) {
          const templates = templatesSetting.value;
          const tpl = templates.find((t) => t.id === homePageLayoutId);
          if (tpl?.layout) homePageLayout = tpl.layout;
        }
      } catch {
      }
    }
    reply.send({
      userId,
      departmentName: user.department?.name || null,
      roleName: user.orgRole?.label || null,
      role: user.role,
      objectPermissions: objectPerms,
      appPermissions: appPerms,
      homePageLayout
    });
  });
  app2.get("/accounts", async (req, reply) => {
    const accounts = await prisma17.account.findMany({ take: 50, orderBy: { createdAt: "desc" } });
    reply.send(accounts);
  });
  const accountSchema = z11.object({ name: z11.string().min(1), domain: z11.string().optional().nullable(), ownerId: z11.string().uuid() });
  app2.post("/accounts", async (req, reply) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const created = await prisma17.account.create({ data: parsed.data });
    reply.code(201).send(created);
  });
  const accountUpdate = accountSchema.partial();
  app2.put("/accounts/:id", async (req, reply) => {
    const id = req.params.id;
    const parsed = accountUpdate.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const updated = await prisma17.account.update({ where: { id }, data: parsed.data });
    reply.send(updated);
  });
  app2.delete("/accounts/:id", async (req, reply) => {
    const id = req.params.id;
    await prisma17.account.delete({ where: { id } });
    reply.code(204).send();
  });
  app2.addHook("onRequest", async (req, reply) => {
    if (!req.routerPath?.startsWith("/admin")) return;
    const user = req.user;
    if (!user || user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Insufficient permissions." });
    }
  });
  app2.register(objectRoutes);
  app2.register(fieldRoutes);
  app2.register(layoutRoutes);
  app2.register(recordRoutes);
  app2.register(reportRoutes);
  app2.register(dashboardRoutes);
  app2.register(backupRoutes);
  app2.register(settingRoutes);
  app2.register(preferenceRoutes);
  app2.register(departmentRoutes);
  app2.register(usersAdminRoutes);
  app2.register(rolesRoutes);
  app2.register(auditLogRoutes);
  app2.register(recycleBinRoutes);
  return app2;
}

// src/ensure-core-objects.ts
import { prisma as prisma18 } from "@crm/db/client";
var CORE_OBJECTS = [
  {
    apiName: "Property",
    label: "Property",
    pluralLabel: "Properties",
    description: "Real estate properties",
    fields: [
      { apiName: "propertyNumber", label: "Property Number", type: "Text", unique: true },
      { apiName: "address", label: "Address", type: "Text", required: true },
      { apiName: "city", label: "City", type: "Text", required: true },
      { apiName: "state", label: "State/Province", type: "Text", required: true },
      { apiName: "zipCode", label: "Zip Code", type: "Text" },
      { apiName: "status", label: "Status", type: "Picklist", required: true, picklistValues: ["Active", "Inactive", "Pending"], defaultValue: "Active" }
    ]
  },
  {
    apiName: "Contact",
    label: "Contact",
    pluralLabel: "Contacts",
    description: "People and contacts",
    fields: [
      { apiName: "firstName", label: "First Name", type: "Text" },
      { apiName: "lastName", label: "Last Name", type: "Text" },
      { apiName: "email", label: "Email", type: "Email" },
      { apiName: "phone", label: "Phone", type: "Phone" },
      { apiName: "title", label: "Title", type: "Text" },
      { apiName: "status", label: "Status", type: "Picklist", picklistValues: ["Active", "Inactive"], defaultValue: "Active" }
    ]
  },
  {
    apiName: "Account",
    label: "Account",
    pluralLabel: "Accounts",
    description: "Business accounts and organizations",
    fields: [
      { apiName: "accountNumber", label: "Account Number", type: "Text", unique: true },
      { apiName: "name", label: "Account Name", type: "Text" },
      { apiName: "type", label: "Type", type: "Picklist", picklistValues: ["Customer", "Prospect", "Partner", "Vendor"] },
      { apiName: "email", label: "Email", type: "Email" },
      { apiName: "phone", label: "Phone", type: "Phone" },
      { apiName: "website", label: "Website", type: "URL" },
      { apiName: "status", label: "Status", type: "Picklist", picklistValues: ["Active", "Inactive"], defaultValue: "Active" }
    ]
  },
  {
    apiName: "Product",
    label: "Product",
    pluralLabel: "Products",
    description: "Products and services catalog",
    fields: [
      { apiName: "productCode", label: "Product Code", type: "Text", unique: true },
      { apiName: "productName", label: "Product Name", type: "Text", required: true },
      { apiName: "description", label: "Description", type: "TextArea" },
      { apiName: "unitPrice", label: "Unit Price", type: "Currency" },
      { apiName: "productFamily", label: "Product Family", type: "Picklist", picklistValues: ["Hardware", "Software", "Service", "Other"] },
      { apiName: "isActive", label: "Active", type: "Checkbox", defaultValue: "true" }
    ]
  },
  {
    apiName: "Lead",
    label: "Lead",
    pluralLabel: "Leads",
    description: "Sales leads",
    fields: [
      { apiName: "leadNumber", label: "Lead Number", type: "Text", unique: true },
      { apiName: "firstName", label: "First Name", type: "Text" },
      { apiName: "lastName", label: "Last Name", type: "Text", required: true },
      { apiName: "company", label: "Company", type: "Text" },
      { apiName: "email", label: "Email", type: "Email" },
      { apiName: "phone", label: "Phone", type: "Phone" },
      { apiName: "leadSource", label: "Lead Source", type: "Picklist", picklistValues: ["Web", "Phone", "Referral", "Partner", "Other"] },
      { apiName: "stage", label: "Stage", type: "Picklist", picklistValues: ["New", "Contacted", "Qualified", "Converted", "Lost"], defaultValue: "New" }
    ]
  },
  {
    apiName: "Deal",
    label: "Deal",
    pluralLabel: "Deals",
    description: "Sales opportunities and deals",
    fields: [
      { apiName: "dealNumber", label: "Deal Number", type: "Text", unique: true },
      { apiName: "dealName", label: "Deal Name", type: "Text", required: true },
      { apiName: "amount", label: "Amount", type: "Currency" },
      { apiName: "closeDate", label: "Close Date", type: "Date" },
      { apiName: "stage", label: "Stage", type: "Picklist", picklistValues: ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"], defaultValue: "Prospecting" },
      { apiName: "probability", label: "Probability (%)", type: "Percent" }
    ]
  },
  {
    apiName: "Project",
    label: "Project",
    pluralLabel: "Projects",
    description: "Project management",
    fields: [
      { apiName: "projectNumber", label: "Project Number", type: "Text", unique: true },
      { apiName: "projectName", label: "Project Name", type: "Text", required: true },
      { apiName: "description", label: "Description", type: "TextArea" },
      { apiName: "startDate", label: "Start Date", type: "Date" },
      { apiName: "endDate", label: "End Date", type: "Date" },
      { apiName: "status", label: "Status", type: "Picklist", picklistValues: ["Planning", "In Progress", "On Hold", "Completed", "Cancelled"], defaultValue: "Planning" }
    ]
  },
  {
    apiName: "Service",
    label: "Service",
    pluralLabel: "Services",
    description: "Service tickets and requests",
    fields: [
      { apiName: "serviceNumber", label: "Service Number", type: "Text", unique: true },
      { apiName: "serviceName", label: "Service Name", type: "Text", required: true },
      { apiName: "description", label: "Description", type: "TextArea" },
      { apiName: "priority", label: "Priority", type: "Picklist", picklistValues: ["Low", "Medium", "High", "Critical"], defaultValue: "Medium" },
      { apiName: "status", label: "Status", type: "Picklist", picklistValues: ["New", "In Progress", "Pending", "Completed", "Cancelled"], defaultValue: "New" }
    ]
  },
  {
    apiName: "Quote",
    label: "Quote",
    pluralLabel: "Quotes",
    description: "Sales quotes and proposals",
    fields: [
      { apiName: "quoteNumber", label: "Quote Number", type: "Text", unique: true },
      { apiName: "quoteName", label: "Quote Name", type: "Text", required: true },
      { apiName: "totalAmount", label: "Total Amount", type: "Currency" },
      { apiName: "validUntil", label: "Valid Until", type: "Date" },
      { apiName: "status", label: "Status", type: "Picklist", picklistValues: ["Draft", "Sent", "Accepted", "Rejected", "Expired"], defaultValue: "Draft" }
    ]
  },
  {
    apiName: "Installation",
    label: "Installation",
    pluralLabel: "Installations",
    description: "Installation tracking",
    fields: [
      { apiName: "installationNumber", label: "Installation Number", type: "Text", unique: true },
      { apiName: "installationName", label: "Installation Name", type: "Text", required: true },
      { apiName: "scheduledDate", label: "Scheduled Date", type: "Date" },
      { apiName: "completedDate", label: "Completed Date", type: "Date" },
      { apiName: "status", label: "Status", type: "Picklist", picklistValues: ["Scheduled", "In Progress", "Completed", "Cancelled"], defaultValue: "Scheduled" }
    ]
  }
];
async function ensureCoreObjects() {
  console.log("[ensure-core-objects] Checking core objects...");
  let systemUser = await prisma18.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!systemUser) {
    const crypto2 = await import("crypto");
    const ITERATIONS2 = 31e4;
    const KEYLEN2 = 32;
    const DIGEST2 = "sha256";
    const salt = crypto2.randomBytes(16).toString("hex");
    const derived = crypto2.pbkdf2Sync("admin123", salt, ITERATIONS2, KEYLEN2, DIGEST2).toString("hex");
    const passwordHash = `pbkdf2$${ITERATIONS2}$${DIGEST2}$${salt}$${derived}`;
    systemUser = await prisma18.user.create({
      data: {
        email: "admin@crm.local",
        passwordHash,
        name: "System Admin",
        role: "ADMIN"
      }
    });
    console.log("[ensure-core-objects] Created system admin user");
  }
  let created = 0;
  let existed = 0;
  for (const objDef of CORE_OBJECTS) {
    const existing = await prisma18.customObject.findFirst({
      where: { apiName: { equals: objDef.apiName, mode: "insensitive" } }
    });
    if (existing) {
      existed++;
      await ensureFields(existing.id, objDef.fields, systemUser.id);
      continue;
    }
    const obj = await prisma18.customObject.create({
      data: {
        apiName: objDef.apiName,
        label: objDef.label,
        pluralLabel: objDef.pluralLabel,
        description: objDef.description,
        createdById: systemUser.id,
        modifiedById: systemUser.id
      }
    });
    await ensureFields(obj.id, objDef.fields, systemUser.id);
    await createDefaultLayout(obj.id, systemUser.id);
    created++;
    console.log(`[ensure-core-objects] Created ${objDef.apiName} with ${objDef.fields.length} fields`);
  }
  console.log(
    `[ensure-core-objects] Done \u2014 ${created} created, ${existed} already existed (${CORE_OBJECTS.length} total)`
  );
  try {
    const contactObj = await prisma18.customObject.findFirst({
      where: { apiName: { equals: "Contact", mode: "insensitive" } }
    });
    if (contactObj) {
      await prisma18.customField.updateMany({
        where: {
          objectId: contactObj.id,
          apiName: { in: ["firstName", "lastName"] },
          required: true
        },
        data: { required: false }
      });
    }
  } catch (err) {
    console.warn("[ensure-core-objects] Could not fix Contact name field requirements:", err);
  }
  try {
    const autoNumberFieldNames = [
      "accountNumber",
      "propertyNumber",
      "contactNumber",
      "leadNumber",
      "dealNumber",
      "productCode",
      "projectNumber",
      "quoteNumber",
      "serviceNumber",
      "installationNumber"
    ];
    await prisma18.customField.updateMany({
      where: {
        apiName: { in: autoNumberFieldNames },
        required: true
      },
      data: { required: false }
    });
    const accountObj = await prisma18.customObject.findFirst({
      where: { apiName: { equals: "Account", mode: "insensitive" } }
    });
    if (accountObj) {
      await prisma18.customField.updateMany({
        where: {
          objectId: accountObj.id,
          apiName: "name",
          required: true
        },
        data: { required: false }
      });
    }
  } catch (err) {
    console.warn("[ensure-core-objects] Could not fix auto-number/name field requirements:", err);
  }
  await syncSchemaObjectsToDb(systemUser.id);
}
async function syncSchemaObjectsToDb(userId) {
  try {
    const schemaSetting = await prisma18.setting.findUnique({ where: { key: "orgSchema" } });
    if (!schemaSetting || !schemaSetting.value) return;
    const schema = schemaSetting.value;
    const objects = schema.objects || [];
    let synced = 0;
    for (const obj of objects) {
      if (!obj.apiName || obj.apiName === "Home") continue;
      const existing = await prisma18.customObject.findFirst({
        where: { apiName: { equals: obj.apiName, mode: "insensitive" } }
      });
      if (existing) continue;
      const validApiName = /^[A-Z][A-Za-z0-9_]*$/.test(obj.apiName) ? obj.apiName : obj.apiName.charAt(0).toUpperCase() + obj.apiName.slice(1);
      try {
        const dbObj = await prisma18.customObject.create({
          data: {
            apiName: validApiName,
            label: obj.label || validApiName,
            pluralLabel: obj.pluralLabel || obj.label || validApiName,
            description: obj.description || null,
            createdById: userId,
            modifiedById: userId
          }
        });
        const fields = obj.fields || [];
        const systemFieldNames = /* @__PURE__ */ new Set(["Id", "CreatedDate", "LastModifiedDate", "CreatedById", "LastModifiedById"]);
        const customFields = fields.filter(
          (f) => !systemFieldNames.has(f.apiName) && f.type !== "Lookup" && f.type !== "ExternalLookup"
        );
        for (const fieldDef of customFields) {
          try {
            await prisma18.customField.create({
              data: {
                objectId: dbObj.id,
                apiName: fieldDef.apiName,
                label: fieldDef.label || fieldDef.apiName,
                type: fieldDef.type || "Text",
                required: fieldDef.required || false,
                unique: fieldDef.unique || false,
                picklistValues: fieldDef.picklistValues ? JSON.stringify(fieldDef.picklistValues) : null,
                defaultValue: fieldDef.defaultValue || null,
                createdById: userId,
                modifiedById: userId
              }
            });
          } catch {
          }
        }
        await createDefaultLayout(dbObj.id, userId);
        synced++;
        console.log(`[ensure-core-objects] Synced schema object "${validApiName}" to DB with ${customFields.length} fields`);
      } catch (err) {
        console.warn(`[ensure-core-objects] Failed to sync schema object "${obj.apiName}":`, err);
      }
    }
    if (synced > 0) {
      console.log(`[ensure-core-objects] Synced ${synced} additional objects from schema settings`);
    }
  } catch (err) {
    console.warn("[ensure-core-objects] Could not sync schema objects:", err);
  }
}
async function ensureFields(objectId, fields, userId) {
  for (const fieldDef of fields) {
    const existing = await prisma18.customField.findFirst({
      where: { objectId, apiName: fieldDef.apiName }
    });
    if (existing) continue;
    await prisma18.customField.create({
      data: {
        objectId,
        apiName: fieldDef.apiName,
        label: fieldDef.label,
        type: fieldDef.type,
        required: fieldDef.required || false,
        unique: fieldDef.unique || false,
        picklistValues: fieldDef.picklistValues ? JSON.stringify(fieldDef.picklistValues) : null,
        defaultValue: fieldDef.defaultValue || null,
        createdById: userId,
        modifiedById: userId
      }
    });
  }
}
async function createDefaultLayout(objectId, userId) {
  const layoutExists = await prisma18.pageLayout.findFirst({
    where: { objectId, name: "Default Layout" }
  });
  if (layoutExists) return;
  const layout = await prisma18.pageLayout.create({
    data: {
      objectId,
      name: "Default Layout",
      layoutType: "edit",
      isDefault: true,
      createdById: userId,
      modifiedById: userId
    }
  });
  const tab = await prisma18.layoutTab.create({
    data: {
      layoutId: layout.id,
      label: "Details",
      order: 0
    }
  });
  const section = await prisma18.layoutSection.create({
    data: {
      tabId: tab.id,
      label: "Information",
      columns: 2,
      order: 0
    }
  });
  const objFields = await prisma18.customField.findMany({ where: { objectId } });
  for (let i = 0; i < objFields.length; i++) {
    const field = objFields[i];
    if (field) {
      await prisma18.layoutField.create({
        data: {
          sectionId: section.id,
          fieldId: field.id,
          column: i % 2,
          order: Math.floor(i / 2)
        }
      });
    }
  }
}

// src/ensure-user-management.ts
import { prisma as prisma19 } from "@crm/db/client";
var FULL_OBJ_PERMS = { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true };
var STD_OBJ_PERMS = { read: true, create: true, edit: true, delete: false, viewAll: false, modifyAll: false };
var READ_ONLY_OBJ = { read: true, create: false, edit: false, delete: false, viewAll: true, modifyAll: false };
var CORE_OBJECTS2 = ["Property", "Contact", "Account", "Product", "Lead", "Deal", "Project", "Service", "Quote", "Installation"];
function buildObjPerms(template) {
  return Object.fromEntries(CORE_OBJECTS2.map((o) => [o, { ...template }]));
}
var ALL_APP_PERMS_TRUE = {
  manageUsers: true,
  manageRoles: true,
  manageDepartments: true,
  exportData: true,
  importData: true,
  manageReports: true,
  manageDashboards: true,
  viewSummary: true,
  viewSetup: true,
  customizeApplication: true,
  manageSharing: true,
  viewAllData: true,
  modifyAllData: true
};
var SEED_ROLES = [
  {
    name: "system_administrator",
    label: "System Administrator",
    description: "Full access to all features and settings",
    level: 1,
    isSystem: true,
    permissions: {
      objectPermissions: buildObjPerms(FULL_OBJ_PERMS),
      appPermissions: ALL_APP_PERMS_TRUE
    },
    visibility: {}
  },
  {
    name: "executive",
    label: "Executive",
    description: "Full read access, limited write on all objects",
    level: 2,
    isSystem: false,
    permissions: {
      objectPermissions: Object.fromEntries(CORE_OBJECTS2.map((o) => [o, { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false }])),
      appPermissions: { ...ALL_APP_PERMS_TRUE, customizeApplication: false, manageSharing: false }
    },
    visibility: {}
  },
  {
    name: "manager",
    label: "Manager",
    description: "Standard access plus delete and viewAll",
    level: 3,
    isSystem: false,
    permissions: {
      objectPermissions: Object.fromEntries(CORE_OBJECTS2.map((o) => [o, { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false }])),
      appPermissions: {
        manageUsers: false,
        manageRoles: false,
        manageDepartments: false,
        exportData: true,
        importData: true,
        manageReports: true,
        manageDashboards: true,
        viewSummary: true,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: true,
        modifyAllData: false
      }
    },
    visibility: {}
  },
  {
    name: "standard_employee",
    label: "Standard Employee",
    description: "Standard access to core CRM features",
    level: 4,
    isSystem: true,
    permissions: {
      objectPermissions: buildObjPerms(STD_OBJ_PERMS),
      appPermissions: {
        manageUsers: false,
        manageRoles: false,
        manageDepartments: false,
        exportData: true,
        importData: false,
        manageReports: true,
        manageDashboards: true,
        viewSummary: true,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: false,
        modifyAllData: false
      }
    },
    visibility: {}
  },
  {
    name: "sales_user",
    label: "Sales User",
    description: "Full access to sales objects: Leads, Deals, Contacts, Accounts",
    level: 4,
    isSystem: false,
    permissions: {
      objectPermissions: {
        Property: { ...READ_ONLY_OBJ, viewAll: false },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Product: READ_ONLY_OBJ,
        Lead: { ...FULL_OBJ_PERMS },
        Deal: { ...FULL_OBJ_PERMS },
        Project: { ...READ_ONLY_OBJ, viewAll: false },
        Service: { ...READ_ONLY_OBJ, viewAll: false },
        Quote: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Installation: { ...READ_ONLY_OBJ, viewAll: false }
      },
      appPermissions: {
        manageUsers: false,
        manageRoles: false,
        manageDepartments: false,
        exportData: true,
        importData: false,
        manageReports: true,
        manageDashboards: true,
        viewSummary: true,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: false,
        modifyAllData: false
      }
    },
    visibility: {}
  },
  {
    name: "marketing_user",
    label: "Marketing User",
    description: "Full access to Leads and Contacts; read-only Deals",
    level: 4,
    isSystem: false,
    permissions: {
      objectPermissions: {
        Property: { ...READ_ONLY_OBJ, viewAll: false },
        Contact: { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: false },
        Account: { read: true, create: true, edit: true, delete: false, viewAll: true, modifyAll: false },
        Product: READ_ONLY_OBJ,
        Lead: { ...FULL_OBJ_PERMS },
        Deal: { ...READ_ONLY_OBJ, viewAll: false },
        Project: { ...READ_ONLY_OBJ, viewAll: false },
        Service: { ...READ_ONLY_OBJ, viewAll: false },
        Quote: { ...READ_ONLY_OBJ, viewAll: false },
        Installation: { ...READ_ONLY_OBJ, viewAll: false }
      },
      appPermissions: {
        manageUsers: false,
        manageRoles: false,
        manageDepartments: false,
        exportData: true,
        importData: true,
        manageReports: true,
        manageDashboards: true,
        viewSummary: true,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: false,
        modifyAllData: false
      }
    },
    visibility: {}
  },
  {
    name: "read_only",
    label: "Read Only",
    description: "Read-only access to all objects",
    level: 5,
    isSystem: true,
    permissions: {
      objectPermissions: buildObjPerms(READ_ONLY_OBJ),
      appPermissions: {
        manageUsers: false,
        manageRoles: false,
        manageDepartments: false,
        exportData: true,
        importData: false,
        manageReports: false,
        manageDashboards: false,
        viewSummary: true,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: true,
        modifyAllData: false
      }
    },
    visibility: {}
  },
  {
    name: "contractor",
    label: "Contractor",
    description: "Minimal base access",
    level: 5,
    isSystem: true,
    permissions: {
      objectPermissions: {},
      appPermissions: {
        manageUsers: false,
        manageRoles: false,
        manageDepartments: false,
        exportData: false,
        importData: false,
        manageReports: false,
        manageDashboards: false,
        viewSummary: false,
        viewSetup: false,
        customizeApplication: false,
        manageSharing: false,
        viewAllData: false,
        modifyAllData: false
      }
    },
    visibility: {}
  }
];
async function ensureUserManagement() {
  console.log("[UserMgmt] Ensuring roles...");
  for (const roleDef of SEED_ROLES) {
    const existing = await prisma19.role.findUnique({ where: { name: roleDef.name } });
    if (!existing) {
      await prisma19.role.create({ data: roleDef });
      console.log(`[UserMgmt] Created role: ${roleDef.label}`);
    }
  }
  const adminRole = await prisma19.role.findUnique({ where: { name: "system_administrator" } });
  if (adminRole) {
    const adminsWithoutRole = await prisma19.user.findMany({
      where: { role: "ADMIN", roleId: null }
    });
    for (const admin of adminsWithoutRole) {
      await prisma19.user.update({
        where: { id: admin.id },
        data: { roleId: adminRole.id }
      });
      console.log(`[UserMgmt] Assigned System Administrator role to ${admin.email}`);
    }
  }
  const standardRole = await prisma19.role.findUnique({ where: { name: "standard_employee" } });
  if (standardRole) {
    const usersWithoutRole = await prisma19.user.findMany({
      where: { roleId: null }
    });
    for (const user of usersWithoutRole) {
      await prisma19.user.update({
        where: { id: user.id },
        data: { roleId: standardRole.id }
      });
      console.log(`[UserMgmt] Assigned Standard Employee role to ${user.email}`);
    }
  }
  console.log("[UserMgmt] User management setup complete.");
}

// src/server.ts
var __dirname3 = path3.dirname(fileURLToPath3(import.meta.url));
dotenv2.config({ path: path3.resolve(__dirname3, "../.env") });
var port = Number(process.env.PORT || 4e3);
var app = buildApp();
ensureCoreObjects().then(() => ensureUserManagement()).then(() => {
  return app.listen({ port, host: "0.0.0.0" });
}).then(() => {
  app.log.info(`API listening on ${port}`);
}).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
