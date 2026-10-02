export const INSTALLATION_MATERIAL_TEMPLATES = ['ACQ', 'Non-ACQ', 'US Supplied Inst.'] as const
export const INSTALLATION_METHODS = ['Installation by TuS', 'Installation by Others', 'Dade County installation'] as const
export const MATERIAL_SOURCES = ['Tischler Fensterwerk', 'CT Warehouse', 'Other', 'FL Warehouse'] as const
export const INSTALLATION_MATERIAL_ROW_COUNT = 50

export interface InstallationMaterialRow {
  qty: string
  units: string
  description: string
  screwSize: string
  unitPrice: string
}

export interface InstallationMaterial {
  template: typeof INSTALLATION_MATERIAL_TEMPLATES[number]
  date: string
  factory: string
  project: string
  location: string
  projectManager: string
  attn: string
  installationBy: string[]
  orderedFrom: string[]
  rows: InstallationMaterialRow[]
  signature: string
  signatureDate: string
}

export interface InstallationMaterialWorkbook {
  version: 1
  activeTemplate: typeof INSTALLATION_MATERIAL_TEMPLATES[number]
  sheets: Record<typeof INSTALLATION_MATERIAL_TEMPLATES[number], InstallationMaterial>
}

function emptyRow(): InstallationMaterialRow {
  return { qty: '', units: '', description: '', screwSize: '', unitPrice: '' }
}

