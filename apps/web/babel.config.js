module.exports = function (api) {
  api.cache(true);
  // hermesc bundled with react-native 0.76.9 (both Windows and Linux) does not support
  // private class fields (#x, #y …) in AOT compilation. Force hermes-v0 profile so
  // babel-preset-expo compiles those to ES5-compatible WeakMap-backed fields everywhere.
  // On web, isModernEngine=true so this option is ignored; web builds are unaffected.
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind', unstable_transformProfile: 'hermes-v0' }],
      'nativewind/babel',
    ],
  };
};
