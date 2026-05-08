/**
 * Seed script for the Standard Quote Letter template.
 *
 * Creates the default QuoteTemplate with ~31 SpecPresets and their conditions.
 * Based on the Tischler und Sohn reference quote letter format.
 *
 * Run: npx tsx packages/db/prisma/seed-quote-template.ts
 * (or import and call seedQuoteTemplate() from another seed script)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple ID generator (matches the app's record-id format)
function makeId(prefix: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 12; i++) {
    suffix += chars[Math.floor(Math.random() * 62)];
  }
  return prefix + suffix;
}

interface PresetSeed {
  title: string;
  body: string;
  section: 'SPECIFICATION' | 'OPTION' | 'EXCLUSION' | 'INSTALLATION' | 'BOILERPLATE';
  isAlwaysIncluded: boolean;
  conditions?: {
    field: string;
    operator: 'CONTAINS' | 'EQUALS' | 'NOT_EMPTY' | 'IS_TRUE' | 'IS_FALSE';
    value?: string;
    logic?: 'AND' | 'OR';
  }[];
}

export async function seedQuoteTemplate() {
  // Check if the template already exists (by name or default flag)
  const existing = await prisma.quoteTemplate.findFirst({
    where: { OR: [{ isDefault: true }, { name: 'Standard Quote Letter' }] },
  });
  if (existing) {
    console.log(`Template already exists: "${existing.name}" (${existing.id}). Skipping seed.`);
    return existing;
  }

  const templateId = makeId('042');
  console.log(`Creating default quote template: ${templateId}`);

  const presets: PresetSeed[] = [
    // ── SPECIFICATIONS (numbered in the quote letter) ──

    {
      title: 'Impact Glass',
      body: 'All windows and doors shall be glazed with {{glassType}} insulating glass meeting {{jobType}} impact requirements. Glass shall be tested and approved per the Florida Building Code and Miami-Dade County protocols where applicable.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'jobType', operator: 'CONTAINS', value: 'Dade', logic: 'AND' },
        { field: 'glassType', operator: 'CONTAINS', value: '#28', logic: 'AND' },
      ],
    },
    {
      title: 'Non-Impact Glass',
      body: 'All windows and doors shall be glazed with {{glassType}} insulating glass. Glass units shall meet applicable energy code requirements.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'jobType', operator: 'CONTAINS', value: 'Non-Impact' },
      ],
    },
    {
      title: 'Wood Species',
      body: 'All window and door frames shall be constructed from {{woodType}} mahogany, a tropical hardwood known for exceptional durability, dimensional stability, and natural resistance to rot and decay.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Spacer Bar System',
      body: 'Insulating glass units shall incorporate {{spacerBarColor}} spacer bars. Spacer bars are available in the following standard colors at no additional charge: Standard White, Silver, Brown, Black.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'SDL Muntins',
      body: 'Windows specified with Simulated Divided Lites (SDL) shall receive {{sdlType}} muntins applied to the exterior and interior surfaces of the glass, with a spacer bar between the panes to simulate a true divided lite appearance.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'sdlType', operator: 'NOT_EMPTY' },
      ],
    },
    {
      title: 'Sill Horns',
      body: 'All windows shall include traditional sill horns as part of the standard frame profile, providing both aesthetic appeal and improved water management at the sill corners.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasWindows', operator: 'IS_TRUE' },
      ],
    },
    {
      title: 'Dip Impregnation',
      body: 'All wood components shall receive factory dip impregnation treatment with a wood preservative to protect against fungal attack, insect damage, and moisture infiltration prior to finishing.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Finish Coat',
      body: 'All exposed wood surfaces shall receive a {{finishType}} factory-applied finish system consisting of primer and topcoat(s). The finish system provides UV protection, moisture resistance, and long-term durability.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'finishType', operator: 'NOT_EMPTY' },
      ],
    },
    {
      title: 'Tempered Glass — Doors',
      body: 'All door glass shall be tempered safety glass in accordance with applicable building codes and ANSI Z97.1 safety glazing standards.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasDoors', operator: 'IS_TRUE' },
      ],
    },
    {
      title: 'Glazing Caulk',
      body: 'All glass units shall be set with a high-performance silicone-based glazing sealant providing a watertight and airtight seal between the glass and frame.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Security Hardware — Garden Doors',
      body: 'Garden doors shall be equipped with multi-point locking hardware for enhanced security. Hardware includes a keyed cylinder lock with multiple locking points engaging at the top, bottom, and side of the door panel.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasGardenDoor', operator: 'IS_TRUE', logic: 'AND' },
        { field: 'hardwareOptions', operator: 'CONTAINS', value: 'KFV RH', logic: 'OR' },
        { field: 'hardwareOptions', operator: 'CONTAINS', value: 'Corrosion Resistance RH', logic: 'OR' },
      ],
    },
    {
      title: '90-Degree Stops',
      body: 'All outswing windows shall include 90-degree opening restrictors to prevent over-extension of the sash and potential damage to the hardware or frame.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasOutswing', operator: 'IS_TRUE' },
      ],
    },
    {
      title: 'Handles',
      body: 'All operable windows and doors shall be provided with matching hardware handles in a coordinated finish. Handle style and finish to be selected from the Tischler standard hardware collection.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Hinges',
      body: 'All hinged windows and doors shall be equipped with concealed European-style hinges providing smooth operation, adjustability, and clean sight lines.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Weatherstripping',
      body: 'All operable units shall include factory-installed neoprene gasket weatherstripping providing an effective seal against air and water infiltration. Weatherstripping is replaceable in the field without removing the sash.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Bronze Thresholds — Doors',
      body: 'All entry doors and garden doors shall include extruded bronze thresholds for durability and weather resistance at the floor line.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasDoors', operator: 'IS_TRUE' },
      ],
    },
    {
      title: 'Lift & Roll Hardware',
      body: 'Lift and Roll doors/windows shall include the Tischler lift and roll hardware system, featuring a handle-operated lift mechanism that raises the panel off the track for smooth, effortless sliding operation.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasLiftRoll', operator: 'IS_TRUE' },
      ],
    },
    {
      title: 'Warranty',
      body: 'Tischler und Sohn provides a comprehensive warranty covering materials and workmanship. Please refer to the Tischler warranty document for complete terms, conditions, and exclusions.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Shipment',
      body: 'Windows and doors shall be shipped from the factory in protective packaging suitable for ocean container transit. Delivery is FOB job site. Buyer is responsible for unloading and safe storage upon delivery.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Installation Materials',
      body: 'Our quote includes all necessary installation hardware, anchors, shims, sealants, and fasteners required for proper installation per Tischler installation guidelines.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Shop Drawings',
      body: 'Tischler und Sohn will provide detailed shop drawings for review and approval prior to production. Shop drawings will include frame dimensions, glass sizes, hardware locations, and installation details.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Down Payment & Terms',
      body: 'A 50% deposit is required upon approval of shop drawings to initiate production. The remaining balance is due prior to shipment. Prices are valid for 30 days from the date of this proposal.',
      section: 'SPECIFICATION',
      isAlwaysIncluded: true,
    },

    // ── EXCLUSIONS ──

    {
      title: 'Permits and Engineering',
      body: 'Building permits, engineering, or product approvals required by the authority having jurisdiction.',
      section: 'EXCLUSION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Interior/Exterior Trim',
      body: 'Interior and exterior trim, casing, or millwork beyond the window/door frame.',
      section: 'EXCLUSION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Structural Modifications',
      body: 'Structural modifications, header reinforcement, or rough opening preparation.',
      section: 'EXCLUSION',
      isAlwaysIncluded: true,
    },
    {
      title: 'Stucco / Waterproofing',
      body: 'Stucco patching, waterproofing membrane, or exterior wall finish restoration.',
      section: 'EXCLUSION',
      isAlwaysIncluded: true,
    },

    // ── OPTIONS (add-ons) ──

    {
      title: 'Magnetic Alarm Contacts',
      body: 'Factory-installed magnetic alarm contacts for connection to the building security system. Contacts are recessed into the frame for a clean appearance.',
      section: 'OPTION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasMagneticContacts', operator: 'IS_TRUE' },
      ],
    },
    {
      title: 'Final Finish',
      body: 'On-site final finish touch-up and inspection service to address any shipping or installation damage to the factory finish.',
      section: 'OPTION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasFinalFinish', operator: 'IS_TRUE' },
      ],
    },

    // ── INSTALLATION ──

    {
      title: 'Installation Scope',
      body: 'Installation of all windows and doors per Tischler installation guidelines and manufacturer specifications. Installation includes setting frames, shimming, leveling, sealing, and hardware adjustment.',
      section: 'INSTALLATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasInstallation', operator: 'IS_TRUE' },
      ],
    },
    {
      title: 'Installation Exclusions',
      body: 'Installation pricing does not include: removal or disposal of existing windows/doors, structural modifications, drywall/plaster repair, exterior stucco or siding repair, interior or exterior trim/casing, painting or finishing of surrounding surfaces, scaffolding or special access equipment, or work in occupied spaces requiring special scheduling.',
      section: 'INSTALLATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasInstallation', operator: 'IS_TRUE' },
      ],
    },
    {
      title: 'Installation Terms',
      body: 'Installation payment terms: 50% due at start of installation, remaining 50% due upon substantial completion. Installation timeline to be coordinated with the general contractor and is subject to site readiness.',
      section: 'INSTALLATION',
      isAlwaysIncluded: false,
      conditions: [
        { field: 'hasInstallation', operator: 'IS_TRUE' },
      ],
    },
  ];

  // Create template + all presets + conditions in a transaction
  await prisma.$transaction(async (tx) => {
    // Create the template
    await tx.quoteTemplate.create({
      data: {
        id: templateId,
        name: 'Standard Quote Letter',
        description: 'Default quote letter template for Tischler und Sohn proposals',
        isDefault: true,
        isActive: true,
      },
    });

    // Create presets with conditions
    for (let i = 0; i < presets.length; i++) {
      const p = presets[i];
      const presetId = makeId('043');

      await tx.specPreset.create({
        data: {
          id: presetId,
          templateId,
          order: i,
          title: p.title,
          body: p.body,
          section: p.section,
          isAlwaysIncluded: p.isAlwaysIncluded,
          isActive: true,
        },
      });

      if (p.conditions && p.conditions.length > 0) {
        await tx.specCondition.createMany({
          data: p.conditions.map((c) => ({
            id: makeId('044'),
            presetId,
            field: c.field,
            operator: c.operator,
            value: c.value ?? null,
            logic: c.logic ?? 'AND',
          })),
        });
      }
    }
  });

  console.log(`Created "Standard Quote Letter" template with ${presets.length} presets.`);
  return { id: templateId, presetCount: presets.length };
}

// Run directly if executed as a script
if (require.main === module) {
  seedQuoteTemplate()
    .then((result) => {
      console.log('Seed complete:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
