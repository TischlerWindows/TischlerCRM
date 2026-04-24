/**
 * Property Number generation based on ISO 3166-1 alpha-3 country codes
 * and US state codes.
 *
 * Format: {PREFIX}{NNNN}
 *   - Non-US addresses: ISO 3166-1 alpha-3 country code (e.g. ABW0001)
 *   - US addresses:     Two-letter state code            (e.g. NY0001)
 *   - Unknown:          UNK0001
 *
 * The sequential number is global across all prefixes so every property
 * gets a unique number.
 */

// ─── Country name → ISO 3166-1 alpha-3 ────────────────────────────────
const COUNTRY_TO_ISO3: Record<string, string> = {
  'aruba': 'ABW',
  'afghanistan': 'AFG',
  'angola': 'AGO',
  'anguilla': 'AIA',
  'åland islands': 'ALA',
  'aland islands': 'ALA',
  'albania': 'ALB',
  'andorra': 'AND',
  'united arab emirates': 'ARE',
  'argentina': 'ARG',
  'armenia': 'ARM',
  'american samoa': 'ASM',
  'antarctica': 'ATA',
  'french southern territories': 'ATF',
  'antigua and barbuda': 'ATG',
  'australia': 'AUS',
  'austria': 'AUT',
  'azerbaijan': 'AZE',
  'burundi': 'BDI',
  'belgium': 'BEL',
  'benin': 'BEN',
  'bonaire, sint eustatius and saba': 'BES',
  'bonaire': 'BES',
  'burkina faso': 'BFA',
  'bangladesh': 'BGD',
  'bulgaria': 'BGR',
  'bahrain': 'BHR',
  'bahamas': 'BHS',
  'bosnia and herzegovina': 'BIH',
  'saint barthélemy': 'BLM',
  'saint barthelemy': 'BLM',
  'belarus': 'BLR',
  'belize': 'BLZ',
  'bermuda': 'BMU',
  'bolivia': 'BOL',
  'bolivia, plurinational state of': 'BOL',
  'brazil': 'BRA',
  'barbados': 'BRB',
  'brunei darussalam': 'BRN',
  'brunei': 'BRN',
  'bhutan': 'BTN',
  'bouvet island': 'BVT',
  'botswana': 'BWA',
  'central african republic': 'CAF',
  'canada': 'CAN',
  'cocos (keeling) islands': 'CCK',
  'cocos islands': 'CCK',
  'switzerland': 'CHE',
  'chile': 'CHL',
  'china': 'CHN',
  "côte d'ivoire": 'CIV',
  "cote d'ivoire": 'CIV',
  'ivory coast': 'CIV',
  'cameroon': 'CMR',
  'congo, democratic republic of the': 'COD',
  'democratic republic of the congo': 'COD',
  'dr congo': 'COD',
  'congo': 'COG',
  'cook islands': 'COK',
  'colombia': 'COL',
  'comoros': 'COM',
  'cabo verde': 'CPV',
  'cape verde': 'CPV',
  'costa rica': 'CRI',
  'cuba': 'CUB',
  'curaçao': 'CUW',
  'curacao': 'CUW',
  'christmas island': 'CXR',
  'cayman islands': 'CYM',
  'cyprus': 'CYP',
  'czechia': 'CZE',
  'czech republic': 'CZE',
  'germany': 'DEU',
  'djibouti': 'DJI',
  'dominica': 'DMA',
  'denmark': 'DNK',
  'dominican republic': 'DOM',
  'algeria': 'DZA',
  'ecuador': 'ECU',
  'egypt': 'EGY',
  'eritrea': 'ERI',
  'western sahara': 'ESH',
  'spain': 'ESP',
  'estonia': 'EST',
  'ethiopia': 'ETH',
  'finland': 'FIN',
  'fiji': 'FJI',
  'falkland islands': 'FLK',
  'falkland islands (malvinas)': 'FLK',
  'france': 'FRA',
  'faroe islands': 'FRO',
  'micronesia': 'FSM',
  'micronesia, federated states of': 'FSM',
  'gabon': 'GAB',
  'united kingdom': 'GBR',
  'united kingdom of great britain and northern ireland': 'GBR',
  'uk': 'GBR',
  'georgia': 'GEO',
  'guernsey': 'GGY',
  'ghana': 'GHA',
  'gibraltar': 'GIB',
  'guinea': 'GIN',
  'guadeloupe': 'GLP',
  'gambia': 'GMB',
  'guinea-bissau': 'GNB',
  'equatorial guinea': 'GNQ',
  'greece': 'GRC',
  'grenada': 'GRD',
  'greenland': 'GRL',
  'guatemala': 'GTM',
  'french guiana': 'GUF',
  'guam': 'GUM',
  'guyana': 'GUY',
  'hong kong': 'HKG',
  'heard island and mcdonald islands': 'HMD',
  'honduras': 'HND',
  'croatia': 'HRV',
  'haiti': 'HTI',
  'hungary': 'HUN',
  'indonesia': 'IDN',
  'isle of man': 'IMN',
  'india': 'IND',
  'british indian ocean territory': 'IOT',
  'ireland': 'IRL',
  'iran': 'IRN',
  'iran, islamic republic of': 'IRN',
  'iraq': 'IRQ',
  'iceland': 'ISL',
  'israel': 'ISR',
  'italy': 'ITA',
  'jamaica': 'JAM',
  'jersey': 'JEY',
  'jordan': 'JOR',
  'japan': 'JPN',
  'kazakhstan': 'KAZ',
  'kenya': 'KEN',
  'kyrgyzstan': 'KGZ',
  'cambodia': 'KHM',
  'kiribati': 'KIR',
  'saint kitts and nevis': 'KNA',
  'korea, republic of': 'KOR',
  'south korea': 'KOR',
  'kuwait': 'KWT',
  "lao people's democratic republic": 'LAO',
  'laos': 'LAO',
  'lebanon': 'LBN',
  'liberia': 'LBR',
  'libya': 'LBY',
  'saint lucia': 'LCA',
  'liechtenstein': 'LIE',
  'sri lanka': 'LKA',
  'lesotho': 'LSO',
  'lithuania': 'LTU',
  'luxembourg': 'LUX',
  'latvia': 'LVA',
  'macao': 'MAC',
  'macau': 'MAC',
  'saint martin (french part)': 'MAF',
  'saint martin': 'MAF',
  'morocco': 'MAR',
  'monaco': 'MCO',
  'moldova': 'MDA',
  'moldova, republic of': 'MDA',
  'madagascar': 'MDG',
  'maldives': 'MDV',
  'mexico': 'MEX',
  'marshall islands': 'MHL',
  'north macedonia': 'MKD',
  'macedonia': 'MKD',
  'mali': 'MLI',
  'malta': 'MLT',
  'myanmar': 'MMR',
  'burma': 'MMR',
  'montenegro': 'MNE',
  'mongolia': 'MNG',
  'northern mariana islands': 'MNP',
  'mozambique': 'MOZ',
  'mauritania': 'MRT',
  'montserrat': 'MSR',
  'martinique': 'MTQ',
  'mauritius': 'MUS',
  'malawi': 'MWI',
  'malaysia': 'MYS',
  'mayotte': 'MYT',
  'namibia': 'NAM',
  'new caledonia': 'NCL',
  'niger': 'NER',
  'norfolk island': 'NFK',
  'nigeria': 'NGA',
  'nicaragua': 'NIC',
  'niue': 'NIU',
  'netherlands': 'NLD',
  'netherlands, kingdom of the': 'NLD',
  'norway': 'NOR',
  'nepal': 'NPL',
  'nauru': 'NRU',
  'new zealand': 'NZL',
  'oman': 'OMN',
  'pakistan': 'PAK',
  'panama': 'PAN',
  'pitcairn': 'PCN',
  'peru': 'PER',
  'philippines': 'PHL',
  'palau': 'PLW',
  'papua new guinea': 'PNG',
  'poland': 'POL',
  'puerto rico': 'PRI',
  'korea, democratic people\'s republic of': 'PRK',
  'north korea': 'PRK',
  'portugal': 'PRT',
  'paraguay': 'PRY',
  'palestine': 'PSE',
  'palestine, state of': 'PSE',
  'french polynesia': 'PYF',
  'qatar': 'QAT',
  'réunion': 'REU',
  'reunion': 'REU',
  'romania': 'ROU',
  'russian federation': 'RUS',
  'russia': 'RUS',
  'rwanda': 'RWA',
  'saudi arabia': 'SAU',
  'sudan': 'SDN',
  'senegal': 'SEN',
  'singapore': 'SGP',
  'south georgia and the south sandwich islands': 'SGS',
  'saint helena': 'SHN',
  'saint helena, ascension and tristan da cunha': 'SHN',
  'svalbard and jan mayen': 'SJM',
  'solomon islands': 'SLB',
  'sierra leone': 'SLE',
  'el salvador': 'SLV',
  'san marino': 'SMR',
  'somalia': 'SOM',
  'saint pierre and miquelon': 'SPM',
  'serbia': 'SRB',
  'south sudan': 'SSD',
  'sao tome and principe': 'STP',
  'são tomé and príncipe': 'STP',
  'suriname': 'SUR',
  'slovakia': 'SVK',
  'slovenia': 'SVN',
  'sweden': 'SWE',
  'eswatini': 'SWZ',
  'swaziland': 'SWZ',
  'sint maarten': 'SXM',
  'sint maarten (dutch part)': 'SXM',
  'seychelles': 'SYC',
  'syria': 'SYR',
  'syrian arab republic': 'SYR',
  'turks and caicos islands': 'TCA',
  'chad': 'TCD',
  'togo': 'TGO',
  'thailand': 'THA',
  'tajikistan': 'TJK',
  'tokelau': 'TKL',
  'turkmenistan': 'TKM',
  'timor-leste': 'TLS',
  'east timor': 'TLS',
  'tonga': 'TON',
  'trinidad and tobago': 'TTO',
  'tunisia': 'TUN',
  'türkiye': 'TUR',
  'turkiye': 'TUR',
  'turkey': 'TUR',
  'tuvalu': 'TUV',
  'taiwan': 'TWN',
  'taiwan, province of china': 'TWN',
  'tanzania': 'TZA',
  'tanzania, united republic of': 'TZA',
  'uganda': 'UGA',
  'ukraine': 'UKR',
  'united states minor outlying islands': 'UMI',
  'uruguay': 'URY',
  'uzbekistan': 'UZB',
  'holy see': 'VAT',
  'vatican': 'VAT',
  'saint vincent and the grenadines': 'VCT',
  'venezuela': 'VEN',
  'venezuela, bolivarian republic of': 'VEN',
  'virgin islands (british)': 'VGB',
  'british virgin islands': 'VGB',
  'virgin islands (u.s.)': 'VIR',
  'us virgin islands': 'VIR',
  'viet nam': 'VNM',
  'vietnam': 'VNM',
  'vanuatu': 'VUT',
  'wallis and futuna': 'WLF',
  'samoa': 'WSM',
  'yemen': 'YEM',
  'south africa': 'ZAF',
  'zambia': 'ZMB',
  'zimbabwe': 'ZWE',
  // Short forms / common variants for the US
  'united states': 'USA',
  'united states of america': 'USA',
  'us': 'USA',
  'usa': 'USA',
  'u.s.': 'USA',
  'u.s.a.': 'USA',

  // ── ISO 3166-1 alpha-2 codes (common ones) ──────────────────────────
  'af': 'AFG', 'al': 'ALB', 'dz': 'DZA', 'ao': 'AGO', 'ar': 'ARG',
  'am': 'ARM', 'au': 'AUS', 'at': 'AUT', 'az': 'AZE', 'bs': 'BHS',
  'bh': 'BHR', 'bd': 'BGD', 'bb': 'BRB', 'by': 'BLR', 'be': 'BEL',
  'bz': 'BLZ', 'bj': 'BEN', 'bt': 'BTN', 'bo': 'BOL', 'ba': 'BIH',
  'bw': 'BWA', 'br': 'BRA', 'bn': 'BRN', 'bg': 'BGR', 'bf': 'BFA',
  'bi': 'BDI', 'kh': 'KHM', 'cm': 'CMR', 'ca': 'CAN', 'cv': 'CPV',
  'cf': 'CAF', 'td': 'TCD', 'cl': 'CHL', 'cn': 'CHN', 'co': 'COL',
  'km': 'COM', 'cg': 'COG', 'cd': 'COD', 'cr': 'CRI', 'ci': 'CIV',
  'hr': 'HRV', 'cu': 'CUB', 'cy': 'CYP', 'cz': 'CZE', 'dk': 'DNK',
  'dj': 'DJI', 'dm': 'DMA', 'do': 'DOM', 'ec': 'ECU', 'eg': 'EGY',
  'sv': 'SLV', 'gq': 'GNQ', 'er': 'ERI', 'ee': 'EST', 'sz': 'SWZ',
  'et': 'ETH', 'fj': 'FJI', 'fi': 'FIN', 'fr': 'FRA', 'ga': 'GAB',
  'gm': 'GMB', 'ge': 'GEO', 'de': 'DEU', 'gh': 'GHA', 'gr': 'GRC',
  'gd': 'GRD', 'gt': 'GTM', 'gn': 'GIN', 'gw': 'GNB', 'gy': 'GUY',
  'ht': 'HTI', 'hn': 'HND', 'hk': 'HKG', 'hu': 'HUN', 'is': 'ISL',
  'in': 'IND', 'id': 'IDN', 'ir': 'IRN', 'iq': 'IRQ', 'ie': 'IRL',
  'il': 'ISR', 'it': 'ITA', 'jm': 'JAM', 'jp': 'JPN', 'jo': 'JOR',
  'kz': 'KAZ', 'ke': 'KEN', 'ki': 'KIR', 'kp': 'PRK', 'kr': 'KOR',
  'kw': 'KWT', 'kg': 'KGZ', 'la': 'LAO', 'lv': 'LVA', 'lb': 'LBN',
  'ls': 'LSO', 'lr': 'LBR', 'ly': 'LBY', 'li': 'LIE', 'lt': 'LTU',
  'lu': 'LUX', 'mo': 'MAC', 'mg': 'MDG', 'mw': 'MWI', 'my': 'MYS',
  'mv': 'MDV', 'ml': 'MLI', 'mt': 'MLT', 'mh': 'MHL', 'mr': 'MRT',
  'mu': 'MUS', 'mx': 'MEX', 'fm': 'FSM', 'md': 'MDA', 'mc': 'MCO',
  'mn': 'MNG', 'me': 'MNE', 'ma': 'MAR', 'mz': 'MOZ', 'mm': 'MMR',
  'na': 'NAM', 'nr': 'NRU', 'np': 'NPL', 'nl': 'NLD', 'nz': 'NZL',
  'ni': 'NIC', 'ne': 'NER', 'ng': 'NGA', 'mk': 'MKD', 'no': 'NOR',
  'om': 'OMN', 'pk': 'PAK', 'pw': 'PLW', 'ps': 'PSE', 'pa': 'PAN',
  'pg': 'PNG', 'py': 'PRY', 'pe': 'PER', 'ph': 'PHL', 'pl': 'POL',
  'pt': 'PRT', 'qa': 'QAT', 'ro': 'ROU', 'ru': 'RUS', 'rw': 'RWA',
  'kn': 'KNA', 'lc': 'LCA', 'vc': 'VCT', 'ws': 'WSM', 'sm': 'SMR',
  'st': 'STP', 'sa': 'SAU', 'sn': 'SEN', 'rs': 'SRB', 'sc': 'SYC',
  'sl': 'SLE', 'sg': 'SGP', 'sk': 'SVK', 'si': 'SVN', 'sb': 'SLB',
  'so': 'SOM', 'za': 'ZAF', 'ss': 'SSD', 'es': 'ESP', 'lk': 'LKA',
  'sd': 'SDN', 'sr': 'SUR', 'se': 'SWE', 'ch': 'CHE', 'sy': 'SYR',
  'tw': 'TWN', 'tj': 'TJK', 'tz': 'TZA', 'th': 'THA', 'tl': 'TLS',
  'tg': 'TGO', 'to': 'TON', 'tt': 'TTO', 'tn': 'TUN', 'tr': 'TUR',
  'tm': 'TKM', 'tv': 'TUV', 'ug': 'UGA', 'ua': 'UKR', 'ae': 'ARE',
  'gb': 'GBR', 'uy': 'URY', 'uz': 'UZB', 've': 'VEN', 'vn': 'VNM',
  'ye': 'YEM', 'zm': 'ZMB', 'zw': 'ZWE', 'aw': 'ABW', 'bm': 'BMU',
  'ky': 'CYM', 'cw': 'CUW', 'gi': 'GIB', 'gl': 'GRL', 'gp': 'GLP',
  'gu': 'GUM', 'mq': 'MTQ', 'nc': 'NCL', 'pr': 'PRI', 're': 'REU',
  'sx': 'SXM', 'tc': 'TCA', 'vg': 'VGB',
};

