module.exports = {
  dependencies: {
    // react-native-worklets@0.8.3 (Software Mansion) requires RN 0.77+
    // This project uses RN 0.76.9 (Expo SDK 52). Exclude from native linking
    // so Gradle skips assertMinimalReactNativeVersionTask. Babel plugin still runs.
    'react-native-worklets': {
      platforms: { ios: null, android: null },
    },
    // @sentry/react-native 8.15.1 has a Gradle 8 implicit task dependency bug.
    // Disable native linking — JS-level crash reporting still works via Sentry.init().
    '@sentry/react-native': {
      platforms: { ios: null, android: null },
    },
  },
};
