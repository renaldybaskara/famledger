export function initSentry() {
  if (typeof globalThis !== 'undefined' && globalThis.__sentryInitialized) return
  if (typeof globalThis !== 'undefined') globalThis.__sentryInitialized = true
  try {
    if (typeof console !== 'undefined' && console.log) console.log('[sentry-shim] init called, reporting disabled for this build')
  } catch {}
}

const sentryShim = {
  init: initSentry,
  wrap: (component: any) => component,
  captureException: (err: any) => {
    try { if (typeof console !== 'undefined' && console.warn) console.warn('[sentry-shim] captureException', err) } catch {}
  },
  captureMessage: (msg: string) => {
    try { if (typeof console !== 'undefined' && console.warn) console.warn('[sentry-shim] captureMessage', msg) } catch {}
  },
  setUser: () => {},
  setTag: () => {},
  addBreadcrumb: () => {},
  setContext: () => {},
  withScope: () => {},
  configureScope: () => {},
}

export { sentryShim as Sentry }