export const ACQ_FIXED_ROWS: Omit<InstallationMaterialRow, 'qty'>[] = [
  { units: 'Box', description: 'Qty. 200 - 6/10 x 80 mm Toptec (Ruspert Finish)', screwSize: '1/4" x 3-1/8"', unitPrice: '77.04' },
  { units: 'Box', description: 'Qty. 200 - 6/10 x 100 mm Toptec (Ruspert Finish)', screwSize: '1/4" x 3-15/16"', unitPrice: '99.94' },
  { units: 'Box', description: 'Qty. 100 - 6/10 x 120 mm Toptec (Ruspert Finish)', screwSize: '1/4" x 4-3/4"', unitPrice: '99.94' },
  { units: 'Box', description: 'Qty. 100 - 6/10 x 135 mm Toptec (Ruspert Finish)', screwSize: '1/4" x 5-5/16"', unitPrice: '68.88' },
  { units: 'Box', description: 'Qty. 100 - 6/10 x 150 mm Toptec (Ruspert Finish)', screwSize: '1/4" x 5-7/8"', unitPrice: '123.84' },
  { units: 'Box', description: 'Qty. 100 - 6/10 x 200 mm Toptec (Ruspert Finish)', screwSize: '1/4" x 7-7/8"', unitPrice: '155.53' },
  { units: 'EA', description: 'Qty. 1 - 8 mm x 165/235 Toptec Wood Auger Drill Bit f. shields', screwSize: '5/16"', unitPrice: '13.56' },
  { units: 'Box', description: 'Qty. 100 - 8mm Toptec Nylon dowel (shields)', screwSize: '', unitPrice: '6.22' },
  { units: 'EA', description: 'Qty. 1 - 8mm Toptec Drill Bit Supra f. stone', screwSize: '', unitPrice: '8.04' },
  { units: 'Pack', description: 'Qty. 10 - Toptec TX 20 Torx bit', screwSize: '', unitPrice: '78.20' },
  { units: 'Pack', description: 'Qty. 10 - Toptec TX 25 Torx bit', screwSize: '', unitPrice: '78.20' },
  { units: 'Box', description: 'Qty. 50 - Toptec Inserts', screwSize: '', unitPrice: '4.99' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Chocolate Brown-RAL8017)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Brown Beige-RAL1011)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Light Ivory-RAL1015)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Light Grey-RAL7035)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Anthracite Grey-RAL7016)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Traffic White-RAL9016)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 1000 - Toptec Caps (Custom RAL Color) * 3-4 Week Lead Time', screwSize: '', unitPrice: '150.00' },
  { units: 'Box', description: 'Qty. 500 - 3x20 mm Wood Screws SS DH Frames Torx 10', screwSize: '#4 x 3/4"', unitPrice: '20.59' },
  { units: 'Box', description: 'Qty. 500 - 3x25 mm Wood Screws SS DH Frames Torx 10', screwSize: '#4 x 1"', unitPrice: '17.26' },
  { units: 'Box', description: 'Qty. 500 - 4x35 mm Wood Screws SS Frames Torx 20 (NOT DC APPROVED)', screwSize: '#8 x 1-3/8"', unitPrice: '33.98' },
  { units: 'Box', description: 'Qty. 200 - 4x40 mm Wood Screws SS Frames Torx 20', screwSize: '#8 x 1-1/2"', unitPrice: '26.11' },
  { units: 'Box', description: 'Qty. 200 - 4x40 mm Wood Screws SS, PZ2 (Pan Head) (Phillips)', screwSize: '#8 x 1-1/2"', unitPrice: '28.80' },
  { units: 'Box', description: 'Qty. 200 - 4x40 mm Wood Screws SS, PZ2 (Flat Head) (Phillips)', screwSize: '#8 x 1-1/2"', unitPrice: '0.00' },
  { units: 'Box', description: 'Qty. 200 - 5x50 mm Screws SS Frames Torx 25', screwSize: '#10 x 2"', unitPrice: '29.08' },
  { units: 'Box', description: 'Qty. 100 - 5x90 mm Screws SS Frames (Flat Head) (Phillips)', screwSize: '#10 x 3-1/2"', unitPrice: '24.49' },
  { units: 'Box', description: 'Qty. 100 - 5x100 mm Screws SS Frames (Flat Head) (Phillips)', screwSize: '#10 x 4"', unitPrice: '26.15' },
  { units: 'Box', description: 'Qty. 200 - 6x40 mm Screws SS Substrate (Flat Head) (Phillips)', screwSize: '#14 x 1-1/2"', unitPrice: '27.40' },
  { units: 'Box', description: 'Qty. 200 - 6x50 mm Screws SS Substrate (Flat Head) (Phillips)', screwSize: '#14 x 2"', unitPrice: '' },
  { units: 'Box', description: 'Qty. 100 - 6x70 mm Screws SS Substrate (Flat Head) (Phillips)', screwSize: '#14 x 2-3/4"', unitPrice: '18.51' },
  { units: 'Box', description: 'Qty. 100 - 6x80 mm Screws SS Substrate (Flat Head) (Phillips)', screwSize: '#14 x 3-1/8"', unitPrice: '25.59' },
  { units: 'Box', description: 'Qty. 100 - 6x100 mm Screws SS Substrate (Flat Head) (Phillips)', screwSize: '#14 x 4"', unitPrice: '28.91' },
  { units: 'Box', description: 'Qty. 100 - 6x120 mm Screws SS Substrate (Flat Head) (Phillips)', screwSize: '#14 x 4-3/4"', unitPrice: '36.36' },
  { units: 'Box', description: 'Qty. 100 - 6x140 mm Screws SS Substrate (Flat Head) (Phillips)', screwSize: '#14 x 5-1/2"', unitPrice: '46.07' },
  { units: 'Box', description: 'Qty. 250 - Self-Tapping Screw Hex Head SS 6.3 x 25 mm', screwSize: '1/4" x 1"', unitPrice: '38.00' },
  { units: 'Box', description: 'Qty. 250 - Self-Tapping Screw Hex Head SS 6.3 x 32 mm', screwSize: '1/4" x 1-1/4"', unitPrice: '38.00' },
  { units: 'EA', description: 'Qty. 50 - BTI perforated plate 140 x 60 x 2 mm', screwSize: '5-1/2" x 2-3/8" x 1/16"', unitPrice: '36.00' },
  { units: 'Box', description: 'Qty. 100 - Installation Clips (140x2x25) - Standard (Meesenburg)', screwSize: '5-1/2" x 1/16" x 1"', unitPrice: '29.70' },
  { units: 'Box', description: 'Qty. 100 - Installation Clips (140x2x20) - Dade County (Meesenburg)', screwSize: '5-1/2" x 1/16" x 13/16"', unitPrice: '18.73' },
  { units: 'Case', description: 'Qty. 16 - Cans Insulation Foam (BTI Pistol Foam OZ-SR)', screwSize: '', unitPrice: '133.12' },
  { units: 'EA', description: 'Qty. 1 - Foam Gun', screwSize: '', unitPrice: '52.00' },
  { units: 'EA', description: 'Qty. 1 - Can Foam Gun Cleaner', screwSize: '', unitPrice: '11.00' },
  { units: 'EA', description: 'Qty. 1 - BTI (Sausage Gun) S 600 #9094301', screwSize: '', unitPrice: '68.00' },
  { units: 'EA', description: 'Qty. 1 - Siegenia Adjustment Tool', screwSize: '', unitPrice: '14.20' },
  { units: 'EA', description: '2.5 mm Allen Wrench with T-handle for friction brakes', screwSize: '', unitPrice: '4.00' },
  { units: 'EA', description: 'KFV Church Plastic Key', screwSize: '', unitPrice: '9.00' },
  { units: 'EA', description: 'BTI Metal Counter Sink Drill Bit (Hexagonal Shaft)', screwSize: '', unitPrice: '25.85' },
  { units: '', description: 'Wax to fill nail holes - matching color of brickmold (if possible)', screwSize: '', unitPrice: '' },
  { units: '', description: 'Exterior caulk for perimeter at brickmold - matching color of brickmold (if possible)', screwSize: '', unitPrice: '' },
].map(row => ({ ...row, qty: '' }))

