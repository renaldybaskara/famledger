import * as Sentry from '@sentry/react-native'

const DSN = 'https://e70d288ffe67e99d827e7c14345a1f3a@o4511618709585920.ingest.us.sentry.io/4511618735734784'

export function initSentry() {
  Sentry.init({
    dsn: DSN,
    enableNative: true,
    enableAutoSessionTracking: true,
    debug: __DEV__,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  })
}

export { Sentry }