// ─── US state name / abbreviation → two-letter code ───────────────────
const US_STATE_CODES: Record<string, string> = {
  'alaska': 'AK', 'ak': 'AK',
  'alabama': 'AL', 'al': 'AL',
  'arkansas': 'AR', 'ar': 'AR',
  'arizona': 'AZ', 'az': 'AZ',
  'california': 'CA', 'ca': 'CA',
  'colorado': 'CO', 'co': 'CO',
  'connecticut': 'CT', 'ct': 'CT',
  'district of columbia': 'DC', 'dc': 'DC',
  'delaware': 'DE', 'de': 'DE',
  'florida': 'FL', 'fl': 'FL',
  'georgia': 'GA', 'ga': 'GA',
  'guam': 'GU', 'gu': 'GU',
  'hawaii': 'HI', 'hi': 'HI',
  'iowa': 'IA', 'ia': 'IA',
  'idaho': 'ID', 'id': 'ID',
  'illinois': 'IL', 'il': 'IL',
  'indiana': 'IN', 'in': 'IN',
  'kansas': 'KS', 'ks': 'KS',
  'kentucky': 'KY', 'ky': 'KY',
  'louisiana': 'LA', 'la': 'LA',
  'massachusetts': 'MA', 'ma': 'MA',
  'maryland': 'MD', 'md': 'MD',
  'maine': 'ME', 'me': 'ME',
  'michigan': 'MI', 'mi': 'MI',
  'minnesota': 'MN', 'mn': 'MN',
  'missouri': 'MO', 'mo': 'MO',
  'mississippi': 'MS', 'ms': 'MS',
  'montana': 'MT', 'mt': 'MT',
  'north carolina': 'NC', 'nc': 'NC',
  'north dakota': 'ND', 'nd': 'ND',
  'nebraska': 'NE', 'ne': 'NE',
  'new hampshire': 'NH', 'nh': 'NH',
  'new jersey': 'NJ', 'nj': 'NJ',
  'new mexico': 'NM', 'nm': 'NM',
  'nevada': 'NV', 'nv': 'NV',
  'new york': 'NY', 'ny': 'NY',
  'ohio': 'OH', 'oh': 'OH',
  'oklahoma': 'OK', 'ok': 'OK',
  'oregon': 'OR', 'or': 'OR',
  'pennsylvania': 'PA', 'pa': 'PA',
  'puerto rico': 'PR', 'pr': 'PR',
  'rhode island': 'RI', 'ri': 'RI',
  'south carolina': 'SC', 'sc': 'SC',
  'south dakota': 'SD', 'sd': 'SD',
  'tennessee': 'TN', 'tn': 'TN',
  'texas': 'TX', 'tx': 'TX',
  'utah': 'UT', 'ut': 'UT',
  'virginia': 'VA', 'va': 'VA',
  'virgin islands': 'VI', 'vi': 'VI',
  'vermont': 'VT', 'vt': 'VT',
  'washington': 'WA', 'wa': 'WA',
  'wisconsin': 'WI', 'wi': 'WI',
  'west virginia': 'WV', 'wv': 'WV',
  'wyoming': 'WY', 'wy': 'WY',
};

