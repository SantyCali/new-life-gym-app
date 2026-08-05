const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Package exports enabled with 'react-native' condition so that:
//   • @firebase/auth  → exports['.']['react-native']['default'] = dist/rn/index.js  ✓
//   • @react-native-picker/picker → empty exports map → falls back to main             ✓
//   • react-native-worklets v0.5.1 → no exports field → resolves via 'react-native'
//                                     → src/index.ts compiled by Babel                 ✓
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

// react-native-reanimated v4.1.1 has `"exports": {}` (intentionally empty), which
// causes Metro to block all resolution even though the file exists.
// We bypass the exports map and point directly to the TypeScript source so that
// Metro/Babel compile it (including applying the Reanimated worklet plugin).
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-reanimated') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/react-native-reanimated/src/index.ts'
      ),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
