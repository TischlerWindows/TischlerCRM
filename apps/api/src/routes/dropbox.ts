/**
 * Dropbox integration routes.
 *
 * Provides:
 *  - OAuth2 connect/callback flow (per-user)
 *  - File listing for a CRM record folder
 *  - File upload to a CRM record folder
 *  - Connection status check
 *  - Disconnect
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { encrypt, decrypt } from '../crypto';
import { logAudit, extractIp } from '../audit';

// ── Constants ──────────────────────────────────────────────────────

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_URL = 'https://content.dropboxapi.com/2';

const CRM_ROOT_FOLDER = '/TischlerCRM';

// ── Helpers ────────────────────────────────────────────────────────

function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ??
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/api\/?$/, '')
  );
}

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return 'http://localhost:4000';
}

/** Build the record folder path inside Dropbox. */
function buildFolderPath(objectApiName: string, recordId: string, folderName?: string): string {
  // Use folderName if provided (e.g. "6 Suburban Avenue (CT00001)"), otherwise fall back to recordId
  const folder = folderName || recordId;
  // Sanitize folder name: remove characters Dropbox doesn't allow
  const safe = folder.replace(/[\\/:*?"<>|]/g, '_').trim();
  return `${CRM_ROOT_FOLDER}/${objectApiName}/${safe}`;
}

/** Default subfolder structure for Property records. */
const PROPERTY_SUBFOLDERS: Array<{ name: string; children?: string[] }> = [
  { name: 'Leads' },
  { name: 'Service' },
  { name: 'Project Books' },
];

/**
 * Maps a child object type to the subfolder inside the parent Property folder
 * where linked record folders should be auto-created.
 */
const LINKED_RECORD_SUBFOLDER: Record<string, string> = {
  Lead: 'Leads',
  Opportunity: 'Project Books',
  Project: 'Project Books',
  WorkOrder: 'Service',
  Service: 'Service',
};

/** Subfolders created inside each Opportunity folder. */
const OPPORTUNITY_SUBFOLDERS = [
  '1. Estimation',
  '2. Proposals',
  '3. Contract',
  '4. Project Management',
  '5. AutoCad',
  '6. Installation',
  '7. Final Shop Drawings',
  '8. Project Accounting',
  '9. Photos/Site',
  '9. Photos/Finished',
];

/** Return a small HTML page that posts a message to the opener window and closes itself. */
function oauthResultPage(status: 'connected' | 'error', reason?: string): string {
  const data = JSON.stringify({ type: 'dropbox-oauth-result', status, reason });
  return `<!DOCTYPE html><html><body><p>${status === 'connected' ? 'Connected! This window will close.' : 'Authorization failed.'}</p><script>
if(window.opener){window.opener.postMessage(${data},'*');}
setTimeout(function(){window.close();},1500);
</script></body></html>`;
}

/** Get the org-level Dropbox credentials (clientId, clientSecret). */
async function getDropboxCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
  if (!integration || !integration.enabled || !integration.clientId || !integration.clientSecret) {
    return null;
  }
  try {
    return {
      clientId: integration.clientId, // clientId is stored in plain text
      clientSecret: decrypt(integration.clientSecret),
    };
  } catch (err: any) {
    console.error('[dropbox] Failed to decrypt clientSecret:', err.message);
    return null;
  }
}

/** Get a valid access token for the user, refreshing if expired. */
async function getAccessToken(userId: string): Promise<string | null> {
  try {
    const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
    if (!integration) return null;

    const conn = await prisma.userIntegration.findFirst({
      where: { userId, integrationId: integration.id },
    });
    if (!conn || !conn.accessToken) return null;

    // Check if token is expired (with 5-min buffer)
    if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
      // Refresh the token
      if (!conn.refreshToken) return null;
      const creds = await getDropboxCredentials();
      if (!creds) return null;

      const refreshToken = decrypt(conn.refreshToken);
      const resp = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        }),
      });

      if (!resp.ok) return null;

      const data = await resp.json() as {
        access_token: string;
        expires_in: number;
      };

      await prisma.userIntegration.update({
        where: { id: conn.id },
        data: {
          accessToken: encrypt(data.access_token),
          tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
        },
      });

      return data.access_token;
    }

    return decrypt(conn.accessToken);
  } catch (err: any) {
    console.error('[dropbox] Failed to get access token:', err.message);
    return null;
  }
}

