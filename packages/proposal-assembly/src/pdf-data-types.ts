/**
 * Shape of the data the PDF renderer consumes. Output of the assembly layer.
 */

import type { SpecPresetData } from './quote-conditions.js';

export interface QuotePDFData {
  // People
  contactName: string;
  contactSalutation: string;
  contactLastName: string;
  companyName: string;
  companyAddress: string;

  // Project
  projectName: string;
  projectNumber: string;
  plansDated: string;
  jobType: string;
  address: string;
  salesman: string;
  estimator: string;

  // Materials
  glassType: string;
  woodType: string;
  finishType: string;
  sdlType: string;
  spacerBarColors: string;

  // Presets (already filtered and token-resolved)
  constantPresets?: SpecPresetData[];
  specPresets: SpecPresetData[];
  optionPresets: SpecPresetData[];
  exclusionPresets: SpecPresetData[];
  installationPresets: SpecPresetData[];

  // Pricing
  euroWindowsPrice: string;
  doubleHungPrice: string;
  euroDoorsPrice: string;
  grandTotal: string;
  hasEuroWindows: boolean;
  hasDoubleHung: boolean;
  hasEuroDoors: boolean;

  // Add-on pricing
  windowScreensPrice: string;
  windowScreensQty: string;
  doorScreenSashPrice: string;
  doorScreenSashQty: string;
  entryDoorPrice: string;
  entryDoorQty: string;
  jambExtensionsPrice: string;
  magneticContactPrice: string;
  magneticContactQty: string;
  finalFinishPrice: string;
  installationPrice: string;
  installationTotalPrice: string;
  installationRows: Array<{ label: string; price: string }>;

  // Flags
  hasInstallation: boolean;
  hasMagneticContacts: boolean;
  hasFinalFinish: boolean;
  hasWindowScreens: boolean;
  hasDoorScreenSash: boolean;
  hasEntryDoor: boolean;
  hasJambExtensions: boolean;
}