/**
 * Derive the property-number prefix from an address.
 *
 * - For US addresses → 2-letter state code (NY, CA, …)
 * - For non-US addresses → ISO 3166-1 alpha-3 country code (GBR, DEU, …)
 * - Fallback → 'UNK'
 */
export function getPropertyPrefix(address: {
  country?: string;
  state?: string;
}): string {
  const country = (address.country || '').trim().toLowerCase();
  const state = (address.state || '').trim().toLowerCase();

  if (!country && !state) return 'UNK';

  // Check if it's a US address
  const iso3 = country ? COUNTRY_TO_ISO3[country] : undefined;
  if (iso3 === 'USA') {
    const stateCode = US_STATE_CODES[state];
    return stateCode || 'UNK';
  }

  // Non-US: return the ISO alpha-3 code
  if (iso3) return iso3;

  // The value might already be an ISO alpha-3 code (e.g. "USA", "GBR")
  if (country) {
    const upper = country.toUpperCase();
    const allCodes = new Set(Object.values(COUNTRY_TO_ISO3));
    if (allCodes.has(upper)) {
      if (upper === 'USA') {
        const stateCode = US_STATE_CODES[state];
        return stateCode || 'UNK';
      }
      return upper;
    }
  }

  // No country found — if the state matches a known US state, infer US.
  if (state) {
    const stateCode = US_STATE_CODES[state];
    if (stateCode) return stateCode;
  }

  return 'UNK';
}