export const NON_ACQ_FIXED_ROWS: Omit<InstallationMaterialRow, 'qty'>[] = [
  { units: 'Box', description: 'Qty. 200 - 6/10 x 80 mm Zink Toptec Standard', screwSize: '1/4" x 3-1/8"', unitPrice: '58.40' },
  { units: 'Box', description: 'Qty. 200 - 6/10 x 100 mm Zink Toptec Standard', screwSize: '1/4" x 3-15/16"', unitPrice: '77.04' },
  { units: 'Box', description: 'Qty. 100 - 6/10 x 120 mm Zink Toptec Standard', screwSize: '1/4" x 4-3/4"', unitPrice: '77.04' },
  { units: 'Box', description: 'Qty. 100 - 6/10 x 135 mm Zink Toptec Standard', screwSize: '1/4" x 5-5/16"', unitPrice: '48.88' },
  { units: 'Box', description: 'Qty. 100 - 6/10 x 150 mm Zink Toptec Standard', screwSize: '1/4" x 5-7/8"', unitPrice: '103.84' },
  { units: 'EA', description: 'Qty. 1 - 8 mm x 165/235 Toptec Wood Auger Drill Bit f. shields', screwSize: '5/16"', unitPrice: '13.56' },
  { units: 'Box', description: 'Qty. 100 - Toptec Nylon dowels (shields)', screwSize: '', unitPrice: '6.22' },
  { units: 'EA', description: 'Qty. 1 - 8mm Toptec Drill Bit Supra f. stone', screwSize: '', unitPrice: '8.04' },
  { units: 'Pack', description: 'Qty. 10 - Toptec TX 25 Torx bit', screwSize: '', unitPrice: '78.20' },
  { units: 'Box', description: 'Qty. 50 - Toptec Inserts', screwSize: '', unitPrice: '4.99' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Chocolate Brown-RAL8017)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Brown Beige-RAL1011)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Light Ivory-RAL1015)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Light Grey-RAL7035)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Anthracite Grey-RAL7016)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 50 - Toptec Caps (Traffic White-RAL9016)', screwSize: '', unitPrice: '4.76' },
  { units: 'Box', description: 'Qty. 1000 - Toptec Caps (Custom RAL Color) *3-4 Week Lead Time', screwSize: '', unitPrice: '150.00' },
  { units: 'Box', description: 'Qty. 1000 - 3x20 mm Wood Screws SPAX DH Frames (Flat Head) (Phillips)', screwSize: '#4 x 3/4"', unitPrice: '17.49' },
  { units: 'Box', description: 'Qty. 500 - 4x35 mm Screws SPAX DH Frames (NOT DC APPROVED)', screwSize: '#8 x 1-3/8"', unitPrice: '13.69' },
  { units: 'Box', description: 'Qty. 500 - 4x40 mm FH Wood Screws SPAX DH Frames (Flat Head) (Phillips)', screwSize: '#8 x 1-1/2"', unitPrice: '11.13' },
  { units: 'Box', description: 'Qty. 200 - 6x40 mm Screws SPAX Substrate (Flat Head) (Phillips)', screwSize: '#14 x 1-9/16"', unitPrice: '11.56' },
  { units: 'Box', description: 'Qty. 200 - 6x70 mm Screws SPAX Substrate (Flat Head) (Phillips)', screwSize: '#14 x 2-3/4"', unitPrice: '16.40' },
  { units: 'Box', description: 'Qty. 100 - 6x80 mm Screws SPAX Substrate (Flat Head) (Phillips)', screwSize: '#14 x 3-1/8"', unitPrice: '25.44' },
  { units: 'Box', description: 'Qty. 100 - 6x90 mm Screws SPAX Substrate (Flat Head) (Phillips)', screwSize: '#14 x 3-9/16"', unitPrice: '28.32' },
  { units: 'Box', description: 'Qty. 100 - 6x100 mm Screws SPAX Substrate (Flat Head) (Phillips)', screwSize: '#14 x 3-15/16"', unitPrice: '32.45' },
  { units: 'Box', description: 'Qty. 100 - 6x120 mm Screws SPAX Substrate (Flat Head) (Phillips)', screwSize: '#14 x 4-3/4"', unitPrice: '39.46' },
  { units: 'Box', description: 'Qty. 100 - 6x140 mm Screws SPAX Substrate (Flat Head) (Phillips)', screwSize: '#14 x 5-1/2"', unitPrice: '54.86' },
  { units: 'Box', description: 'Qty. 250 Self-Tapping Screw Hex Head SS 6.3 x 25 mm', screwSize: '1/4" x 1"', unitPrice: '38.00' },
  { units: 'Box', description: 'Qty. 250 Self-Tapping Screw Hex Head SS 6.3 x 32 mm', screwSize: '1/4" x 1-1/4"', unitPrice: '38.00' },
  { units: 'EA', description: 'Qty. 10 Drill Bit for Self-Tapping Screw w/ Hex Head 6.3 mm', screwSize: '1/4"', unitPrice: '32.60' },
  { units: 'EA', description: 'Qty. 50 BTI perforated plate 140 x 60 x 2 mm', screwSize: '5-1/2" x 2-3/8" x 1/16"', unitPrice: '36.00' },
  { units: 'Box', description: 'Qty. 100 - Installation Clips (140x2x25) - Standard', screwSize: '5-1/2" x 1/16" x 1"', unitPrice: '29.70' },
  { units: 'Box', description: 'Qty. 100 - Installation Clips (140x2x20) - Dade County', screwSize: '5-1/2" x 1/16" x 13/16"', unitPrice: '18.73' },
  { units: 'Case', description: 'Qty. 16 - Cans Insulation Foam (BTI Pistol Foam OZ-SR)', screwSize: '', unitPrice: '133.12' },
  { units: 'EA', description: 'Qty. 1 - Foam Gun', screwSize: '', unitPrice: '52.00' },
  { units: 'EA', description: 'Qty. 1 - Can Foam Gun Cleaner', screwSize: '', unitPrice: '11.00' },
  { units: 'EA', description: 'Qty. 1 - BTI (Sausage Gun) S 600 # 9094301', screwSize: '', unitPrice: '68.00' },
  { units: 'EA', description: 'Qty. 1 - Siegenia Adjustment Tool', screwSize: '', unitPrice: '14.20' },
  { units: 'EA', description: '2.5 mm Allen Wrench with T-handle for friction brakes', screwSize: '', unitPrice: '4.00' },
  { units: 'EA', description: 'KFV Church Plastic Key', screwSize: '', unitPrice: '9.00' },
  { units: 'EA', description: 'Metal Counter Sink Drill Bit (Hexagonal Shaft)', screwSize: '', unitPrice: '25.85' },
].map(row => ({ ...row, qty: '' }))

