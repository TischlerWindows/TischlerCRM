const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');

/**
 * Cleans up duplicate prefixed/unprefixed keys in Record.data JSON blobs.
 * For each record, if both "Lead__status" and "status" exist, keep the prefixed
 * value (it's more recent from edit) under the unprefixed key and remove the
 * prefixed key.
 */
async function main() {
  await c.connect();
  
  // Get all records
  const result = await c.query(`
    SELECT r.id, r.data, co."apiName" as "objectApiName"
    FROM "Record" r
    JOIN "CustomObject" co ON r."objectId" = co.id
  `);
  
  let updatedCount = 0;
  
  for (const row of result.rows) {
    const data = row.data;
    if (!data || typeof data !== 'object') continue;
    
    const objectPrefix = row.objectApiName + '__';
    let changed = false;
    const cleanData = { ...data };
    
    for (const key of Object.keys(data)) {
      if (key.startsWith(objectPrefix)) {
        const strippedKey = key.replace(objectPrefix, '');
        // Prefixed key value wins — write it to the stripped key
        cleanData[strippedKey] = data[key];
        // Remove the prefixed key
        delete cleanData[key];
        changed = true;
      }
    }
    
    // Also check for generic prefixed keys (e.g., from other object prefixes in lookup data)
    // Only clean keys that match this record's own object prefix
    
    if (changed) {
      console.log(`Cleaning record ${row.id} (${row.objectApiName}):`);
      // Show what changed
      for (const key of Object.keys(data)) {
        if (key.startsWith(objectPrefix)) {
          const stripped = key.replace(objectPrefix, '');
          if (data[stripped] !== undefined && data[stripped] !== data[key]) {
            console.log(`  ${key}: "${data[key]}" wins over ${stripped}: "${data[stripped]}"`);
          } else {
            console.log(`  ${key} -> ${stripped}: "${data[key]}"`);
          }
        }
      }
      
      await c.query('UPDATE "Record" SET data = $1 WHERE id = $2', [JSON.stringify(cleanData), row.id]);
      updatedCount++;
    }
  }
  
  console.log(`\nDone. Updated ${updatedCount} of ${result.rows.length} records.`);
  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
