import { fetchApi as originalFetchApi } from './api';
export * from './api';

/**
 * Mock fetchApi for Headless Runner Environment.
 * We intercept `/status` calls to avoid unnecessary telemetry/health-checks
 * in short-lived runner processes, without modifying the upstream business logic.
 */
export async function fetchApi(path, options = {}) {
  if (path === '/status' || path.includes('/status')) {
    return {
      ok: true,
      json: () => Promise.resolve({ status: 'ok', mocked: true }),
    };
  }
  
  return originalFetchApi(path, options);
}