export const US_SUPPLIED_FIXED_ROWS: Omit<InstallationMaterialRow, 'qty'>[] = [
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 1-1/4"', screwSize: '7 x 30 mm', unitPrice: '11.31' },
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 1-3/4"', screwSize: '7 x 44 mm', unitPrice: '12.83' },
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 2-1/4"', screwSize: '7 x 57 mm', unitPrice: '14.63' },
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 2-3/4"', screwSize: '7 x 70 mm', unitPrice: '16.78' },
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 3-1/4"', screwSize: '7 x 83 mm', unitPrice: '21.23' },
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 3-3/4"', screwSize: '7 x 95 mm', unitPrice: '41.79' },
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 4"', screwSize: '7 x 102 mm', unitPrice: '26.45' },
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 5" Low Carbon', screwSize: '7 x 127 mm', unitPrice: '51.27' },
  { units: 'Box (100)', description: '1/4" FH Tapcon Screws x 6" Steel', screwSize: '7 x 152 mm', unitPrice: '65.22' },
  { units: 'Box (100)', description: 'Tapcon Caps', screwSize: '', unitPrice: '2.79' },
  { units: 'Box (100)', description: '1/4" Hex Head Tapcon Screws x 1-3/4" (angles)', screwSize: '7 x 45 mm', unitPrice: '13.00' },
  { units: 'EA', description: '3/16" x 3-1/2" Drill Bit for 1/4" Tapcon Screws', screwSize: '5 x 89 mm', unitPrice: '2.40' },
  { units: 'EA', description: '3/16" x 6-1/2" Drill Bit for 1/4" Tapcon Screws', screwSize: '5 x 165 mm', unitPrice: '3.30' },
  { units: 'Box (100)', description: '1/4" Pan Head #410 SS Self Drilling (#14) x 1"', screwSize: '7 x 25 mm', unitPrice: '15.00' },
  { units: 'Box (100)', description: '1/4" FH Phil #410 SS Self Drilling (#14) x 1-1/4"', screwSize: '7 x 30 mm', unitPrice: '15.50' },
  { units: 'Box (100)', description: '1/4" FH Phil #410 SS Self Drilling (#14) x 1-1/2"', screwSize: '7 x 40 mm', unitPrice: '16.25' },
  { units: 'Box (100)', description: '1/4" FH Phil #410 SS Self Drilling (#14) x 1-3/4"', screwSize: '7 x 45 mm', unitPrice: '25.80' },
  { units: 'Box (100)', description: '1/4" FH Phil #410 SS Self Drilling (#14) x 2"', screwSize: '7 x 50 mm', unitPrice: '22.50' },
  { units: 'Box (100)', description: '1/4" FH Phil #410 SS Self Drilling (#14) x 2-1/2"', screwSize: '7 x 60 mm', unitPrice: '26.00' },
  { units: 'Box (100)', description: '1/4" FH Phil #410 SS Self Drilling (#14) x 3"', screwSize: '7 x 75 mm', unitPrice: '35.75' },
  { units: 'Box (100)', description: '1/4" FH Phil #410 SS Self Drilling (#14) x 3-1/2"', screwSize: '7 x 90 mm', unitPrice: '46.00' },
  { units: 'Box (100)', description: '1/4" FH Phil #410 SS Self Drilling (#14) x 4"', screwSize: '7 x 100 mm', unitPrice: '57.00' },
  { units: 'Box (100)', description: '1/4" FH Phil SS Sheet Metal Screw (#14) x 1"', screwSize: '7 x 25 mm', unitPrice: '5.00' },
  { units: 'Box (100)', description: '1/4" FH Phil SS SMS (#14) x 1-1/4"', screwSize: '7 x 30 mm', unitPrice: '5.50' },
  { units: 'Box (100)', description: '1/4" FH Phil SS SMS (#14) x 1-1/2"', screwSize: '7 x 40 mm', unitPrice: '7.75' },
  { units: 'Box (100)', description: '1/4" FH Phil SS SMS (#14) x 1-3/4"', screwSize: '7 x 45 mm', unitPrice: '9.50' },
  { units: 'Box (100)', description: '1/4" FH Phil SS SMS (#14) x 2"', screwSize: '7 x 50 mm', unitPrice: '9.75' },
  { units: 'Box (100)', description: '1/4" FH Phil SS SMS (#14) x 2-1/2"', screwSize: '7 x 60 mm', unitPrice: '10.00' },
  { units: 'Box (100)', description: '1/4" FH Phil SS SMS (#14) x 3"', screwSize: '7 x 75 mm', unitPrice: '11.85' },
  { units: 'Box (100)', description: '1/4" FH Phil SS SMS (#14) x 3-1/2"', screwSize: '7 x 90 mm', unitPrice: '13.35' },
  { units: 'Box (100)', description: '1/4" FH Phil SS SMS (#14) x 4"', screwSize: '7 x 100 mm', unitPrice: '32.00' },
  { units: 'Tube', description: 'Caulk - Sikaflex 1A - Specify color', screwSize: '', unitPrice: '5.20' },
  { units: 'Tube', description: 'Caulk - Dow Corning 795 Paintable. Specify color:', screwSize: '', unitPrice: '8.09' },
  { units: 'Tube', description: 'Caulk - Custom - BASF NP1 - Limestone color', screwSize: '', unitPrice: '' },
  { units: 'EA', description: 'Qty. 1 Can of Installation Foam (4W Vario Foam)', screwSize: '', unitPrice: '10.20' },
  { units: 'FT', description: 'Backer Rod (Closed cell foam on a roll) 1/4", 3/8", 1/2", 5/8"', screwSize: '', unitPrice: '5.50' },
  { units: 'Box (250)', description: 'Black Plastic Shims - 1/16"', screwSize: '', unitPrice: '12.50' },
  { units: 'Box (250)', description: 'Black Plastic Shims - 1/8"', screwSize: '', unitPrice: '25.00' },
  { units: 'Box (250)', description: 'Black Plastic Shims - 1/4"', screwSize: '', unitPrice: '50.00' },
  { units: 'Box (250)', description: 'Black Plastic Shims - 1/2" (3 x 3)', screwSize: '', unitPrice: '125.00' },
  { units: 'Box (250)', description: 'Composed Shims', screwSize: '', unitPrice: '40.55' },
  { units: 'EA', description: 'Aluminum Angle pieces', screwSize: '', unitPrice: '1.80' },
  { units: 'EA', description: 'Insulating Tape for Aluminum Angles', screwSize: '', unitPrice: '13.28' },
  { units: 'EA', description: 'Metal Counter Sink Drill', screwSize: '', unitPrice: '' },
].map(row => ({ ...row, qty: '' }))

