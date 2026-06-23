module.exports = function (api) {
  api.cache(true);
  // hermes-v0 profile is only needed when running a local Android release build on Windows
  // (Windows ships a debug hermesc that can't compile ES6 classes). EAS Build on Linux
  // uses a proper release hermesc so no profile override is needed.
  const isEASBuild = !!process.env.EAS_BUILD_ID;
  const transformProfile = isEASBuild ? undefined : 'hermes-v0';
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
          ...(transformProfile ? { unstable_transformProfile: transformProfile } : {}),
        },
      ],
      'nativewind/babel',
    ],
  };
};
