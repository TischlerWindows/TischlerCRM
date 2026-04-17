/**
 * Re-export property number utilities from the shared @crm/types package
 * so both the web app and API use the same logic.
 */
export { getPropertyPrefix, extractAddressFromRecord, generatePropertyNumber } from '@crm/types';