export function parseInstallationMaterial(raw: unknown, projectName = ''): InstallationMaterial {
  let data: Record<string, unknown> = {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
  } catch { /* Invalid stored data starts as a blank form. */ }
  const text = (value: unknown) => typeof value === 'string' ? value : ''
  const selected = (value: unknown, options: readonly string[]) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && options.includes(item))
    : []
  const orderedFromValues = Array.isArray(data.orderedFrom)
    ? data.orderedFrom.map(value => value === 'Korn' ? 'Tischler Fensterwerk' : value)
    : data.orderedFrom
  const rows = Array.isArray(data.rows) ? data.rows.slice(0, 100).map((row: unknown) => {
    const item = row && typeof row === 'object' ? row as Record<string, unknown> : {}
    return {
      qty: text(item.qty), units: text(item.units), description: text(item.description),
      screwSize: text(item.screwSize), unitPrice: text(item.unitPrice),
    }
  }) : []

  const template = INSTALLATION_MATERIAL_TEMPLATES.includes(data.template as typeof INSTALLATION_MATERIAL_TEMPLATES[number])
    ? data.template as typeof INSTALLATION_MATERIAL_TEMPLATES[number] : INSTALLATION_MATERIAL_TEMPLATES[0]
  const fixedRows = template === 'ACQ'
    ? ACQ_FIXED_ROWS
    : template === 'Non-ACQ'
      ? NON_ACQ_FIXED_ROWS
      : template === 'US Supplied Inst.'
        ? US_SUPPLIED_FIXED_ROWS
        : null
  const normalizedRows = fixedRows
    ? fixedRows.map((fixed, index) => ({
      ...fixed,
      qty: rows[index]?.qty ?? '',
      unitPrice: rows[index]?.unitPrice ?? fixed.unitPrice,
    }))
    : rows.length
      ? [...rows, ...Array.from({ length: Math.max(0, INSTALLATION_MATERIAL_ROW_COUNT - rows.length) }, emptyRow)]
      : Array.from({ length: INSTALLATION_MATERIAL_ROW_COUNT }, emptyRow)
  return {
    template,
    date: text(data.date), factory: text(data.factory), project: text(data.project) || projectName,
    location: text(data.location), projectManager: text(data.projectManager), attn: text(data.attn),
    installationBy: selected(data.installationBy, INSTALLATION_METHODS),
    orderedFrom: selected(orderedFromValues, MATERIAL_SOURCES),
    rows: normalizedRows,
    signature: text(data.signature), signatureDate: text(data.signatureDate),
  }
}