/** Make an authenticated Dropbox API call. */
async function dropboxApi(
  accessToken: string,
  endpoint: string,
  body: Record<string, any>,
  isContent = false
): Promise<any> {
  const baseUrl = isContent ? DROPBOX_CONTENT_URL : DROPBOX_API_URL;
  const resp = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Dropbox API error ${resp.status}: ${errBody}`);
  }

  return resp.json();
}

// ── Folder ID tracking helpers ────────────────────────────────────
// Store the Dropbox folder ID on a record so we can track renames.

/** Persist a Dropbox folder ID on a record's JSON data. */
async function storeFolderIdOnRecord(recordId: string, folderId: string): Promise<void> {
  try {
    const record = await prisma.record.findFirst({ where: { id: recordId } });
    if (!record) return;
    const data = record.data as Record<string, any>;
    if (data._dropboxFolderId === folderId) return; // Already stored
    await prisma.record.update({
      where: { id: recordId },
      data: { data: { ...data, _dropboxFolderId: folderId } },
    });
    console.log(`[dropbox] Stored folder ID ${folderId} on record ${recordId}`);
  } catch (err: any) {
    console.error(`[dropbox] Failed to store folder ID on record ${recordId}:`, err.message);
  }
}

/**
 * Resolve the actual Dropbox folder for a record using its stored folder ID.
 * Returns the current Dropbox metadata (which reflects renames) or null.
 */
async function resolveStoredFolder(
  accessToken: string,
  recordId: string,
): Promise<{ found: true; folderName: string; folderId: string; fullPath: string } | { found: false } | null> {
  try {
    const record = await prisma.record.findFirst({ where: { id: recordId } });
    if (!record) return null;
    const data = record.data as Record<string, any>;
    const storedFolderId = data._dropboxFolderId;
    if (!storedFolderId) return null; // No folder ID stored yet
    try {
      const metadata = await dropboxApi(accessToken, '/files/get_metadata', {
        path: storedFolderId,
      }) as { '.tag': string; id: string; name: string; path_display: string };
      if (metadata['.tag'] !== 'folder') return { found: false };
      return {
        found: true,
        folderName: metadata.name,
        folderId: metadata.id,
        fullPath: metadata.path_display,
      };
    } catch {
      // Folder was deleted or ID is invalid
      console.log(`[dropbox] Stored folder ID ${storedFolderId} for record ${recordId} no longer valid`);
      return { found: false };
    }
  } catch {
    return null;
  }
}

/**
 * Try to look up an existing folder at a given path and store its ID on the record.
 * Used for backfilling folder IDs on records that were created before tracking.
 */
async function backfillFolderId(
  accessToken: string,
  recordId: string,
  folderPath: string,
): Promise<void> {
  try {
    const record = await prisma.record.findFirst({ where: { id: recordId } });
    if (!record) return;
    const data = record.data as Record<string, any>;
    if (data._dropboxFolderId) return; // Already has an ID
    const metadata = await dropboxApi(accessToken, '/files/get_metadata', {
      path: folderPath,
    }) as { id: string };
    await storeFolderIdOnRecord(recordId, metadata.id);
  } catch { /* non-fatal — folder may not exist */ }
}

/**
 * Search the parent directory in Dropbox for an existing folder that belongs
 * to this record. Uses the auto-number (e.g. "CT00001") as a unique marker.
 * This handles the case where a folder was renamed directly in Dropbox before
 * any folder ID was stored on the record.
 */
async function findExistingFolderInDropbox(
  accessToken: string,
  objectApiName: string,
  recordId: string,
  recordData: Record<string, any>,
): Promise<{ found: true; folderName: string; folderId: string; fullPath: string } | null> {
  try {
    // Extract the auto-number — it's the unique identifier that survives renames
    const numberKey = Object.keys(recordData).find(
      (k) => k.toLowerCase().includes('number') && typeof recordData[k] === 'string' && recordData[k],
    );
    const autoNumber = numberKey ? (recordData[numberKey] as string) : '';
    if (!autoNumber) return null; // Can't search without an auto-number

    const parentPath = `${CRM_ROOT_FOLDER}/${objectApiName}`;

    // Use Dropbox search scoped to the parent folder
    try {
      const searchResult = await dropboxApi(accessToken, '/files/search_v2', {
        query: autoNumber,
        options: {
          path: parentPath,
          max_results: 10,
          file_categories: [{ '.tag': 'folder' }],
        },
      }) as {
        matches: Array<{
          metadata: {
            '.tag': string;
            metadata: { '.tag': string; id: string; name: string; path_display: string };
          };
        }>;
      };

      for (const match of searchResult.matches || []) {
        const meta = match.metadata?.metadata;
        if (!meta || meta['.tag'] !== 'folder') continue;
        // Check that the folder name contains the auto-number and is a direct child
        if (meta.name.includes(autoNumber) && meta.path_display.toLowerCase().startsWith(parentPath.toLowerCase() + '/')) {
          // Verify it's a direct child (not nested deeper)
          const relativePath = meta.path_display.substring(parentPath.length + 1);
          if (!relativePath.includes('/')) {
            console.log(`[dropbox] Found existing folder for ${recordId} by auto-number "${autoNumber}": ${meta.path_display}`);
            await storeFolderIdOnRecord(recordId, meta.id);
            return { found: true, folderName: meta.name, folderId: meta.id, fullPath: meta.path_display };
          }
        }
      }
    } catch (err: any) {
      // search_v2 may fail if path doesn't exist — fall back to list_folder
      if (!err.message?.includes('409') && !err.message?.includes('not_found')) {
        console.error('[dropbox] search_v2 failed, trying list_folder:', err.message);
      }
    }

    // Fallback: list the parent folder and match by auto-number
    try {
      const listResult = await dropboxApi(accessToken, '/files/list_folder', {
        path: parentPath,
        limit: 2000,
      }) as { entries: Array<{ '.tag': string; id: string; name: string; path_display: string }> };

      for (const entry of listResult.entries || []) {
        if (entry['.tag'] !== 'folder') continue;
        if (entry.name.includes(autoNumber)) {
          console.log(`[dropbox] Found existing folder for ${recordId} by listing: ${entry.path_display}`);
          await storeFolderIdOnRecord(recordId, entry.id);
          return { found: true, folderName: entry.name, folderId: entry.id, fullPath: entry.path_display };
        }
      }
    } catch {
      // Parent folder may not exist yet — that's fine
    }

    return null;
  } catch (err: any) {
    console.error('[dropbox] findExistingFolderInDropbox failed:', err.message);
    return null;
  }
}

/**
 * Build an Opportunity folder name in the format "OPP0001 (Name)" or
 * "OPP0001 (Name) - Requote 1". Falls back to just the number if no name.
 */
function deriveOpportunityFolderName(data: Record<string, any>): string {
  let oppNum = '';
  let oppName = '';
  for (const [k, v] of Object.entries(data)) {
    const stripped = k.replace(/^[A-Za-z]+__/, '');
    if (stripped === 'opportunityNumber' && typeof v === 'string' && v) {
      oppNum = v;
    }
    if ((stripped === 'opportunityName' || stripped === 'name') && typeof v === 'string' && v) {
      oppName = v;
    }
  }
  if (!oppNum) return '';
  // Strip requote suffix from both number and name to rebuild cleanly
  const baseNum = oppNum.replace(/\s*-\s*Requote\s*\d+$/i, '');
  const requoteMatch = oppNum.match(/(\s*-\s*Requote\s*\d+)$/i);
  const requoteSuffix = requoteMatch ? requoteMatch[1] : '';
  // Strip requote suffix from name if present (we'll re-add from number)
  const baseName = oppName.replace(/\s*-\s*Requote\s*\d+$/i, '').trim();
  if (baseName) {
    return `${baseNum} (${baseName})${requoteSuffix}`;
  }
  return oppNum;
}

// ── Derive Dropbox folder name from record data ───────────────────
// Mirrors the frontend deriveDropboxFolderName logic in the widget wrapper.
function deriveDropboxFolderName(recordData: Record<string, any>, recordId: string): string {
  // Find auto-number field
  const numberKey = Object.keys(recordData).find(
    (k) => k.toLowerCase().includes('number') && typeof recordData[k] === 'string' && recordData[k],
  );
  const autoNumber = numberKey ? (recordData[numberKey] as string) : '';

  // Find address — prefer the LocationSearch blob (address_search) which
  // always has structured {street, city, state} data, then fall back to
  // the legacy 'address' key which may be a flat formatted string.
  let addrStr = '';

  // 1. Try address_search / *__address_search (LocationSearch blob)
  const searchKey = Object.keys(recordData).find(
    (k) => k.toLowerCase() === 'address_search' || k.toLowerCase().endsWith('__address_search'),
  );
  if (searchKey) {
    const raw = recordData[searchKey];
    if (raw && typeof raw === 'object') {
      addrStr = [raw.street, raw.city, raw.state].filter(Boolean).join(', ');
    } else if (typeof raw === 'string' && raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          addrStr = [parsed.street, parsed.city, parsed.state].filter(Boolean).join(', ');
        }
      } catch { addrStr = raw; }
    }
  }

  // 2. Fall back to address / *__address
  if (!addrStr) {
    const addrKey = Object.keys(recordData).find(
      (k) => k.toLowerCase() === 'address' || k.toLowerCase().endsWith('__address'),
    );
    if (addrKey) {
      const raw = recordData[addrKey];
      if (typeof raw === 'string' && raw) {
        addrStr = raw;
      } else if (raw && typeof raw === 'object') {
        addrStr = [raw.street, raw.city, raw.state].filter(Boolean).join(', ');
      }
    }
  }

  if (addrStr && autoNumber) return `${addrStr} (${autoNumber})`;
  if (addrStr) return addrStr;
  if (autoNumber) return autoNumber;
  return recordId;
}

/**
 * For a Project (or similar) record that has no direct PropertyId,
 * look it up via the linked Opportunity.
 */
async function resolvePropertyIdViaOpportunity(
  recordData: Record<string, any>,
  objectApiName: string,
): Promise<string | undefined> {
  // Find Opportunity lookup in the record data
  let oppId: string | undefined;
  for (const key of ['opportunity', 'opportunityId', 'OpportunityId', 'relatedOpportunity']) {
    const v = recordData[key] ?? recordData[`${objectApiName}__${key}`];
    if (v && typeof v === 'string') { oppId = v; break; }
  }
  if (!oppId) {
    for (const [k, v] of Object.entries(recordData)) {
      if (k.toLowerCase().includes('opportunity') && !k.toLowerCase().includes('number') && !k.toLowerCase().includes('name') && typeof v === 'string' && v) {
        oppId = v; break;
      }
    }
  }
  if (!oppId) return undefined;

  const oppObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } },
  });
  if (!oppObj) return undefined;

  const oppRecord = await prisma.record.findFirst({
    where: { id: oppId, objectId: oppObj.id },
  });
  if (!oppRecord) return undefined;

  const oppData = oppRecord.data as Record<string, any>;
  // Find PropertyId in the Opportunity's data
  for (const key of ['property', 'propertyId', 'PropertyId', 'propertyAddress', 'relatedProperty']) {
    const v = oppData[key] ?? oppData[`Opportunity__${key}`];
    if (v && typeof v === 'string') return v;
  }
  for (const [k, v] of Object.entries(oppData)) {
    if (k.toLowerCase().includes('property') && typeof v === 'string' && v) return v;
  }
  return undefined;
}

/**
 * Attempt to rename a Dropbox folder when a record's derived name changes.
 * Fire-and-forget — errors are logged but do not propagate.
 */
export async function tryRenameDropboxFolder(
  userId: string,
  objectApiName: string,
  recordId: string,
  beforeData: Record<string, any>,
  afterData: Record<string, any>,
): Promise<void> {
  try {
    const subfolder = LINKED_RECORD_SUBFOLDER[objectApiName];
    const isLinked = !!subfolder;

    // --- Get an access token ---
    let accessToken = await getAccessToken(userId);
    if (!accessToken) {
      const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
      if (integration) {
        const connections = await prisma.userIntegration.findMany({
          where: { integrationId: integration.id, accessToken: { not: null } },
          select: { userId: true },
          take: 5,
        });
        for (const conn of connections) {
          accessToken = await getAccessToken(conn.userId);
          if (accessToken) break;
        }
      }
      if (!accessToken) return;
    }

    if (!isLinked) {
      // ── Top-level object (Property, etc.) ──
      const oldName = deriveDropboxFolderName(beforeData, recordId);
      const newName = deriveDropboxFolderName(afterData, recordId);
      if (oldName === newName) return;

      const oldPath = buildFolderPath(objectApiName, recordId, oldName);
      const newPath = buildFolderPath(objectApiName, recordId, newName);

      console.log(`[dropbox] Renaming top-level folder: ${oldPath} → ${newPath}`);
      await dropboxApi(accessToken, '/files/move_v2', {
        from_path: oldPath,
        to_path: newPath,
        autorename: false,
        allow_ownership_transfer: false,
      });
      return;
    }

    // ── Linked object (Lead, Opportunity, Project, WorkOrder, Service) ──
    // Projects linked to Opportunities don't have their own folder, skip.
    if (objectApiName === 'Project') {
      let oppId: string | undefined;
      for (const key of ['opportunity', 'opportunityId', 'OpportunityId', 'relatedOpportunity']) {
        const v = afterData[key] ?? afterData[`Project__${key}`];
        if (v && typeof v === 'string') { oppId = v; break; }
      }
      if (oppId) return; // Project uses Opportunity's folder — nothing to rename
    }

    // Helper to resolve propertyId from record data
    const findPropertyId = async (data: Record<string, any>): Promise<string | undefined> => {
      let propId: string | undefined;
      const wellKnown = ['property', 'propertyId', 'propertyAddress', 'relatedProperty'];
      for (const key of wellKnown) {
        const v = data[key] ?? data[`${objectApiName}__${key}`];
        if (v && typeof v === 'string') { propId = v; break; }
      }
      if (!propId) {
        for (const [k, v] of Object.entries(data)) {
          if (k.toLowerCase().includes('property') && typeof v === 'string' && v) {
            propId = v; break;
          }
        }
      }
      if (!propId && objectApiName === 'Project') {
        propId = await resolvePropertyIdViaOpportunity(data, objectApiName);
      }
      return propId;
    };

    const oldPropertyId = await findPropertyId(beforeData);
    const newPropertyId = await findPropertyId(afterData);

    // Need at least one property ID to work with
    if (!oldPropertyId && !newPropertyId) return;

    let oldChildName: string;
    let newChildName: string;
    if (objectApiName === 'Opportunity') {
      oldChildName = deriveOpportunityFolderName(beforeData) || deriveDropboxFolderName(beforeData, recordId);
      newChildName = deriveOpportunityFolderName(afterData) || deriveDropboxFolderName(afterData, recordId);
    } else {
      oldChildName = deriveDropboxFolderName(beforeData, recordId);
      newChildName = deriveDropboxFolderName(afterData, recordId);
    }

    // Resolve Property folder paths
    const propertyObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Property', mode: 'insensitive' } },
    });
    if (!propertyObj) return;

    const buildLinkedPath = async (propId: string, childName: string): Promise<string | null> => {
      const propRecord = await prisma.record.findFirst({
        where: { id: propId, objectId: propertyObj!.id },
      });
      if (!propRecord) return null;
      const propData = propRecord.data as Record<string, any>;

      // Resolve actual Property folder — prefer stored folder ID to handle renames
      let parentPath: string;
      const parentFolder = await resolveStoredFolder(accessToken!, propId);
      if (parentFolder?.found) {
        parentPath = parentFolder.fullPath;
      } else {
        const renamedParent = await findExistingFolderInDropbox(accessToken!, 'Property', propId, propData);
        if (renamedParent) {
          parentPath = renamedParent.fullPath;
        } else {
          const propFolderName = deriveDropboxFolderName(propData, propId);
          parentPath = buildFolderPath('Property', propId, propFolderName);
        }
      }

      const safeChild = childName.replace(/[\\/:*?"<>|]/g, '_').trim();
      return `${parentPath}/${subfolder}/${safeChild}`;
    };

    // Resolve the child record's actual current Dropbox path.
    // Priority: stored folder ID (survives renames) → verify guessed path → search parent dir.
    const storedChildFolder = await resolveStoredFolder(accessToken!, recordId);
    let resolvedOldPath: string | null = null;

    if (storedChildFolder?.found) {
      resolvedOldPath = storedChildFolder.fullPath;
    } else if (oldPropertyId) {
      const guessedPath = await buildLinkedPath(oldPropertyId, oldChildName);
      if (guessedPath) {
        try {
          // Verify the guessed path actually exists in Dropbox
          const meta = await dropboxApi(accessToken!, '/files/get_metadata', { path: guessedPath }) as {
            '.tag': string; id: string; name: string; path_display: string;
          };
          if (meta['.tag'] === 'folder') {
            resolvedOldPath = meta.path_display;
            await storeFolderIdOnRecord(recordId, meta.id);
          }
        } catch {
          // Guessed path not found — scan the property subfolder by auto-number
          const parentDir = guessedPath.substring(0, guessedPath.lastIndexOf('/'));
          const numberKey = Object.keys(beforeData).find(
            (k) => k.toLowerCase().includes('number') && typeof beforeData[k] === 'string' && beforeData[k],
          );
          const autoNumber = numberKey ? (beforeData[numberKey] as string) : '';
          if (autoNumber) {
            try {
              const listResult = await dropboxApi(accessToken!, '/files/list_folder', {
                path: parentDir,
                limit: 2000,
              }) as { entries: Array<{ '.tag': string; id: string; name: string; path_display: string }> };
              for (const entry of listResult.entries ?? []) {
                if (entry['.tag'] === 'folder' && entry.name.includes(autoNumber)) {
                  resolvedOldPath = entry.path_display;
                  await storeFolderIdOnRecord(recordId, entry.id);
                  console.log(`[dropbox] Found linked folder by listing for ${recordId}: ${entry.path_display}`);
                  break;
                }
              }
            } catch { /* parent dir may not exist yet */ }
          }
        }
      }
    }

    const newPath = newPropertyId ? await buildLinkedPath(newPropertyId, newChildName) : null;

    if (!resolvedOldPath || !newPath || resolvedOldPath === newPath) return;

    console.log(`[dropbox] Moving linked folder: ${resolvedOldPath} → ${newPath}`);
    await dropboxApi(accessToken, '/files/move_v2', {
      from_path: resolvedOldPath,
      to_path: newPath,
      autorename: false,
      allow_ownership_transfer: false,
    });
  } catch (err: any) {
    // Non-fatal — old folder might not exist yet, or new path already exists
    console.error('[dropbox] tryRenameDropboxFolder failed (non-fatal):', err.message);
  }
}

/**
 * When a child record (Opportunity, Lead, WorkOrder) is created or updated
 * with a Property lookup, ensure the linked folder exists inside the parent
 * Property's Dropbox folder.  Fire-and-forget — errors are logged only.
 */
export async function tryEnsureLinkedFolder(
  userId: string,
  childObjectApiName: string,
  childRecordId: string,
  childData: Record<string, any>,
): Promise<void> {
  try {
    console.log(`[dropbox] tryEnsureLinkedFolder called: object=${childObjectApiName}, recordId=${childRecordId}, userId=${userId}`);

    // Only applies to object types that have a subfolder mapping
    const subfolder = LINKED_RECORD_SUBFOLDER[childObjectApiName];
    if (!subfolder) {
      console.log(`[dropbox] No subfolder mapping for ${childObjectApiName}, skipping`);
      return;
    }

    // Dynamically find a Property lookup value in the record data.
    // The record data has both prefixed ("Opportunity__property") and stripped
    // ("property") keys, so we scan all values that look like a record ID
    // whose key contains "property" (case-insensitive).
    let propertyId: string | undefined;

    // 1. Check well-known field names first (stripped prefix forms)
    const wellKnown = ['property', 'propertyId', 'propertyAddress', 'relatedProperty'];
    for (const key of wellKnown) {
      const v = childData[key] ?? childData[`${childObjectApiName}__${key}`];
      if (v && typeof v === 'string') { propertyId = v; break; }
    }

    // 2. Fallback: scan all keys for anything containing "property"
    if (!propertyId) {
      for (const [key, val] of Object.entries(childData)) {
        if (key.toLowerCase().includes('property') && typeof val === 'string' && val) {
          propertyId = val;
          break;
        }
      }
    }

    // 3. For Project, fall back to the linked Opportunity's PropertyId
    if (!propertyId && childObjectApiName === 'Project') {
      propertyId = await resolvePropertyIdViaOpportunity(childData, childObjectApiName);
    }

    if (!propertyId) {
      console.log(`[dropbox] No property ID found in child data keys: ${Object.keys(childData).filter(k => k.toLowerCase().includes('prop')).join(', ')}`);
      return;
    }
    console.log(`[dropbox] Found propertyId=${propertyId} for ${childObjectApiName} ${childRecordId}`);

    // Try to get access token for the creating user first, then fall back to
    // any org-level Dropbox-connected user so folder creation isn't blocked
    // when the current user hasn't connected Dropbox.
    let accessToken = await getAccessToken(userId);
    if (!accessToken) {
      console.log(`[dropbox] User ${userId} not Dropbox-connected, trying org-level fallback`);
      const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
      if (integration) {
        const connections = await prisma.userIntegration.findMany({
          where: { integrationId: integration.id, accessToken: { not: null } },
          select: { userId: true },
          take: 5,
        });
        for (const conn of connections) {
          accessToken = await getAccessToken(conn.userId);
          if (accessToken) {
            console.log(`[dropbox] Using fallback Dropbox token from user ${conn.userId}`);
            break;
          }
        }
      }
      if (!accessToken) {
        console.log('[dropbox] No Dropbox-connected user found in org, skipping');
        return;
      }
    }

    // Verify it's actually a Property record
    const propertyObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Property', mode: 'insensitive' } },
    });
    if (!propertyObj) {
      console.log('[dropbox] Property custom object not found');
      return;
    }

    const propertyRecord = await prisma.record.findFirst({
      where: { id: propertyId, objectId: propertyObj.id },
    });
    if (!propertyRecord) {
      console.log(`[dropbox] Property record ${propertyId} not found (objectId=${propertyObj.id})`);
      return;
    }
    const propertyData = propertyRecord.data as Record<string, any>;
    const derivedParentFolderName = deriveDropboxFolderName(propertyData, propertyId);

    // Resolve actual Property parent folder — prefer stored folder ID to handle renames
    let parentPath: string;
    const parentFolder = await resolveStoredFolder(accessToken, propertyId);
    if (parentFolder?.found) {
      parentPath = parentFolder.fullPath;
      console.log(`[dropbox] Resolved Property parent via stored folder ID: ${parentPath}`);
    } else {
      // Search for a renamed Property folder by auto-number
      const renamedParent = await findExistingFolderInDropbox(accessToken, 'Property', propertyId, propertyData);
      if (renamedParent) {
        parentPath = renamedParent.fullPath;
        console.log(`[dropbox] Resolved Property parent via auto-number search: ${parentPath}`);
      } else {
        parentPath = buildFolderPath('Property', propertyId, derivedParentFolderName);
      }
    }

    // ── Special handling: Project linked to an Opportunity ──
    // Don't create a separate Project folder — use the linked Opportunity's
    // existing folder and copy Estimation → Project Management within it.
    if (childObjectApiName === 'Project') {
      let oppId: string | undefined;
      for (const key of ['opportunity', 'opportunityId', 'OpportunityId', 'relatedOpportunity']) {
        const v = childData[key] ?? childData[`Project__${key}`];
        if (v && typeof v === 'string') { oppId = v; break; }
      }
      if (!oppId) {
        for (const [key, val] of Object.entries(childData)) {
          if (key.toLowerCase().includes('opportunity') && !key.toLowerCase().includes('number') && !key.toLowerCase().includes('name') && typeof val === 'string' && val) {
            oppId = val; break;
          }
        }
      }

      if (oppId) {
        // Linked to an Opportunity — create a PRJ#### folder under the
        // Opportunity's "4. Project Management" subfolder.
        const oppObj = await prisma.customObject.findFirst({
          where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } },
        });
        if (oppObj) {
          const oppRecord = await prisma.record.findFirst({
            where: { id: oppId, objectId: oppObj.id },
          });
          if (oppRecord) {
            // Check if already tracked
            const existingProjectFolder = await resolveStoredFolder(accessToken, childRecordId);
            if (existingProjectFolder?.found) {
              console.log(`[dropbox] Project folder already tracked for ${childRecordId} at ${existingProjectFolder.fullPath}`);
              return;
            }

            const oppData = oppRecord.data as Record<string, any>;
            // Resolve the Opportunity's full Dropbox path via stored ID (most accurate)
            let oppFullPath: string;
            const oppFolder = await resolveStoredFolder(accessToken, oppId);
            if (oppFolder?.found) {
              oppFullPath = oppFolder.fullPath;
            } else {
              const oppFolderName = deriveOpportunityFolderName(oppData) || deriveDropboxFolderName(oppData, oppId);
              const safeOpp = oppFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();
              oppFullPath = `${parentPath}/Project Books/${safeOpp}`;
            }

            // Derive the project folder name from its auto-number / address fields
            const projectFolderName = deriveDropboxFolderName(childData, childRecordId);
            const safeProject = projectFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();
            const projectPath = `${oppFullPath}/4. Project Management/${safeProject}`;

            console.log(`[dropbox] Creating project folder under Opportunity PM: ${projectPath}`);
            try {
              const result = await dropboxApi(accessToken, '/files/create_folder_v2', {
                path: projectPath,
                autorename: false,
              }) as { metadata: { id: string } };
              await storeFolderIdOnRecord(childRecordId, result.metadata.id);
              console.log(`[dropbox] Successfully created project folder: ${projectPath}`);
            } catch (err: any) {
              if (!err.message?.includes('409') && !err.message?.includes('conflict')) {
                console.error('[dropbox] Project folder creation failed (non-fatal):', err.message);
              } else {
                console.log(`[dropbox] Project folder already exists: ${projectPath}`);
                await backfillFolderId(accessToken, childRecordId, projectPath);
              }
            }
            return;
          }
        }
      }
      // No linked Opportunity — fall through to create a standalone Project folder
    }

    // Derive child folder name
    let childFolderName: string;
    if (childObjectApiName === 'Opportunity') {
      // Use opportunity number + name (e.g. "OPP0001 (Test)" or "OPP0001 (Test) - Requote 1")
      childFolderName = deriveOpportunityFolderName(childData) || deriveDropboxFolderName(childData, childRecordId);
    } else {
      childFolderName = deriveDropboxFolderName(childData, childRecordId);
    }

    const safeName = childFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();

    // ── Special handling: Requote Opportunity ──
    // Requotes don't get their own top-level Project Books folder.
    // Instead, create only a subfolder inside the original Opportunity's
    // 1. Estimation folder (e.g. .../OPP0001/1. Estimation/OPP0001 - Requote 1/)
    if (childObjectApiName === 'Opportunity' && childData._isRequote && childData._parentOpportunityNumber) {
      const parentOppNumber = (childData._parentOpportunityNumber as string).replace(/[\\/:*?"<>|]/g, '_').trim();

      // Check if already tracked
      const existingChildFolder = await resolveStoredFolder(accessToken, childRecordId);
      if (existingChildFolder?.found) {
        console.log(`[dropbox] Requote folder already tracked for ${childRecordId} at ${existingChildFolder.fullPath}`);
        return;
      }

      // Resolve the parent OPP folder name via stored ID (handles name changes)
      let parentOppFolderName = parentOppNumber;
      const oppObj = await prisma.customObject.findFirst({
        where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } },
      });
      if (oppObj) {
        // Find the parent OPP record by its opportunity number
        const allOpps = await prisma.record.findMany({
          where: { objectId: oppObj.id, deletedAt: null },
          select: { id: true, data: true },
        });
        for (const opp of allOpps) {
          const oppData = opp.data as Record<string, any> | null;
          if (!oppData) continue;
          for (const [k, v] of Object.entries(oppData)) {
            const stripped = k.replace(/^[A-Za-z]+__/, '');
            if (stripped === 'opportunityNumber' && v === childData._parentOpportunityNumber) {
              // Found the parent — resolve its folder via stored ID first
              const parentOppFolder = await resolveStoredFolder(accessToken, opp.id);
              if (parentOppFolder?.found) {
                parentOppFolderName = parentOppFolder.folderName;
              } else {
                parentOppFolderName = (deriveOpportunityFolderName(oppData) || parentOppNumber).replace(/[\\/:*?"<>|]/g, '_').trim();
              }
              break;
            }
          }
          if (parentOppFolderName !== parentOppNumber) break;
        }
      }

      const requotePath = `${parentPath}/${subfolder}/${parentOppFolderName}/1. Estimation/${safeName}`;
      const parentOppEstimationFolder = `${parentPath}/${subfolder}/${parentOppFolderName}/1. Estimation/${parentOppFolderName}`;
      console.log(`[dropbox] Creating requote folder inside parent estimation: ${requotePath}`);

      let requoteCreated = false;
      try {
        const result = await dropboxApi(accessToken, '/files/create_folder_v2', {
          path: requotePath,
          autorename: false,
        }) as { metadata: { id: string } };
        await storeFolderIdOnRecord(childRecordId, result.metadata.id);
        requoteCreated = true;
        console.log(`[dropbox] Successfully created requote folder: ${requotePath}`);
      } catch (err: any) {
        if (!err.message?.includes('409') && !err.message?.includes('conflict')) {
          console.error('[dropbox] Requote folder creation failed:', err.message);
        } else {
          console.log(`[dropbox] Requote folder already exists: ${requotePath}`);
          await backfillFolderId(accessToken, childRecordId, requotePath);
        }
      }

      // Copy contents from the parent OPP folder in Estimation to the requote folder
      if (requoteCreated) {
        try {
          const listResult = await dropboxApi(accessToken, '/files/list_folder', {
            path: parentOppEstimationFolder,
            limit: 2000,
          }) as { entries: Array<{ '.tag': string; path_display: string; name: string }> };

          if (listResult.entries && listResult.entries.length > 0) {
            console.log(`[dropbox] Copying ${listResult.entries.length} items from ${parentOppEstimationFolder} → ${requotePath}`);
            for (const entry of listResult.entries) {
              try {
                await dropboxApi(accessToken, '/files/copy_v2', {
                  from_path: entry.path_display,
                  to_path: `${requotePath}/${entry.name}`,
                  autorename: true,
                });
              } catch (cpErr: any) {
                console.error(`[dropbox] Failed to copy ${entry.name} to requote: ${cpErr.message}`);
              }
            }
            console.log(`[dropbox] Finished copying files to requote folder`);
          } else {
            console.log(`[dropbox] Parent OPP estimation folder empty: ${parentOppEstimationFolder}`);
          }
        } catch (err: any) {
          if (err.message?.includes('409') || err.message?.includes('not_found')) {
            console.log(`[dropbox] Parent OPP estimation folder not found: ${parentOppEstimationFolder}`);
          } else {
            console.error('[dropbox] Copy to requote failed (non-fatal):', err.message);
          }
        }
      }

      return; // Done — no full folder structure for requotes
    }

    const childPath = `${parentPath}/${subfolder}/${safeName}`;

    console.log(`[dropbox] Creating linked folder: ${childPath}`);

    // Check if the child record already has a tracked folder
    const existingChildFolder = await resolveStoredFolder(accessToken, childRecordId);
    if (existingChildFolder?.found) {
      console.log(`[dropbox] Linked folder already tracked for ${childRecordId} at ${existingChildFolder.fullPath}`);
      return; // Folder exists (possibly renamed) — nothing to create
    }

    let created = false;
    try {
      const result = await dropboxApi(accessToken, '/files/create_folder_v2', {
        path: childPath,
        autorename: false,
      }) as { metadata: { id: string; name: string; path_display: string } };
      created = true;
      console.log(`[dropbox] Successfully created linked folder: ${childPath}`);
      // Store the Dropbox folder ID on the child record for rename tracking
      await storeFolderIdOnRecord(childRecordId, result.metadata.id);
    } catch (err: any) {
      if (!err.message?.includes('409') && !err.message?.includes('conflict')) {
        throw err;
      }
      console.log(`[dropbox] Linked folder already exists: ${childPath}`);
      // Already exists — backfill its ID if not already stored
      await backfillFolderId(accessToken, childRecordId, childPath);
    }

    // Create subfolders for Opportunity records
    if (created && childObjectApiName === 'Opportunity') {
      for (const sf of OPPORTUNITY_SUBFOLDERS) {
        try {
          await dropboxApi(accessToken, '/files/create_folder_v2', {
            path: `${childPath}/${sf}`,
            autorename: false,
          });
        } catch { /* folder already exists — ignore */ }
      }
      // Create an OPP#### folder inside 1. Estimation for working files
      try {
        await dropboxApi(accessToken, '/files/create_folder_v2', {
          path: `${childPath}/1. Estimation/${safeName}`,
          autorename: false,
        });
        console.log(`[dropbox] Created estimation sub-folder: ${childPath}/1. Estimation/${safeName}`);
      } catch { /* folder already exists — ignore */ }
    }

    // ── Copy files from related record folder ──
    // Opportunity linked to Lead → copy Lead folder → 1. Estimation
    if (created) {
      try {
        await tryCopyLinkedRecordFiles(accessToken, childObjectApiName, childData, childPath, parentPath);
      } catch (copyErr: any) {
        console.error('[dropbox] tryCopyLinkedRecordFiles failed (non-fatal):', copyErr.message);
      }
    }
  } catch (err: any) {
    console.error('[dropbox] tryEnsureLinkedFolder failed (non-fatal):', err.message);
  }
}

/**
 * Copy files from a related record's Dropbox folder into the newly created folder.
 *   - Opportunity with Lead lookup → copy Lead folder contents → Opportunity/1. Estimation
 * (Project copying is handled directly in tryEnsureLinkedFolder.)
 */
async function tryCopyLinkedRecordFiles(
  accessToken: string,
  childObjectApiName: string,
  childData: Record<string, any>,
  childPath: string,
  parentPropertyPath: string,
): Promise<void> {
  let sourcePath: string | undefined;
  let destPath: string | undefined;

  if (childObjectApiName === 'Opportunity') {
    // Find the Lead lookup
    let leadId: string | undefined;
    for (const key of ['lead', 'leadId', 'relatedLead']) {
      const v = childData[key] ?? childData[`Opportunity__${key}`];
      if (v && typeof v === 'string') { leadId = v; break; }
    }
    if (!leadId) {
      for (const [key, val] of Object.entries(childData)) {
        if (key.toLowerCase().includes('lead') && !key.toLowerCase().includes('number') && typeof val === 'string' && val) {
          leadId = val; break;
        }
      }
    }

    if (leadId) {
      // Find the Lead record to derive its folder name
      const leadObj = await prisma.customObject.findFirst({
        where: { apiName: { equals: 'Lead', mode: 'insensitive' } },
      });
      if (leadObj) {
        const leadRecord = await prisma.record.findFirst({
          where: { id: leadId, objectId: leadObj.id },
        });
        if (leadRecord) {
          const leadData = leadRecord.data as Record<string, any>;
          const leadFolderName = deriveDropboxFolderName(leadData, leadId);
          const safeLead = leadFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();
          // Lead folder lives under: /TischlerCRM/Property/{prop}/Leads/{leadFolder}
          sourcePath = `${parentPropertyPath}/Leads/${safeLead}`;
          // Copy into the OPP sub-folder inside 1. Estimation (e.g. .../1. Estimation/OPP0013 (name))
          const oppSubfolder = childPath.split('/').pop()!;
          destPath = `${childPath}/1. Estimation/${oppSubfolder}`;
          console.log(`[dropbox] Will copy Lead files: ${sourcePath} → ${destPath}`);
        }
      }
    }
  }

  if (!sourcePath || !destPath) return;

  // List all files/folders in the source folder and copy each to the destination
  try {
    const result = await dropboxApi(accessToken, '/files/list_folder', {
      path: sourcePath,
      limit: 2000,
    }) as { entries: Array<{ '.tag': string; path_display: string; name: string }> };

    if (!result.entries || result.entries.length === 0) {
      console.log(`[dropbox] Source folder empty or not found: ${sourcePath}`);
      return;
    }

    console.log(`[dropbox] Copying ${result.entries.length} items from ${sourcePath} → ${destPath}`);
    for (const entry of result.entries) {
      try {
        await dropboxApi(accessToken, '/files/copy_v2', {
          from_path: entry.path_display,
          to_path: `${destPath}/${entry.name}`,
          autorename: true,
        });
      } catch (err: any) {
        console.error(`[dropbox] Failed to copy ${entry.name}: ${err.message}`);
      }
    }
    console.log(`[dropbox] Finished copying files to ${destPath}`);
  } catch (err: any) {
    // Source folder may not exist — that's OK
    if (err.message?.includes('409') || err.message?.includes('not_found')) {
      console.log(`[dropbox] Source folder not found: ${sourcePath}`);
      return;
    }
    throw err;
  }
}

// ── Ensure Property root folder + subfolders on record creation ────

/**
 * When a Property record is created (from any path — record page, inline
 * lookup, API, etc.), ensure its Dropbox root folder and default
 * subfolders (Leads, Service, Project Books) are created.
 * Fire-and-forget — errors are logged only.
 */
export async function tryEnsurePropertyRootFolder(
  userId: string,
  recordId: string,
  recordData: Record<string, any>,
): Promise<void> {
  try {
    let accessToken = await getAccessToken(userId);
    if (!accessToken) {
      const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
      if (integration) {
        const connections = await prisma.userIntegration.findMany({
          where: { integrationId: integration.id, accessToken: { not: null } },
          select: { userId: true },
          take: 5,
        });
        for (const conn of connections) {
          accessToken = await getAccessToken(conn.userId);
          if (accessToken) break;
        }
      }
      if (!accessToken) return;
    }

    const folderName = deriveDropboxFolderName(recordData, recordId);
    const folderPath = buildFolderPath('Property', recordId, folderName);

    // Check if the record already has a tracked folder (handles rename detection)
    const existingFolder = await resolveStoredFolder(accessToken, recordId);
    if (existingFolder?.found) {
      console.log(`[dropbox] Property folder already tracked for ${recordId} at ${existingFolder.fullPath}`);
      return; // Folder exists (possibly renamed) — nothing to create
    }

    // Search for an existing folder that may have been renamed in Dropbox
    // (covers records created before folder ID tracking was added)
    const renamedFolder = await findExistingFolderInDropbox(accessToken, 'Property', recordId, recordData);
    if (renamedFolder) {
      console.log(`[dropbox] Found renamed Property folder for ${recordId}: ${renamedFolder.fullPath}`);
      return; // Folder exists under a different name — ID is now stored
    }

    // Create root folder
    let created = false;
    try {
      const result = await dropboxApi(accessToken, '/files/create_folder_v2', {
        path: folderPath,
        autorename: false,
      }) as { metadata: { id: string; name: string; path_display: string } };
      created = true;
      // Store the Dropbox folder ID on the record for rename tracking
      await storeFolderIdOnRecord(recordId, result.metadata.id);
    } catch (err: any) {
      if (!err.message?.includes('409') && !err.message?.includes('conflict')) {
        console.error('[dropbox] Property root folder creation failed:', err.message);
        return;
      }
      // Folder already exists — backfill its ID if not already stored
      await backfillFolderId(accessToken, recordId, folderPath);
    }

    // Create subfolders only when the root folder was newly created
    if (created) {
      for (const sf of PROPERTY_SUBFOLDERS) {
        try {
          await dropboxApi(accessToken, '/files/create_folder_v2', {
            path: `${folderPath}/${sf.name}`,
            autorename: false,
          });
        } catch { /* already exists */ }
      }
      for (const sf of PROPERTY_SUBFOLDERS) {
        if (sf.children) {
          for (const child of sf.children) {
            try {
              await dropboxApi(accessToken, '/files/create_folder_v2', {
                path: `${folderPath}/${sf.name}/${child}`,
                autorename: false,
              });
            } catch { /* already exists */ }
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[dropbox] tryEnsurePropertyRootFolder failed (non-fatal):', err.message);
  }
}

// ── Routes ─────────────────────────────────────────────────────────

export async function dropboxRoutes(app: FastifyInstance) {

  // ── OAuth: Initiate Authorization ──
  // Returns the URL the frontend should redirect the user to.
  app.get('/dropbox/connect', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const creds = await getDropboxCredentials();
      if (!creds) {
        return reply.code(400).send({ error: 'Dropbox integration is not configured. Ask an admin to set up the Client ID and Client Secret in Connected Apps.' });
      }

      // State parameter to prevent CSRF — encode userId + a random nonce
      const nonce = crypto.randomUUID();
      const state = Buffer.from(JSON.stringify({ userId: user.sub, nonce })).toString('base64url');

      const callbackUrl = `${getApiBaseUrl()}/dropbox/callback`;

      const params = new URLSearchParams({
        client_id: creds.clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        token_access_type: 'offline', // get a refresh_token
        state,
        scope: 'files.metadata.read files.metadata.write files.content.read files.content.write',
      });

      reply.send({ url: `${DROPBOX_AUTH_URL}?${params}` });
    } catch (err: any) {
      req.log.error(err, 'GET /dropbox/connect failed');
      reply.code(500).send({ error: 'Failed to start Dropbox authorization. Check server logs.' });
    }
  });

  // ── OAuth: Callback (code → tokens) ──
  app.get('/dropbox/callback', async (req, reply) => {
    const { code, state, error: oauthError } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const frontendUrl = getFrontendUrl();

    if (oauthError || !code || !state) {
      return reply.type('text/html').send(oauthResultPage('error', oauthError || 'missing_code'));
    }

    // Decode state to get userId
    let stateData: { userId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return reply.type('text/html').send(oauthResultPage('error', 'invalid_state'));
    }

    const creds = await getDropboxCredentials();
    if (!creds) {
      return reply.type('text/html').send(oauthResultPage('error', 'not_configured'));
    }

    // Exchange authorization code for tokens
    const callbackUrl = `${getApiBaseUrl()}/dropbox/callback`;
    const tokenResp = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });

    if (!tokenResp.ok) {
      app.log.error(await tokenResp.text(), 'Dropbox token exchange failed');
      return reply.type('text/html').send(oauthResultPage('error', 'token_exchange'));
    }

    const tokenData = await tokenResp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      account_id: string;
      uid: string;
    };

    // Get the user's email from Dropbox
    let externalEmail: string | null = null;
    try {
      const acct = await dropboxApi(tokenData.access_token, '/users/get_current_account', {}) as {
        email?: string;
        name?: { display_name?: string };
      };
      externalEmail = acct.email ?? null;
    } catch { /* non-critical */ }

    // Upsert the UserIntegration row
    const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
    if (!integration) {
      return reply.type('text/html').send(oauthResultPage('error', 'no_integration'));
    }

    await prisma.userIntegration.upsert({
      where: {
        userId_integrationId: {
          userId: stateData.userId,
          integrationId: integration.id,
        },
      },
      create: {
        id: generateId('UserIntegration'),
        userId: stateData.userId,
        integrationId: integration.id,
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        externalAccountId: tokenData.account_id,
        externalEmail,
      },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        externalAccountId: tokenData.account_id,
        externalEmail,
      },
    });

    await logAudit({
      actorId: stateData.userId,
      action: 'CREATE',
      objectType: 'UserIntegration',
      objectId: integration.id,
      objectName: 'Dropbox',
      after: { externalEmail, externalAccountId: tokenData.account_id },
      ipAddress: extractIp(req),
    });

    // Send a small HTML page that notifies the opener window and closes itself
    reply.type('text/html').send(oauthResultPage('connected'));
  });

  // ── Connection status ──
  app.get('/dropbox/status', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
      if (!integration || !integration.enabled) {
        return reply.send({ enabled: false, connected: false, configured: false });
      }

      // Check credentials are present AND decryptable
      let configured = false;
      if (integration.clientId && integration.clientSecret) {
        try {
          decrypt(integration.clientSecret);
          configured = true;
        } catch {
          // Secret stored with a different key or in plaintext — treat as unconfigured
          configured = false;
        }
      }

      const conn = await prisma.userIntegration.findFirst({
        where: { userId: user.sub, integrationId: integration.id },
      });

      // Verify the stored token is actually decryptable
      let connected = false;
      if (conn?.accessToken) {
        try {
          decrypt(conn.accessToken);
          connected = true;
        } catch {
          // Token can't be decrypted — treat as not connected
          connected = false;
        }
      }

      reply.send({
        enabled: true,
        configured,
        connected,
        externalEmail: connected ? (conn?.externalEmail ?? null) : null,
        connectedAt: connected ? (conn?.connectedAt ?? null) : null,
      });
    } catch (err: any) {
      req.log.error(err, 'GET /dropbox/status failed');
      reply.send({ enabled: false, connected: false, configured: false });
    }
  });

  // ── Disconnect ──
  app.delete('/dropbox/disconnect', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
    if (!integration) return reply.code(404).send({ error: 'Integration not found' });

    await prisma.userIntegration.deleteMany({
      where: { userId: user.sub, integrationId: integration.id },
    });

    reply.code(204).send();
  });

  // ── Resolve the correct Dropbox folder path for a record ──
  // For records linked to a Property (Lead, Opportunity, etc.), returns the
  // path inside the parent Property folder instead of the top-level path.
  app.get('/dropbox/resolve-path/:objectApiName/:recordId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { objectApiName, recordId } = req.params as { objectApiName: string; recordId: string };

    try {
      // Fetch the record data
      const obj = await prisma.customObject.findFirst({
        where: { apiName: { equals: objectApiName, mode: 'insensitive' } },
      });
      if (!obj) return reply.send({ linked: false });

      const record = await prisma.record.findFirst({
        where: { id: recordId, objectId: obj.id },
      });
      if (!record) return reply.send({ linked: false });

      const recordData = record.data as Record<string, any>;

      // Check if this object type has a linked subfolder mapping
      const subfolder = LINKED_RECORD_SUBFOLDER[objectApiName];
      if (!subfolder) {
        return reply.send({ linked: false });
      }

      // Find the property lookup value
      let propertyId: string | undefined;
      const wellKnown = ['property', 'propertyId', 'propertyAddress', 'relatedProperty'];
      for (const key of wellKnown) {
        const v = recordData[key] ?? recordData[`${objectApiName}__${key}`];
        if (v && typeof v === 'string') { propertyId = v; break; }
      }
      if (!propertyId) {
        for (const [key, val] of Object.entries(recordData)) {
          if (key.toLowerCase().includes('property') && typeof val === 'string' && val) {
            propertyId = val;
            break;
          }
        }
      }

      // For Project, fall back to the linked Opportunity's PropertyId
      if (!propertyId && objectApiName === 'Project') {
        propertyId = await resolvePropertyIdViaOpportunity(recordData, objectApiName);
      }

      if (!propertyId) {
        return reply.send({ linked: false });
      }

      // Verify the Property record exists
      const propertyObj = await prisma.customObject.findFirst({
        where: { apiName: { equals: 'Property', mode: 'insensitive' } },
      });
      if (!propertyObj) return reply.send({ linked: false });

      const propertyRecord = await prisma.record.findFirst({
        where: { id: propertyId, objectId: propertyObj.id },
      });
      if (!propertyRecord) return reply.send({ linked: false });

      const propertyData = propertyRecord.data as Record<string, any>;
      let parentFolderName = deriveDropboxFolderName(propertyData, propertyId);

      // For Opportunity, use opportunity number + name as the folder name
      let childFolderName: string;
      if (objectApiName === 'Opportunity') {
        childFolderName = deriveOpportunityFolderName(recordData) || deriveDropboxFolderName(recordData, recordId);
      } else {
        childFolderName = deriveDropboxFolderName(recordData, recordId);
      }

      // Resolve actual folder names from stored Dropbox folder IDs (handles renames)
      const accessToken = await getAccessToken(user.sub);
      if (accessToken) {
        // Check if Property folder was renamed in Dropbox
        const parentFolder = await resolveStoredFolder(accessToken, propertyId);
        if (parentFolder?.found) {
          parentFolderName = parentFolder.folderName;
        } else {
          // Search for renamed Property folder by auto-number
          const renamedParent = await findExistingFolderInDropbox(accessToken, 'Property', propertyId, propertyData);
          if (renamedParent) {
            parentFolderName = renamedParent.folderName;
          }
        }
        // Check if child folder was renamed in Dropbox
        const childFolder = await resolveStoredFolder(accessToken, recordId);
        if (childFolder?.found) {
          childFolderName = childFolder.folderName;
        }
      }

      // For Project, also resolve the linked Opportunity folder name
      let linkedOpportunityFolderName: string | undefined;
      if (objectApiName === 'Project') {
        let oppId: string | undefined;
        for (const key of ['opportunity', 'opportunityId', 'OpportunityId', 'relatedOpportunity']) {
          const v = recordData[key] ?? recordData[`Project__${key}`];
          if (v && typeof v === 'string') { oppId = v; break; }
        }
        if (!oppId) {
          for (const [k, v] of Object.entries(recordData)) {
            if (k.toLowerCase().includes('opportunity') && !k.toLowerCase().includes('name') && !k.toLowerCase().includes('number') && typeof v === 'string' && v) {
              oppId = v; break;
            }
          }
        }
        if (oppId) {
          const oppObj = await prisma.customObject.findFirst({
            where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } },
          });
          if (oppObj) {
            const oppRecord = await prisma.record.findFirst({
              where: { id: oppId, objectId: oppObj.id },
            });
            if (oppRecord) {
              const oppData = oppRecord.data as Record<string, any>;
              linkedOpportunityFolderName = deriveOpportunityFolderName(oppData) || deriveDropboxFolderName(oppData, oppId);
              // Check if Opportunity folder was renamed in Dropbox
              if (accessToken) {
                const oppFolder = await resolveStoredFolder(accessToken, oppId);
                if (oppFolder?.found) {
                  linkedOpportunityFolderName = oppFolder.folderName;
                }
              }
            }
          }
        }
      }

      // For requotes, resolve the parent OPP folder name (with opportunity name)
      let parentOpportunityFolderName: string | undefined;
      if (objectApiName === 'Opportunity' && recordData._isRequote && recordData._parentOpportunityNumber) {
        const pOppNum = recordData._parentOpportunityNumber as string;
        parentOpportunityFolderName = pOppNum; // fallback to just the number
        const oppObj2 = await prisma.customObject.findFirst({
          where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } },
        });
        if (oppObj2) {
          const allOpps = await prisma.record.findMany({
            where: { objectId: oppObj2.id, deletedAt: null },
            select: { id: true, data: true },
          });
          for (const opp of allOpps) {
            const oppData = opp.data as Record<string, any> | null;
            if (!oppData) continue;
            for (const [k, v] of Object.entries(oppData)) {
              const stripped = k.replace(/^[A-Za-z]+__/, '');
              if (stripped === 'opportunityNumber' && v === pOppNum) {
                if (accessToken) {
                  const oppFolder = await resolveStoredFolder(accessToken, opp.id);
                  if (oppFolder?.found) {
                    parentOpportunityFolderName = oppFolder.folderName;
                  } else {
                    parentOpportunityFolderName = deriveOpportunityFolderName(oppData) || pOppNum;
                  }
                } else {
                  parentOpportunityFolderName = deriveOpportunityFolderName(oppData) || pOppNum;
                }
                break;
              }
            }
            if (parentOpportunityFolderName !== pOppNum) break;
          }
        }
      }

      reply.send({
        linked: true,
        parentObjectApiName: 'Property',
        parentRecordId: propertyId,
        parentFolderName,
        subfolder,
        childFolderName,
        ...(linkedOpportunityFolderName ? { linkedOpportunityFolderName } : {}),
        ...(recordData._isRequote ? { isRequote: true, parentOpportunityNumber: recordData._parentOpportunityNumber, parentOpportunityFolderName } : {}),
      });
    } catch (err: any) {
      req.log.error(err, 'resolve-path failed');
      reply.send({ linked: false });
    }
  });

  // ── List files in a record folder ──
  app.get('/dropbox/files/:objectApiName/:recordId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { objectApiName, recordId } = req.params as { objectApiName: string; recordId: string };
    const { subPath, folderName } = req.query as { subPath?: string; folderName?: string };
    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) {
      return reply.send({ connected: false, files: [] });
    }

    // Resolve actual folder path — prefer stored folder ID to handle renames
    let basePath: string;
    const storedFolder = await resolveStoredFolder(accessToken, recordId);
    if (storedFolder?.found) {
      basePath = storedFolder.fullPath;
    } else {
      // Search for a renamed folder by auto-number (covers pre-tracking records)
      const record = await prisma.record.findFirst({ where: { id: recordId } });
      const rData = record?.data as Record<string, any> | undefined;
      const renamedFolder = rData
        ? await findExistingFolderInDropbox(accessToken, objectApiName, recordId, rData)
        : null;
      if (renamedFolder) {
        basePath = renamedFolder.fullPath;
      } else {
        basePath = buildFolderPath(objectApiName, recordId, folderName);
      }
    }

    // For Projects linked to an Opportunity, the folder lives under
    // {OppFolder}/4. Project Management/{PRJ####}. If the resolved basePath
    // is not under that path (stale stored ID or first load), re-resolve.
    if (objectApiName === 'Project' && !basePath.includes('/4. Project Management/')) {
      const projRecord = await prisma.record.findFirst({ where: { id: recordId } });
      const pData = projRecord?.data as Record<string, any> | null;
      if (pData) {
        let oppId: string | undefined;
        for (const key of ['opportunity', 'opportunityId', 'OpportunityId', 'relatedOpportunity']) {
          const v = pData[key] ?? pData[`Project__${key}`];
          if (v && typeof v === 'string') { oppId = v; break; }
        }
        if (!oppId) {
          for (const [key, val] of Object.entries(pData)) {
            if (key.toLowerCase().includes('opportunity') && !key.toLowerCase().includes('number') && !key.toLowerCase().includes('name') && typeof val === 'string' && val) {
              oppId = val; break;
            }
          }
        }
        if (oppId) {
          const oppObj = await prisma.customObject.findFirst({ where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } } });
          const oppRecord = oppObj ? await prisma.record.findFirst({ where: { id: oppId, objectId: oppObj.id } }) : null;
          if (oppRecord) {
            const oppData = oppRecord.data as Record<string, any>;
            const oppFolder = await resolveStoredFolder(accessToken, oppId);
            if (oppFolder?.found) {
              const safeProject = deriveDropboxFolderName(pData, recordId).replace(/[\\/:*?"<>|]/g, '_').trim();
              basePath = `${oppFolder.fullPath}/4. Project Management/${safeProject}`;
            }
          }
        }
      }
    }

    const folderPath = subPath ? `${basePath}/${subPath}` : basePath;

    try {
      const result = await dropboxApi(accessToken, '/files/list_folder', {
        path: folderPath,
        limit: 200,
        include_media_info: false,
      }) as {
        entries: Array<{
          '.tag': string;
          id: string;
          name: string;
          path_display: string;
          size?: number;
          server_modified?: string;
          client_modified?: string;
        }>;
      };

      const entries = result.entries.map(e => ({
        id: e.id,
        name: e.name,
        path: e.path_display,
        size: e.size ?? 0,
        modifiedAt: e.server_modified ?? e.client_modified ?? null,
        isFolder: e['.tag'] === 'folder',
      }));

      // Sort: folders first, then by name
      entries.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      reply.send({ connected: true, files: entries });
    } catch (err: any) {
      // 409 path/not_found is normal — the folder doesn't exist yet
      if (err.message?.includes('409') || err.message?.includes('not_found')) {
        return reply.send({ connected: true, files: [] });
      }
      // Scope/permission errors mean the token needs to be re-issued with correct scopes
      if (err.message?.includes('not permitted') || err.message?.includes('required scope') || err.message?.includes('insufficient_scope')) {
        return reply.send({ connected: false, needsReauth: true, files: [] });
      }
      app.log.error(err, 'Dropbox list files failed');
      reply.code(500).send({ error: 'Failed to list files' });
    }
  });

  // ── Get temporary download link ──
  app.get('/dropbox/download/:fileId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { fileId } = req.params as { fileId: string };
    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    try {
      const result = await dropboxApi(accessToken, '/files/get_temporary_link', {
        path: fileId, // Dropbox accepts file IDs as paths
      }) as { link: string };

      reply.send({ url: result.link });
    } catch (err: any) {
      app.log.error(err, 'Dropbox get download link failed');
      reply.code(500).send({ error: 'Failed to get download link' });
    }
  });

  // ── Upload file to record folder ──
  app.post('/dropbox/upload/:objectApiName/:recordId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { objectApiName, recordId } = req.params as { objectApiName: string; recordId: string };
    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    // Read filename from query param, body comes as raw file content
    const { fileName, folderName } = req.query as { fileName?: string; folderName?: string };
    if (!fileName) return reply.code(400).send({ error: 'fileName query parameter is required' });

    const folderPath = buildFolderPath(objectApiName, recordId, folderName);
    const filePath = `${folderPath}/${fileName}`;

    try {
      // Dropbox upload uses Dropbox-API-Arg header
      const body = await req.body;
      const resp = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: filePath,
            mode: 'add',        // don't overwrite existing files
            autorename: true,  // rename if a file with this name already exists
            mute: false,
          }),
        },
        body: body as any,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        app.log.error({ status: resp.status, body: errText }, 'Dropbox upload failed');
        return reply.code(500).send({ error: 'Upload failed' });
      }

      const result = await resp.json() as {
        id: string;
        name: string;
        path_display: string;
        size: number;
        server_modified: string;
      };

      reply.send({
        id: result.id,
        name: result.name,
        path: result.path_display,
        size: result.size,
        modifiedAt: result.server_modified,
      });
    } catch (err: any) {
      app.log.error(err, 'Dropbox upload error');
      reply.code(500).send({ error: 'Upload failed' });
    }
  });

  // ── Create subfolder inside record folder ──
  app.post('/dropbox/folder/:objectApiName/:recordId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { objectApiName, recordId } = req.params as { objectApiName: string; recordId: string };
    const { name, subPath, folderName } = req.body as { name: string; subPath?: string; folderName?: string };
    if (!name || !name.trim()) return reply.code(400).send({ error: 'Folder name is required' });

    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    const basePath = subPath
      ? `${buildFolderPath(objectApiName, recordId, folderName)}/${subPath}`
      : buildFolderPath(objectApiName, recordId, folderName);
    const folderPath = `${basePath}/${name.trim()}`;

    try {
      const result = await dropboxApi(accessToken, '/files/create_folder_v2', {
        path: folderPath,
        autorename: false,
      }) as { metadata: { id: string; name: string; path_display: string } };

      reply.send({
        id: result.metadata.id,
        name: result.metadata.name,
        path: result.metadata.path_display,
      });
    } catch (err: any) {
      if (err.message?.includes('409') || err.message?.includes('conflict')) {
        return reply.code(409).send({ error: 'A folder with that name already exists' });
      }
      app.log.error(err, 'Dropbox create folder failed');
      reply.code(500).send({ error: 'Failed to create folder' });
    }
  });

  // ── Ensure record folder exists (auto-create on page load) ──
  app.post('/dropbox/ensure-folder/:objectApiName/:recordId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { objectApiName, recordId } = req.params as { objectApiName: string; recordId: string };
    const { folderName } = req.body as { folderName?: string };
    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    // ── Check if this record already has a tracked Dropbox folder ID ──
    // This prevents duplicate folder creation when a folder was renamed in Dropbox.
    // For Project records: only trust the stored path when it's correctly placed
    // under an Opportunity's "4. Project Management" subfolder. Older records may
    // have a stale ID pointing to {Property}/Project Books/{PRJ####} — fall through
    // so the Project+Opp block below can detect and correct it.
    const storedFolder = await resolveStoredFolder(accessToken, recordId);
    if (storedFolder?.found) {
      if (objectApiName !== 'Project' || storedFolder.fullPath.includes('/4. Project Management/')) {
        return reply.send({
          created: false,
          path: storedFolder.fullPath,
          folderName: storedFolder.folderName,
        });
      }
    }

    // ── Search for an existing folder that may have been renamed in Dropbox ──
    // Covers records created before folder ID tracking was added.
    {
      const obj = await prisma.customObject.findFirst({
        where: { apiName: { equals: objectApiName, mode: 'insensitive' } },
      });
      if (obj) {
        const record = await prisma.record.findFirst({
          where: { id: recordId, objectId: obj.id },
        });
        if (record) {
          const rData = record.data as Record<string, any>;
          const renamedFolder = await findExistingFolderInDropbox(accessToken, objectApiName, recordId, rData);
          if (renamedFolder) {
            return reply.send({
              created: false,
              path: renamedFolder.fullPath,
              folderName: renamedFolder.folderName,
            });
          }
        }
      }
    }

    // ── Special handling: Project linked to an Opportunity ──
    // The project folder lives under {OppFolder}/4. Project Management/{PRJ####}.
    // Detect this before falling into the generic LINKED_RECORD_SUBFOLDER path.
    if (objectApiName === 'Project') {
      const projObj = await prisma.customObject.findFirst({
        where: { apiName: { equals: 'Project', mode: 'insensitive' } },
      });
      if (projObj) {
        const projRecord = await prisma.record.findFirst({
          where: { id: recordId, objectId: projObj.id },
        });
        if (projRecord) {
          const pData = projRecord.data as Record<string, any>;
          // Resolve linked Opportunity ID
          let oppId: string | undefined;
          for (const key of ['opportunity', 'opportunityId', 'OpportunityId', 'relatedOpportunity']) {
            const v = pData[key] ?? pData[`Project__${key}`];
            if (v && typeof v === 'string') { oppId = v; break; }
          }
          if (!oppId) {
            for (const [key, val] of Object.entries(pData)) {
              if (key.toLowerCase().includes('opportunity') && !key.toLowerCase().includes('number') && !key.toLowerCase().includes('name') && typeof val === 'string' && val) {
                oppId = val; break;
              }
            }
          }
          if (oppId) {
            const oppObj = await prisma.customObject.findFirst({
              where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } },
            });
            const oppRecord = oppObj
              ? await prisma.record.findFirst({ where: { id: oppId, objectId: oppObj.id } })
              : null;
            if (oppRecord) {
              const oppData = oppRecord.data as Record<string, any>;
              // Resolve the Opportunity's full Dropbox path via stored ID
              let oppFullPath: string | null = null;
              const oppFolder = await resolveStoredFolder(accessToken, oppId);
              if (oppFolder?.found) {
                oppFullPath = oppFolder.fullPath;
              } else {
                // Fall back: resolve via property + opp folder name
                let propertyId: string | undefined;
                for (const key of ['property', 'propertyId', 'propertyAddress', 'relatedProperty']) {
                  const v = oppData[key] ?? oppData[`Opportunity__${key}`];
                  if (v && typeof v === 'string') { propertyId = v; break; }
                }
                if (!propertyId) {
                  for (const [key, val] of Object.entries(oppData)) {
                    if (key.toLowerCase().includes('property') && typeof val === 'string' && val) {
                      propertyId = val; break;
                    }
                  }
                }
                if (propertyId) {
                  const propObj = await prisma.customObject.findFirst({
                    where: { apiName: { equals: 'Property', mode: 'insensitive' } },
                  });
                  const propRecord = propObj
                    ? await prisma.record.findFirst({ where: { id: propertyId, objectId: propObj.id } })
                    : null;
                  if (propRecord) {
                    const propData = propRecord.data as Record<string, any>;
                    let parentPath: string;
                    const parentFolder = await resolveStoredFolder(accessToken, propertyId);
                    if (parentFolder?.found) {
                      parentPath = parentFolder.fullPath;
                    } else {
                      parentPath = buildFolderPath('Property', propertyId, deriveDropboxFolderName(propData, propertyId));
                    }
                    const oppName = deriveOpportunityFolderName(oppData) || deriveDropboxFolderName(oppData, oppId);
                    oppFullPath = `${parentPath}/Project Books/${oppName.replace(/[\\/:*?"<>|]/g, '_').trim()}`;
                  }
                }
              }

              if (oppFullPath) {
                const projectFolderName = deriveDropboxFolderName(pData, recordId);
                const safeProject = projectFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();
                const projectPath = `${oppFullPath}/4. Project Management/${safeProject}`;

                let projectFolderId: string | undefined;
                try {
                  const result = await dropboxApi(accessToken, '/files/create_folder_v2', {
                    path: projectPath,
                    autorename: false,
                  }) as { metadata: { id: string } };
                  projectFolderId = result.metadata.id;
                } catch {
                  // Already exists — backfill
                  try {
                    const meta = await dropboxApi(accessToken, '/files/get_metadata', { path: projectPath }) as {
                      id: string; '.tag': string; path_display: string;
                    };
                    if (meta['.tag'] === 'folder') projectFolderId = meta.id;
                  } catch { /* non-fatal */ }
                }

                if (projectFolderId) await storeFolderIdOnRecord(recordId, projectFolderId);

                return reply.send({
                  created: !projectFolderId,
                  path: projectPath,
                  folderName: safeProject,
                  linked: true,
                });
              }
            }
          }
        }
      }
    }

    // ── If this record type is linked to a Property, ensure the linked
    //    subfolder instead of creating a top-level folder. ──
    const subfolder = LINKED_RECORD_SUBFOLDER[objectApiName];
    if (subfolder) {
      // Look up the record to find its Property reference
      const obj = await prisma.customObject.findFirst({
        where: { apiName: { equals: objectApiName, mode: 'insensitive' } },
      });
      if (obj) {
        const record = await prisma.record.findFirst({
          where: { id: recordId, objectId: obj.id },
        });
        if (record) {
          const rData = record.data as Record<string, any>;
          let propertyId: string | undefined;
          const wellKnown = ['property', 'propertyId', 'propertyAddress', 'relatedProperty'];
          for (const key of wellKnown) {
            const v = rData[key] ?? rData[`${objectApiName}__${key}`];
            if (v && typeof v === 'string') { propertyId = v; break; }
          }
          if (!propertyId) {
            for (const [key, val] of Object.entries(rData)) {
              if (key.toLowerCase().includes('property') && typeof val === 'string' && val) {
                propertyId = val; break;
              }
            }
          }

          if (propertyId) {
            const propertyObj = await prisma.customObject.findFirst({
              where: { apiName: { equals: 'Property', mode: 'insensitive' } },
            });
            const propertyRecord = propertyObj
              ? await prisma.record.findFirst({ where: { id: propertyId, objectId: propertyObj.id } })
              : null;
            if (propertyRecord) {
              const pData = propertyRecord.data as Record<string, any>;

              // Resolve parent Property folder via stored ID (handles renames)
              let parentPath: string;
              const parentFolder = await resolveStoredFolder(accessToken, propertyId);
              if (parentFolder?.found) {
                parentPath = parentFolder.fullPath;
              } else {
                // Search for renamed Property folder by auto-number
                const renamedParent = await findExistingFolderInDropbox(accessToken, 'Property', propertyId, pData);
                if (renamedParent) {
                  parentPath = renamedParent.fullPath;
                } else {
                  const parentFolderName = deriveDropboxFolderName(pData, propertyId);
                  parentPath = buildFolderPath('Property', propertyId, parentFolderName);
                }
              }

              const childFolderName = folderName || (objectApiName === 'Opportunity'
                ? (() => {
                    let oppNum = '';
                    for (const [k, v] of Object.entries(rData)) {
                      const stripped = k.replace(/^[A-Za-z]+__/, '');
                      if (stripped === 'opportunityNumber' && typeof v === 'string') { oppNum = v; break; }
                    }
                    return oppNum || deriveDropboxFolderName(rData, recordId);
                  })()
                : deriveDropboxFolderName(rData, recordId));
              const safeName = childFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();
              const childPath = `${parentPath}/${subfolder}/${safeName}`;

              // Ensure the parent Property folder + subfolder exist
              let childFolderId: string | undefined;
              for (const p of [parentPath, `${parentPath}/${subfolder}`, childPath]) {
                try {
                  const result = await dropboxApi(accessToken, '/files/create_folder_v2', { path: p, autorename: false }) as { metadata: { id: string } };
                  // Store the child folder ID (last one in the loop)
                  if (p === childPath) childFolderId = result.metadata.id;
                  // Store the parent folder ID if it was just created
                  if (p === parentPath) await storeFolderIdOnRecord(propertyId, result.metadata.id);
                } catch { /* already exists */ }
              }
              // Store child folder ID
              if (childFolderId) {
                await storeFolderIdOnRecord(recordId, childFolderId);
              } else {
                // Child already existed — backfill its ID
                await backfillFolderId(accessToken, recordId, childPath);
              }
              // Backfill parent ID if not stored
              await backfillFolderId(accessToken, propertyId, parentPath);

              return reply.send({ created: true, path: childPath, linked: true, folderName: childFolderName });
            }
          }
        }
      }
    }

    // ── Default: create top-level folder (Property, Account, Contact, etc.) ──
    const folderPath = buildFolderPath(objectApiName, recordId, folderName);

    let created = false;
    try {
      const result = await dropboxApi(accessToken, '/files/create_folder_v2', {
        path: folderPath,
        autorename: false,
      }) as { metadata: { id: string; name: string; path_display: string } };
      created = true;
      // Store the Dropbox folder ID on the record for rename tracking
      await storeFolderIdOnRecord(recordId, result.metadata.id);
    } catch (err: any) {
      // 409 conflict means the folder already exists — that's fine
      if (!err.message?.includes('409') && !err.message?.includes('conflict')) {
        app.log.error(err, 'Dropbox ensure folder failed');
        return reply.code(500).send({ error: 'Failed to ensure folder' });
      }
      // Backfill folder ID if not already stored
      await backfillFolderId(accessToken, recordId, folderPath);
    }

    // Create subfolder structure for Property records — only when folder is newly created
    if (created && objectApiName === 'Property') {
      const createFolder = async (p: string) => {
        try {
          await dropboxApi(accessToken, '/files/create_folder_v2', {
            path: p,
            autorename: false,
          });
        } catch { /* folder already exists — ignore */ }
      };

      // Step 1: create all top-level folders sequentially
      for (const sf of PROPERTY_SUBFOLDERS) {
        await createFolder(`${folderPath}/${sf.name}`);
      }
      // Step 2: create all child folders sequentially
      for (const sf of PROPERTY_SUBFOLDERS) {
        if (sf.children) {
          for (const child of sf.children) {
            await createFolder(`${folderPath}/${sf.name}/${child}`);
          }
        }
      }
    }

    reply.send({ created, path: folderPath, folderName: folderName || undefined });
  });

  // ── Delete file or folder ──
  app.delete('/dropbox/file/:fileId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { fileId } = req.params as { fileId: string };
    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    try {
      await dropboxApi(accessToken, '/files/delete_v2', {
        path: fileId, // Dropbox accepts file/folder IDs
      });
      reply.code(204).send();
    } catch (err: any) {
      app.log.error(err, 'Dropbox delete failed');
      reply.code(500).send({ error: 'Failed to delete' });
    }
  });

  // ── Ensure linked-record subfolder inside a parent Property folder ──
  // E.g. when a Lead is linked to a Property, create
  //   /TischlerCRM/Property/{propertyFolder}/Leads/{leadFolder}
  app.post('/dropbox/ensure-linked-folder', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const {
      parentObjectApiName,
      parentRecordId,
      parentFolderName,
      childObjectApiName,
      childFolderName,
    } = req.body as {
      parentObjectApiName: string;
      parentRecordId: string;
      parentFolderName?: string;
      childObjectApiName: string;
      childFolderName: string;
    };

    if (!parentObjectApiName || !parentRecordId || !childObjectApiName || !childFolderName) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    const subfolder = LINKED_RECORD_SUBFOLDER[childObjectApiName];
    if (!subfolder) {
      // No mapping — nothing to auto-create
      return reply.send({ created: false, reason: 'no_mapping' });
    }

    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    const parentPath = buildFolderPath(parentObjectApiName, parentRecordId, parentFolderName);
    const safeName = childFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();
    const childPath = `${parentPath}/${subfolder}/${safeName}`;

    let created = false;
    try {
      await dropboxApi(accessToken, '/files/create_folder_v2', {
        path: childPath,
        autorename: false,
      });
      created = true;
    } catch (err: any) {
      if (!err.message?.includes('409') && !err.message?.includes('conflict')) {
        app.log.error(err, 'Dropbox ensure linked folder failed');
        return reply.code(500).send({ error: 'Failed to create linked folder' });
      }
      // Already exists — fine
    }

    // Create subfolders for Opportunity / Project records
    if (created && (childObjectApiName === 'Opportunity' || childObjectApiName === 'Project')) {
      for (const sf of OPPORTUNITY_SUBFOLDERS) {
        try {
          await dropboxApi(accessToken, '/files/create_folder_v2', {
            path: `${childPath}/${sf}`,
            autorename: false,
          });
        } catch { /* folder already exists — ignore */ }
      }
    }

    reply.send({ created, path: childPath });
  });

  // ── Rename a record folder (e.g. when Property address changes) ──
  app.post('/dropbox/rename-folder', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const {
      objectApiName,
      recordId,
      oldFolderName,
      newFolderName,
    } = req.body as {
      objectApiName: string;
      recordId: string;
      oldFolderName: string;
      newFolderName: string;
    };

    if (!objectApiName || !recordId || !oldFolderName || !newFolderName) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    // Nothing to do if names are the same
    if (oldFolderName.trim() === newFolderName.trim()) {
      return reply.send({ renamed: false, reason: 'same_name' });
    }

    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    const oldPath = buildFolderPath(objectApiName, recordId, oldFolderName);
    const newPath = buildFolderPath(objectApiName, recordId, newFolderName);

    try {
      await dropboxApi(accessToken, '/files/move_v2', {
        from_path: oldPath,
        to_path: newPath,
        autorename: false,
        allow_ownership_transfer: false,
      });
      reply.send({ renamed: true, oldPath, newPath });
    } catch (err: any) {
      // If old folder doesn't exist, just let the ensure-folder create the new one
      if (err.message?.includes('not_found')) {
        return reply.send({ renamed: false, reason: 'old_folder_not_found' });
      }
      // If new path already exists, that's also acceptable
      if (err.message?.includes('409') || err.message?.includes('conflict')) {
        return reply.send({ renamed: false, reason: 'new_folder_exists' });
      }
      app.log.error(err, 'Dropbox rename folder failed');
      reply.code(500).send({ error: 'Failed to rename folder' });
    }
  });

  // ── Copy a file or folder between record folders ──
  app.post('/dropbox/copy', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { fromPath, toObjectApiName, toRecordId, toFolderName, toSubPath } = req.body as {
      fromPath: string;
      toObjectApiName: string;
      toRecordId: string;
      toFolderName?: string;
      toSubPath?: string;
    };

    if (!fromPath || !toObjectApiName || !toRecordId) {
      return reply.code(400).send({ error: 'Missing required fields: fromPath, toObjectApiName, toRecordId' });
    }

    // Validate source path is within CRM root
    if (!fromPath.toLowerCase().startsWith(CRM_ROOT_FOLDER.toLowerCase() + '/')) {
      return reply.code(400).send({ error: 'Invalid source path' });
    }

    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    // Extract filename from source path
    const fileName = fromPath.split('/').pop();
    if (!fileName) return reply.code(400).send({ error: 'Invalid source path' });

    // Build destination path
    const destFolder = buildFolderPath(toObjectApiName, toRecordId, toFolderName);
    const destBase = toSubPath ? `${destFolder}/${toSubPath}` : destFolder;
    const toPath = `${destBase}/${fileName}`;

    try {
      const result = await dropboxApi(accessToken, '/files/copy_v2', {
        from_path: fromPath,
        to_path: toPath,
        autorename: true,
      });
      reply.send({ success: true, path: result.metadata?.path_display || toPath });
    } catch (err: any) {
      if (err.message?.includes('not_found')) {
        return reply.code(404).send({ error: 'Source file not found' });
      }
      app.log.error(err, 'Dropbox copy failed');
      reply.code(500).send({ error: 'Failed to copy file' });
    }
  });

  // ── Rename a linked record folder inside a parent Property folder ──
  app.post('/dropbox/rename-linked-folder', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const {
      parentObjectApiName,
      parentFolderName,
      childObjectApiName,
      oldChildFolderName,
      newChildFolderName,
    } = req.body as {
      parentObjectApiName: string;
      parentFolderName: string;
      childObjectApiName: string;
      oldChildFolderName: string;
      newChildFolderName: string;
    };

    if (!parentObjectApiName || !parentFolderName || !childObjectApiName || !oldChildFolderName || !newChildFolderName) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    if (oldChildFolderName.trim() === newChildFolderName.trim()) {
      return reply.send({ renamed: false, reason: 'same_name' });
    }

    const subfolder = LINKED_RECORD_SUBFOLDER[childObjectApiName];
    if (!subfolder) {
      return reply.send({ renamed: false, reason: 'no_mapping' });
    }

    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    const parentPath = buildFolderPath(parentObjectApiName, '', parentFolderName);
    const safeOld = oldChildFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();
    const safeNew = newChildFolderName.replace(/[\\/:*?"<>|]/g, '_').trim();
    const oldPath = `${parentPath}/${subfolder}/${safeOld}`;
    const newPath = `${parentPath}/${subfolder}/${safeNew}`;

    try {
      await dropboxApi(accessToken, '/files/move_v2', {
        from_path: oldPath,
        to_path: newPath,
        autorename: false,
        allow_ownership_transfer: false,
      });
      reply.send({ renamed: true, oldPath, newPath });
    } catch (err: any) {
      if (err.message?.includes('not_found')) {
        return reply.send({ renamed: false, reason: 'old_folder_not_found' });
      }
      if (err.message?.includes('409') || err.message?.includes('conflict')) {
        return reply.send({ renamed: false, reason: 'new_folder_exists' });
      }
      app.log.error(err, 'Dropbox rename linked folder failed');
      reply.code(500).send({ error: 'Failed to rename linked folder' });
    }
  });
}
