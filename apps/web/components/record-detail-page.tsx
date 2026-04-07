/**
 * Re-export shim — the implementation has been decomposed into
 * `./record-detail/` for maintainability. This file keeps the
 * original import path (`@/components/record-detail-page`) working
 * for all existing page routes.
 */
export { default } from './record-detail/record-detail-page';
