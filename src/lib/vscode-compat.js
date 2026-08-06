/**
 * vscode-compat.js
 * Bridges Chrome Extension API calls to VSCode Webview API
 */

let vscodeApi = window.vscodeApi;
if (!vscodeApi) {
  try {
    if (typeof acquireVsCodeApi === 'function') {
      vscodeApi = acquireVsCodeApi();
      window.vscodeApi = vscodeApi;
    }
  } catch (e) {
    // Ignored outside VSCode
  }
}

const listeners = new Set();

const pendingStorageRequests = new Map();
let storageRequestId = 0;

if (vscodeApi) {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'storage-get-response' || message.type === 'storage-set-response' || message.type === 'runtime-message-response') {
      const resolve = pendingStorageRequests.get(message.id);
      if (resolve) {
        resolve(message.data || {});
        pendingStorageRequests.delete(message.id);
      }
      return;
    }
    listeners.forEach(listener => listener(message));
  });
}

const dummyEvent = { addListener: () => {}, removeListener: () => {} };

const api = {
  runtime: {
    id: 'vscode-webview',
    sendMessage: (message) => {
      return new Promise((resolve) => {
        if (!vscodeApi) return resolve();
        
        try {
          const id = ++storageRequestId;
          pendingStorageRequests.set(id, resolve);
          
          // Must stringify to avoid DataCloneError with Vue Reactivity Proxies
          const serialized = JSON.parse(JSON.stringify(message));
          vscodeApi.postMessage({ type: 'runtime-message', id, data: serialized });
        } catch (e) {
          console.error("Failed to serialize runtime message", e);
          resolve();
        }
      });
    },
    onMessage: dummyEvent,
    getURL: (path) => path,
    getManifest: () => ({ version: '1.30.00', manifest_version: 3 })
  },
  storage: {
    local: {
      get: (keys) => {
        return new Promise(resolve => {
          if (!vscodeApi) return resolve({});
          const id = ++storageRequestId;
          pendingStorageRequests.set(id, resolve);
          vscodeApi.postMessage({ type: 'storage-get', id, keys });
        });
      },
      set: (items) => {
        return new Promise(resolve => {
          if (!vscodeApi) return resolve();
          const id = ++storageRequestId;
          pendingStorageRequests.set(id, resolve);
          vscodeApi.postMessage({ type: 'storage-set', id, data: items });
        });
      },
      remove: (keys) => Promise.resolve(),
      onChanged: dummyEvent
    },
    onChanged: dummyEvent
  },
  windows: {
    create: () => Promise.resolve(),
    update: () => Promise.resolve(),
    getCurrent: () => Promise.resolve({ type: 'popup' }),
    getAll: () => Promise.resolve([]),
    remove: () => Promise.resolve(),
    onRemoved: dummyEvent
  },
  tabs: {
    create: () => Promise.resolve(),
    query: () => Promise.resolve([]),
    get: () => Promise.resolve({}),
    sendMessage: () => Promise.resolve(),
    onCreated: dummyEvent,
    onActivated: dummyEvent,
    onRemoved: dummyEvent,
    onUpdated: dummyEvent,
    captureTab: () => Promise.resolve(),
    captureVisibleTab: () => Promise.resolve(),
    setZoom: () => Promise.resolve(),
    reload: () => Promise.resolve(),
    goBack: () => Promise.resolve(),
    goForward: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    update: () => Promise.resolve()
  },
  i18n: {
    getMessage: (key) => key
  },
  webNavigation: {
    onCommitted: dummyEvent,
    onCompleted: dummyEvent,
    onCreatedNavigationTarget: dummyEvent,
    onErrorOccurred: dummyEvent,
    getAllFrames: () => Promise.resolve([])
  },

  proxy: { settings: {} },
  permissions: { contains: () => Promise.resolve(true), request: () => Promise.resolve(true) },
  browserAction: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
  action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
  extension: { isAllowedFileSchemeAccess: () => Promise.resolve(false) },
  commands: { getAll: () => Promise.resolve([]) },
  alarms: { getAll: () => Promise.resolve([]), create: () => {}, clear: () => {} },
};

if (!window.chrome) window.chrome = {};
if (!window.chrome.tabs) window.chrome.tabs = {};
if (!window.chrome.debugger) window.chrome.debugger = {};
if (!window.chrome.downloads) window.chrome.downloads = {};

export default api;