export function parseInstallationMaterialWorkbook(raw: unknown, projectName = ''): InstallationMaterialWorkbook {
  let data: Record<string, unknown> = {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
  } catch { /* Invalid stored data starts with three blank sheets. */ }

  const rawSheets = data.sheets && typeof data.sheets === 'object' && !Array.isArray(data.sheets)
    ? data.sheets as Record<string, unknown>
    : null

  let sheets = Object.fromEntries(INSTALLATION_MATERIAL_TEMPLATES.map(template => [
    template,
    parseInstallationMaterial(rawSheets?.[template] ?? { template }, projectName),
  ])) as InstallationMaterialWorkbook['sheets']

  if (!rawSheets) {
    const legacy = parseInstallationMaterial(data, projectName)
    sheets = { ...sheets, [legacy.template]: legacy }
  }

  return { version: 1, activeTemplate: 'ACQ', sheets }
}

export function calculateMaterialTotal(row: InstallationMaterialRow): number {
  const quantity = Number(row.qty.replace(/,/g, '')) || 0
  const unitPrice = Number(row.unitPrice.replace(/[$,€\s]/g, '')) || 0
  return quantity * unitPrice
}

export function formatMaterialTotal(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface AutoCadQuantityInput {
  fastener: unknown
  totalQty: unknown
}

export interface GeneratedMaterialQuantities {
  rows: InstallationMaterialRow[]
  matchedFasteners: number
  unmatchedFasteners: string[]
  ambiguousFasteners: string[]
}

function compact(value: string): string {
  return value.toLowerCase().replace(/×/g, 'x').replace(/[^a-z0-9/.-]/g, '')
}

function sizeKey(value: string): string | null {
  const normalized = compact(value.replace(/^\s*qty\.?\s*[\d,]+\s*-\s*/i, ''))
  const dimensions = normalized.match(/\d+(?:\/\d+)?(?:-\d+\/\d+)?x\d+(?:-\d+\/\d+)?(?:mm)?/g)
  if (dimensions?.length) return dimensions[dimensions.length - 1]!
  const length = normalized.match(/x\d+(?:-\d+\/\d+)?(?:mm)?/g)
  return length?.length ? length[length.length - 1]! : null
}

function hasMatchingFamily(fastener: string, description: string): boolean {
  const source = compact(fastener)
  const target = compact(description)
  const families: Array<[string[], string[]]> = [
    [['toptec'], ['toptec']],
    [['tapcon'], ['tapcon']],
    [['selfdrilling'], ['selfdrilling', 'selfdrill']],
    [['wood'], ['wood', 'screw']],
    [['installationclips'], ['installationclips']],
    [['aluminumangle', 'aluminiumangle'], ['aluminumangle', 'aluminiumangle']],
    [['bti'], ['bti']],
  ]
  const present = families.filter(([sourceTerms]) => sourceTerms.some(term => source.includes(term)))
  return present.length === 0 || present.some(([, targetTerms]) => targetTerms.some(term => target.includes(term)))
}

function fastenerMatchScore(fastener: string, description: string): number {
  const source = compact(fastener)
  const target = compact(description)
  if (!hasMatchingFamily(fastener, description)) return Number.NEGATIVE_INFINITY
  let score = 0
  if (source.includes('panhead')) score += target.includes('panhead') ? 20 : -5
  if (source.includes('fhphil')) {
    if (target.includes('flathead')) score += 20
    else if (target.includes('torx')) score -= 2
  }
  if (source.includes('hexhead')) score += target.includes('hexhead') ? 20 : -5
  if (source.includes('selfdrilling')) score += target.includes('selfdrilling') || target.includes('selfdrill') ? 5 : 0
  if (source.includes('torx')) score += target.includes('torx') ? 10 : -2
  if (source.includes('bti')) score += target.includes('bti') ? 5 : 0
  return score
}

function matchesNonDimensionalFamily(fastener: string, description: string): boolean {
  const source = compact(fastener)
  const target = compact(description)
  if (source.includes('btibrackets')) return target.includes('btiperforatedplate')
  if (source.includes('installationclips')) return target.includes('installationclips')
  if (source.includes('aluminumangle') || source.includes('aluminiumangle')) {
    return target.includes('aluminumangle') || target.includes('aluminiumangle')
  }
  return false
}

export function generateInstallationMaterialQuantities(
  rows: InstallationMaterialRow[],
  autocadRows: AutoCadQuantityInput[],
): GeneratedMaterialQuantities {
  const quantities = new Map<number, number>()
  const unmatchedFasteners: string[] = []
  const ambiguousFasteners: string[] = []
  let matchedFasteners = 0

  for (const item of autocadRows) {
    const fastener = typeof item.fastener === 'string' ? item.fastener.trim() : ''
    const quantity = Number(String(item.totalQty ?? '').replace(/,/g, ''))
    if (!fastener || !Number.isFinite(quantity) || quantity === 0) continue

    const normalizedFastener = compact(fastener)
    const exactMatches = rows.flatMap((row, index) => {
      const normalizedDescription = compact(row.description)
      return normalizedDescription.includes(normalizedFastener) ? [index] : []
    })
    let matches = exactMatches
    if (matches.length === 0) {
      const key = sizeKey(fastener)
      if (key) {
        const scored = rows.flatMap((row, index) => {
          const score = sizeKey(row.description) === key ? fastenerMatchScore(fastener, row.description) : Number.NEGATIVE_INFINITY
          return Number.isFinite(score) ? [{ index, score }] : []
        })
        const bestScore = Math.max(...scored.map(candidate => candidate.score), Number.NEGATIVE_INFINITY)
        matches = scored.filter(candidate => candidate.score === bestScore).map(candidate => candidate.index)
      } else {
        matches = rows.flatMap((row, index) => matchesNonDimensionalFamily(fastener, row.description) ? [index] : [])
      }
    }

    if (matches.length === 1) {
      const index = matches[0]!
      quantities.set(index, (quantities.get(index) ?? 0) + quantity)
      matchedFasteners++
    } else if (matches.length > 1) {
      ambiguousFasteners.push(fastener)
    } else {
      unmatchedFasteners.push(fastener)
    }
  }

  return {
    rows: rows.map((row, index) => quantities.has(index)
      ? { ...row, qty: String(quantities.get(index)) }
      : { ...row }),
    matchedFasteners,
    unmatchedFasteners,
    ambiguousFasteners,
  }
}

export interface GeneratedMaterialWorkbookQuantities {
  sheets: InstallationMaterialWorkbook['sheets']
  matchedFasteners: number
  unmatchedFasteners: string[]
  ambiguousFasteners: string[]
}

export function generateInstallationMaterialWorkbookQuantities(
  sheets: InstallationMaterialWorkbook['sheets'],
  autocadRows: AutoCadQuantityInput[],
): GeneratedMaterialWorkbookQuantities {
  const generated = Object.fromEntries(INSTALLATION_MATERIAL_TEMPLATES.map(template => [
    template,
    generateInstallationMaterialQuantities(sheets[template].rows, autocadRows),
  ])) as Record<typeof INSTALLATION_MATERIAL_TEMPLATES[number], GeneratedMaterialQuantities>
  const results = INSTALLATION_MATERIAL_TEMPLATES.map(template => generated[template])

  return {
    sheets: Object.fromEntries(INSTALLATION_MATERIAL_TEMPLATES.map(template => [
      template,
      { ...sheets[template], rows: generated[template].rows },
    ])) as InstallationMaterialWorkbook['sheets'],
    matchedFasteners: results.reduce((total, result) => total + result.matchedFasteners, 0),
    unmatchedFasteners: results[0]!.unmatchedFasteners.filter(fastener =>
      results.every(result => result.unmatchedFasteners.includes(fastener))),
    ambiguousFasteners: INSTALLATION_MATERIAL_TEMPLATES.flatMap(template =>
      generated[template].ambiguousFasteners.map(fastener => `${template}: ${fastener}`)),
  }
}