/**
 * Extract country and state from a record's normalized data.
 * Handles both composite Address objects and standalone text fields.
 */
export function extractAddressFromRecord(normalizedData: Record<string, any>): {
  country: string;
  state: string;
} {
  // Look for composite address field (could be "address", "Property__address", etc.)
  let addr: any = null;
  let stateField = '';
  let countryField = '';

  for (const [key, value] of Object.entries(normalizedData)) {
    const lk = key.toLowerCase().replace(/^[a-z]+__/, '');
    // Accept both the legacy 'address' field and the LocationSearch 'address_search' field
    if (
      (lk === 'address' || lk === 'address_search') &&
      value && typeof value === 'object' && !Array.isArray(value)
    ) {
      addr = value;
    }
    if (lk === 'state' && typeof value === 'string') stateField = value;
    if (lk === 'country' && typeof value === 'string') countryField = value;
  }

  const addrCountry = (addr?.country) || countryField || '';
  const addrState = (addr?.state) || stateField || '';

  return { country: addrCountry, state: addrState };
}

/**
 * Generate the next property number for a given prefix by scanning
 * existing property numbers. The numeric sequence is global across
 * ALL prefixes so every property gets a unique number.
 */
export function generatePropertyNumber(
  prefix: string,
  existingNumbers: string[],
): string {
  const globalRegex = /^[A-Za-z]+-?(\d+)$/;
  const nums = existingNumbers
    .map((n) => {
      const m = n.match(globalRegex);
      return m ? parseInt(m[1]!, 10) : NaN;
    })
    .filter((n) => !isNaN(n));

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}
