/**
 * browser-compat.js — Cross-browser API compatibility layer
 * 
 * Replaces `webextension-polyfill` with a minimal, zero-dependency wrapper.
 * 
 * - Chrome MV3: Uses native `chrome.*` API (promise-based since Chrome 116+)
 * - Firefox MV2/MV3: Uses native `browser.*` API
 * 
 * This module exports a unified `browser` object that works on both platforms
 * without the StorageArea binding issues that plague webextension-polyfill on Chrome 129+.
 */

// Firefox natively provides `browser` with promise-based APIs.
// Chrome MV3 (116+) provides `chrome` with promise-based APIs.
// We prefer `browser` (Firefox) when available, fall back to `chrome` (Chrome/Edge/Brave).
const api = (typeof globalThis.browser !== 'undefined' && globalThis.browser?.runtime?.id)
  ? globalThis.browser
  : (typeof globalThis.chrome !== 'undefined' ? globalThis.chrome : undefined);

export default api;
