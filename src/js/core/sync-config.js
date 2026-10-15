// Public deployment settings contain no member credentials.
export const PUBLIC_SYNC_API = 'https://api.jixrclub.com';
export function syncApiBase(location = globalThis.location) {
  return location?.hostname === 'ghhufue.github.io' ? PUBLIC_SYNC_API : '';
}
