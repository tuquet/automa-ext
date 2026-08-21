/**
 * Browser Compatibility Wrapper
 * Replaces webextension-polyfill during build to use native chrome.* APIs (MV3)
 * Provides fallbacks for headless environment (e.g. mock chrome.action)
 */

const getBrowser = () => {
  if (typeof browser !== 'undefined') return browser;
  if (typeof chrome !== 'undefined') return chrome;
  return {};
};

const browserApi = getBrowser();

const createEventMock = () => ({ addListener: () => {}, removeListener: () => {}, hasListener: () => false });

if (!browserApi.action) {
  browserApi.action = {
    setBadgeText: () => Promise.resolve(),
    setBadgeBackgroundColor: () => Promise.resolve(),
    setTitle: () => Promise.resolve(),
    setIcon: () => Promise.resolve(),
    disable: () => Promise.resolve(),
    enable: () => Promise.resolve(),
    getBadgeBackgroundColor: () => Promise.resolve([0, 0, 0, 0]),
    getBadgeText: () => Promise.resolve(""),
    onClicked: createEventMock(),
  };
}
if (!browserApi.browserAction) browserApi.browserAction = browserApi.action;
if (!browserApi.alarms) browserApi.alarms = { onAlarm: createEventMock(), create: () => {}, clear: () => {}, clearAll: () => {}, get: () => Promise.resolve(), getAll: () => Promise.resolve([]) };
if (!browserApi.commands) browserApi.commands = { onCommand: createEventMock(), getAll: () => Promise.resolve([]) };
if (!browserApi.webNavigation) browserApi.webNavigation = { onCompleted: createEventMock(), onHistoryStateUpdated: createEventMock(), onBeforeNavigate: createEventMock(), onCommitted: createEventMock() };
if (!browserApi.contextMenus) browserApi.contextMenus = { onClicked: createEventMock(), create: () => {}, update: () => {}, remove: () => {}, removeAll: () => {} };
if (!browserApi.menus) browserApi.menus = browserApi.contextMenus;
if (!browserApi.notifications) browserApi.notifications = { onClicked: createEventMock(), onClosed: createEventMock(), onButtonClicked: createEventMock(), create: () => Promise.resolve(), clear: () => Promise.resolve(), getAll: () => Promise.resolve({}) };
if (!browserApi.offscreen) browserApi.offscreen = { createDocument: () => Promise.resolve(), closeDocument: () => Promise.resolve(), hasDocument: () => Promise.resolve(false) };
if (!browserApi.runtime) browserApi.runtime = {};
if (!browserApi.runtime.getContexts) browserApi.runtime.getContexts = () => Promise.resolve([{ documentUrl: 'dummy' }]);

// Polyfill for runtime.onMessage to support Promise-based listeners (webextension-polyfill behavior)
if (browserApi.runtime.onMessage && typeof browserApi.runtime.onMessage.addListener === 'function') {
  const originalAddListener = browserApi.runtime.onMessage.addListener.bind(browserApi.runtime.onMessage);
  browserApi.runtime.onMessage.addListener = (listener) => {
    originalAddListener((message, sender, sendResponse) => {
      try {
        const result = listener(message, sender);
        if (result && typeof result.then === 'function') {
          result.then(sendResponse).catch((err) => {
            console.error('Unhandled listener error:', err);
            sendResponse();
          });
          return true; // Keep port open for async response
        }
        if (result !== undefined) {
          sendResponse(result);
        }
      } catch (err) {
        console.error('Synchronous listener error:', err);
      }
    });
  };
}

export default browserApi;
